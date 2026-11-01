
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDA3KUOezOc_xlbHwFknYQBWMffswFYOfI",
  authDomain: "viet-f635b.firebaseapp.com",
  projectId: "viet-f635b",
  storageBucket: "viet-f635b.firebasestorage.app",
  messagingSenderId: "114490863826",
  appId: "1:114490863826:web:8cba769efb9b2ac642bd0b",
  measurementId: "G-24LW1005EM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

const fallbackImage =
  "https://placehold.co/600x450/f2f4f7/667085?text=TechX";

const money = value => new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
}).format(Number(value) || 0);

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[c]);

let currentProduct = null;
let currentUser = null;
let products = [];

const productId =
  new URLSearchParams(location.search).get("id");

// 1. HIỂN THỊ LỖI

function showError(message) {
  $("detailLoading").classList.add("hidden");
  $("detailContent").classList.add("hidden");
  $("detailError").classList.remove("hidden");
  $("detailError").querySelector("p").textContent = message;
}

// 2. LẤY THÔNG TIN SẢN PHẨM

async function loadProduct() {
  if (!productId) {
    showError("Không tìm thấy mã sản phẩm.");
    return;
  }

  try {
    const productRef = doc(db, "products", productId);
    const snapshot = await getDoc(productRef);

    if (!snapshot.exists()) {
      showError("Sản phẩm không tồn tại hoặc đã bị xóa.");
      return;
    }

    currentProduct = {
      id: snapshot.id,
      ...snapshot.data()
    };

    renderProduct();
    await loadRelatedProducts();

  } catch (error) {
    console.error(error);
    showError("Không thể tải dữ liệu. Hãy kiểm tra kết nối Firebase.");
  }
}

// 3. HIỂN THỊ CHI TIẾT

function renderProduct() {
  const p = currentProduct;

  $("detailLoading").classList.add("hidden");
  $("detailContent").classList.remove("hidden");

  document.title = (p.name || "Sản phẩm") + " | TechX Store";

  $("detailName").textContent = p.name || "Sản phẩm";
  $("detailCategory").textContent = p.category || "Chưa phân loại";
  $("detailBrand").textContent = "Thương hiệu: " + (p.brand || "Đang cập nhật");
  $("detailDescription").textContent = p.description || "Chưa có mô tả sản phẩm.";

  $("detailPrice").textContent = money(p.price);

  const oldPrice = Number(p.oldPrice) || 0;

  $("detailOldPrice").textContent =
    oldPrice > Number(p.price) ? money(oldPrice) : "";

  const stock = Math.max(0, Number(p.stock) || 0);

  $("detailStock").textContent = stock > 0
    ? "✓ Còn hàng: " + stock + " sản phẩm"
    : "✕ Sản phẩm đã hết hàng";

  $("detailImage").src = p.image || fallbackImage;
  $("detailImage").onerror = () => {
    $("detailImage").src = fallbackImage;
  };

  $("detailImage").alt = p.name || "Sản phẩm";

  if (p.badge) {
    $("detailBadge").textContent = p.badge;
    $("detailBadge").classList.remove("hidden");
  } else {
    $("detailBadge").classList.add("hidden");
  }

  $("detailQty").max = stock;
  $("detailQty").value = 1;

  $("addDetailCart").disabled = stock <= 0;
  $("buyNow").disabled = stock <= 0;

  renderSpecifications(p);
}

// 4. HIỂN THỊ THÔNG SỐ KỸ THUẬT

function renderSpecifications(p) {
  const specs = p.specifications || p.specs || {};

  const section = $("specificationSection");
  const container = $("specificationList");

  const entries = Object.entries(specs).filter(
    ([key, value]) =>
      typeof value !== "object" &&
      String(value ?? "").trim() !== ""
  );

  if (!entries.length) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");

  container.innerHTML = entries.map(([key, value]) => `
    <div class="spec-row">
      <span>${esc(key)}</span>
      <span>${esc(value)}</span>
    </div>
  `).join("");
}

// 5. SẢN PHẨM LIÊN QUAN

async function loadRelatedProducts() {
  try {
    const snapshot = await getDocs(collection(db, "products"));

    products = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    const related = products
      .filter(p =>
        p.id !== currentProduct.id &&
        p.category === currentProduct.category
      )
      .slice(0, 4);

    const container = $("relatedProducts");

    if (!related.length) {
      container.innerHTML =
        '<p class="muted">Chưa có sản phẩm liên quan.</p>';
      return;
    }

    container.innerHTML = related.map(p => `
      <article class="related-card"
        data-product-id="${esc(p.id)}">

        <img src="${esc(p.image || fallbackImage)}"
          alt="${esc(p.name)}"
          onerror="this.onerror=null;this.src='${fallbackImage}'">

        <div>
          <h3>${esc(p.name)}</h3>
          <strong>${money(p.price)}</strong>
        </div>

      </article>
    `).join("");

    container.querySelectorAll("[data-product-id]").forEach(card => {
      card.addEventListener("click", () => {
        location.href =
          "product-detail.html?id=" +
          encodeURIComponent(card.dataset.productId);
      });
    });

  } catch (error) {
    console.error("Lỗi sản phẩm liên quan:", error);
  }
}

// 6. THÊM VÀO GIỎ HÀNG

function addToCart(redirect = false) {
  const p = currentProduct;

  if (!p) return;

  const stock = Number(p.stock) || 0;
  const qty = Number($("detailQty").value);

  if (!Number.isInteger(qty) || qty < 1) {
    $("detailMessage").textContent = "Số lượng không hợp lệ.";
    return;
  }

  if (qty > stock) {
    $("detailMessage").textContent = "Số lượng vượt quá tồn kho.";
    return;
  }

  let cart = [];

  try {
    cart = JSON.parse(localStorage.getItem("techx_cart") || "[]");
    if (!Array.isArray(cart)) cart = [];
  } catch {
    cart = [];
  }

  const existing = cart.find(item => item.id === p.id);

  if (existing) {
    if (existing.qty + qty > stock) {
      $("detailMessage").textContent =
        "Giỏ hàng đã đạt số lượng tồn kho.";
      return;
    }

    existing.qty += qty;
    existing.name = p.name;
    existing.price = Number(p.price) || 0;
    existing.image = p.image || fallbackImage;

  } else {
    cart.push({
      id: p.id,
      name: p.name || "Sản phẩm",
      price: Number(p.price) || 0,
      image: p.image || fallbackImage,
      qty
    });
  }

  localStorage.setItem("techx_cart", JSON.stringify(cart));

  if (redirect) {
    location.href = "products.html";
    return;
  }

  $("detailMessage").textContent =
    "✓ Đã thêm sản phẩm vào giỏ hàng!";

}

// 7. TĂNG GIẢM SỐ LƯỢNG

$("minusQty").addEventListener("click", () => {
  const input = $("detailQty");
  input.value = Math.max(1, Number(input.value) - 1);
});

$("plusQty").addEventListener("click", () => {
  const input = $("detailQty");
  const max = Number(currentProduct?.stock) || 0;

  input.value = Math.min(
    max,
    Number(input.value || 1) + 1
  );
});

$("detailQty").addEventListener("change", () => {
  const max = Number(currentProduct?.stock) || 0;
  const input = $("detailQty");

  input.value = Math.min(
    max,
    Math.max(1, Math.floor(Number(input.value) || 1))
  );
});

// 8. NÚT GIỎ HÀNG VÀ MUA NGAY

$("addDetailCart").addEventListener("click", () => {
  addToCart(false);
});

$("buyNow").addEventListener("click", () => {
  addToCart(true);
});

// 9. TÀI KHOẢN

onAuthStateChanged(auth, user => {
  currentUser = user;

  const area = $("userArea");

  if (!area) return;

  if (!user) {
    area.innerHTML =
      '<a href="auth.html" class="btn primary">Đăng nhập</a>';
    return;
  }

  area.innerHTML = `
    <span>Xin chào, ${esc(user.displayName || user.email)}</span>
    <button id="detailLogout" class="btn secondary">
      Đăng xuất
    </button>
  `;

  $("detailLogout").addEventListener("click", async () => {
    await signOut(auth);
    location.reload();
  });
});

// 10. CHẠY

loadProduct();
