
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================
// 1. FIREBASE
// ==========================================

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
  "https://placehold.co/600x450/f2f4f7/667085?text=TechX+Store";

// ==========================================
// 2. BIẾN DỮ LIỆU
// ==========================================

let products = [];
let shownProducts = [];
let currentUser = null;
let cart = [];
let currentUserRole = "user";
let loadingProducts = false;

try {
  const savedCart = JSON.parse(
    localStorage.getItem("techx_cart") || "[]"
  );

  cart = Array.isArray(savedCart) ? savedCart : [];
} catch {
  cart = [];
}

// ==========================================
// 3. HÀM TIỆN ÍCH
// ==========================================

const money = value =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function imageOf(product) {
  return product.image || fallbackImage;
}

function productUrl(id) {
  return "product-detail.html?id=" + encodeURIComponent(id);
}

// ==========================================
// 4. TẢI SẢN PHẨM
// ==========================================

async function loadProducts() {
  if (loadingProducts) return;

  loadingProducts = true;

  try {
    const snapshot = await getDocs(collection(db, "products"));

    products = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    products.sort((a, b) =>
      (b.createdAt?.seconds || 0) -
      (a.createdAt?.seconds || 0)
    );

    // Cập nhật thông tin giỏ hàng
    cart = cart.map(item => {
      const product = products.find(p => p.id === item.id);

      if (!product) return null;

      return {
        id: product.id,
        name: product.name || "Sản phẩm",
        price: Number(product.price) || 0,
        image: imageOf(product),
        qty: Math.max(1, Math.floor(Number(item.qty) || 1))
      };
    }).filter(Boolean);

    saveCart();

    renderFeatured();
    applyFilters();

  } catch (error) {
    console.error("Lỗi tải sản phẩm:", error);

    if ($("productLoading")) {
      $("productLoading").textContent =
        "Không tải được sản phẩm. Hãy kiểm tra Firebase và Firestore Rules.";
    }

    if ($("featuredLoading")) {
      $("featuredLoading").textContent =
        "Không tải được sản phẩm nổi bật.";
    }

  } finally {
    loadingProducts = false;
  }
}

// ==========================================
// 5. TẠO THẺ SẢN PHẨM
// ==========================================

function productCard(p) {
  const stock = Math.max(0, Number(p.stock) || 0);

  return `
    <article class="product-card">

      <div class="product-image">
        ${p.badge
          ? `<span class="product-badge">${esc(p.badge)}</span>`
          : ""}

        <a href="${productUrl(p.id)}">
          <img
            src="${esc(imageOf(p))}"
            alt="${esc(p.name || "Sản phẩm")}"
            loading="lazy"
            onerror="this.onerror=null;this.src='${fallbackImage}'"
          >
        </a>
      </div>

      <div class="product-body">

        <div class="product-brand">
          ${esc(p.brand || p.category || "")}
        </div>

        <a class="product-name" href="${productUrl(p.id)}">
          ${esc(p.name || "Sản phẩm")}
        </a>

        <div class="product-description">
          ${esc(p.description || "")}
        </div>

        <div class="product-price-row">

          <div>
            <div class="product-price">
              ${money(p.price)}
            </div>

            ${Number(p.oldPrice) > Number(p.price)
              ? `<div class="product-old-price">
                   ${money(p.oldPrice)}
                 </div>`
              : ""}
          </div>

          <span class="product-stock">
            ${stock > 0 ? "Còn " + stock : "Hết hàng"}
          </span>

        </div>

        <div class="product-actions">

          <button
            class="btn secondary"
            type="button"
            data-detail="${esc(p.id)}">
            Xem chi tiết
          </button>

          <button
            class="btn primary"
            type="button"
            data-add="${esc(p.id)}"
            ${stock <= 0 ? "disabled" : ""}>
            🛒 Thêm giỏ hàng
          </button>

        </div>

      </div>
    </article>
  `;
}

// ==========================================
// 6. GẮN SỰ KIỆN SẢN PHẨM
// ==========================================

function attachAddButtons(container) {
  if (!container) return;

  container.querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.add);
    });
  });

  container.querySelectorAll("[data-detail]").forEach(button => {
    button.addEventListener("click", () => {
      location.href = productUrl(button.dataset.detail);
    });
  });
}

// ==========================================
// 7. SẢN PHẨM NỔI BẬT
// ==========================================

function renderFeatured() {
  const container = $("featuredProducts");

  if (!container) return;

  const featured = products.filter(p => p.featured === true);
  const list = (featured.length ? featured : products).slice(0, 4);

  container.innerHTML = list.map(productCard).join("");

  if ($("featuredLoading")) {
    $("featuredLoading").classList.toggle("hidden", list.length > 0);

    if (!list.length) {
      $("featuredLoading").textContent =
        "Chưa có sản phẩm nổi bật.";
    }
  }

  attachAddButtons(container);
}

// ==========================================
// 8. TÌM KIẾM, LỌC, SẮP XẾP
// ==========================================

function applyFilters() {
  const query = ($("searchInput")?.value || "")
    .trim()
    .toLocaleLowerCase("vi");

  const category = $("categoryFilter")?.value || "all";

  const minValue = $("minPrice")?.value;
  const maxValue = $("maxPrice")?.value;

  const min = minValue === "" || minValue == null
    ? 0
    : Number(minValue);

  const max = maxValue === "" || maxValue == null
    ? Infinity
    : Number(maxValue);

  const sort = $("sortSelect")?.value || "newest";

  shownProducts = products.filter(p => {
    const searchText = [
      p.name,
      p.brand,
      p.category,
      p.description
    ].join(" ").toLocaleLowerCase("vi");

    const price = Number(p.price) || 0;

    return searchText.includes(query)
      && (category === "all" || p.category === category)
      && price >= min
      && price <= max;
  });

  shownProducts.sort((a, b) => {
    if (sort === "priceAsc") {
      return Number(a.price) - Number(b.price);
    }

    if (sort === "priceDesc") {
      return Number(b.price) - Number(a.price);
    }

    if (sort === "nameAsc") {
      return String(a.name).localeCompare(String(b.name), "vi");
    }

    return (b.createdAt?.seconds || 0) -
           (a.createdAt?.seconds || 0);
  });

  renderProductList();
}

// ==========================================
// 9. HIỂN THỊ DANH SÁCH
// ==========================================

function renderProductList() {
  const container = $("productGrid");

  if (!container) return;

  container.innerHTML = shownProducts.map(productCard).join("");

  if ($("productLoading")) {
    $("productLoading").classList.add("hidden");
  }

  if ($("emptyState")) {
    $("emptyState").classList.toggle(
      "hidden",
      shownProducts.length > 0
    );
  }

  if ($("productResultCount")) {
    $("productResultCount").textContent =
      shownProducts.length + " sản phẩm";
  }

  attachAddButtons(container);
}

// ==========================================
// 10. GIỎ HÀNG
// ==========================================

function saveCart() {
  localStorage.setItem("techx_cart", JSON.stringify(cart));
  renderCart();
}

function totalCart() {
  return cart.reduce(
    (sum, item) =>
      sum + Number(item.price) * Number(item.qty),
    0
  );
}

// ==========================================
// 11. THÊM VÀO GIỎ HÀNG
// ==========================================

function addToCart(id) {
  const product = products.find(p => p.id === id);

  if (!product) {
    alert("Không tìm thấy sản phẩm.");
    return;
  }

  const stock = Number(product.stock) || 0;

  if (stock <= 0) {
    alert("Sản phẩm đã hết hàng.");
    return;
  }

  const existing = cart.find(item => item.id === id);

  if (existing) {
    if (existing.qty >= stock) {
      alert("Đã đạt số lượng tồn kho.");
      return;
    }

    existing.qty++;
  } else {
    cart.push({
      id: product.id,
      name: product.name || "Sản phẩm",
      price: Number(product.price) || 0,
      image: imageOf(product),
      qty: 1
    });
  }

  saveCart();

  $("cartDrawer")?.classList.remove("hidden");
}

// ==========================================
// 12. TĂNG GIẢM SỐ LƯỢNG
// ==========================================

function changeQty(id, change) {
  const item = cart.find(x => x.id === id);
  const product = products.find(x => x.id === id);

  if (!item) return;

  const stock = Number(product?.stock) || 0;

  if (change > 0 && item.qty >= stock) {
    alert("Đã đạt số lượng tồn kho.");
    return;
  }

  item.qty += change;

  if (item.qty <= 0) {
    cart = cart.filter(x => x.id !== id);
  }

  saveCart();
}

function removeItem(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
}

// ==========================================
// 13. HIỂN THỊ GIỎ HÀNG
// ==========================================

function renderCart() {
  const count = cart.reduce(
    (sum, item) => sum + Number(item.qty),
    0
  );

  document.querySelectorAll("#cartCount").forEach(el => {
    el.textContent = count;
  });

  if ($("miniCartTotal")) {
    $("miniCartTotal").textContent = money(totalCart());
  }

  if ($("cartTotal")) {
    $("cartTotal").textContent = money(totalCart());
  }

  if ($("miniCart")) {
    $("miniCart").innerHTML = cart.length
      ? cart.map(item => `
          <div class="mini-cart-row">
            <span>${esc(item.name)} × ${item.qty}</span>
            <strong>${money(item.price * item.qty)}</strong>
          </div>
        `).join("")
      : '<p class="muted">Giỏ hàng đang trống.</p>';
  }

  if ($("cartItems")) {
    $("cartItems").innerHTML = cart.length
      ? cart.map(item => `
          <div class="cart-item">
            <img
              src="${esc(item.image || fallbackImage)}"
              alt="${esc(item.name)}"
            >

            <div>
              <h4>${esc(item.name)}</h4>

              <div class="cart-unit-price">
                ${money(item.price)}
              </div>

              <div class="cart-quantity">
                <button type="button" data-minus="${esc(item.id)}">−</button>
                <strong>${item.qty}</strong>
                <button type="button" data-plus="${esc(item.id)}">+</button>
                <button
                  type="button"
                  class="cart-remove"
                  data-remove="${esc(item.id)}">
                  Xóa
                </button>
              </div>
            </div>
          </div>
        `).join("")
      : '<p class="muted">Giỏ hàng đang trống.</p>';

    $("cartItems").querySelectorAll("[data-minus]").forEach(button => {
      button.addEventListener("click", () => {
        changeQty(button.dataset.minus, -1);
      });
    });

    $("cartItems").querySelectorAll("[data-plus]").forEach(button => {
      button.addEventListener("click", () => {
        changeQty(button.dataset.plus, 1);
      });
    });

    $("cartItems").querySelectorAll("[data-remove]").forEach(button => {
      button.addEventListener("click", () => {
        removeItem(button.dataset.remove);
      });
    });
  }
}

// ==========================================
// 14. ĐẶT HÀNG
// ==========================================

async function checkout() {
  if (!cart.length) {
    alert("Giỏ hàng đang trống.");
    return;
  }

  if (!currentUser) {
    alert("Bạn cần đăng nhập trước khi đặt hàng.");
    location.href = "auth.html";
    return;
  }

  const button = $("checkoutButton");

  if (button) button.disabled = true;

  try {
    const items = [];

    for (const item of cart) {
      const snapshot = await getDoc(
        doc(db, "products", item.id)
      );

      if (!snapshot.exists()) {
        throw new Error(item.name + " không còn tồn tại.");
      }

      const product = snapshot.data();

      const quantity = Number(item.qty);
      const price = Number(product.price) || 0;
      const stock = Number(product.stock) || 0;

      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > stock
      ) {
        throw new Error(item.name + " không đủ tồn kho.");
      }

      items.push({
        productId: item.id,
        name: product.name || item.name,
        price,
        quantity,
        subtotal: price * quantity
      });
    }

    const total = items.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );

    await addDoc(collection(db, "orders"), {
      userId: currentUser.uid,
      customerEmail: currentUser.email || "",
      customerName: currentUser.displayName || "",
      items,
      total,
      status: "pending",
      createdAt: serverTimestamp()
    });

    cart = [];
    saveCart();

    $("cartDrawer")?.classList.add("hidden");

    alert("Đặt hàng thành công! Cảm ơn bạn đã mua hàng tại TechX Store.");

  } catch (error) {
    console.error("Lỗi đặt hàng:", error);
    alert("Không đặt được hàng: " + error.message);

  } finally {
    if (button) button.disabled = false;
  }
}

// ==========================================
// 15. TÀI KHOẢN VÀ QUYỀN ADMIN
// ==========================================

function renderUserArea() {
  document.querySelectorAll("#userArea").forEach(area => {
    if (!currentUser) {
      area.innerHTML =
        '<a class="btn primary" href="auth.html">Đăng nhập</a>';
      return;
    }

    const adminLink = currentUserRole === "admin"
      ? '<a class="btn secondary" href="admin.html">Trang quản trị</a>'
      : "";

    area.innerHTML = `
      <span>Xin chào, ${esc(
        currentUser.displayName || currentUser.email
      )}</span>

      ${adminLink}

      <button class="btn secondary" data-logout type="button">
        Đăng xuất
      </button>
    `;

    area.querySelector("[data-logout]")?.addEventListener(
      "click",
      async () => {
        try {
          await signOut(auth);
          location.href = "index.html";
        } catch (error) {
          alert("Không thể đăng xuất: " + error.message);
        }
      }
    );
  });
}

// ==========================================
// 16. TÌM KIẾM VÀ BỘ LỌC
// ==========================================

["searchInput", "categoryFilter", "minPrice", "maxPrice", "sortSelect"]
.forEach(id => {
  $(id)?.addEventListener("input", applyFilters);
  $(id)?.addEventListener("change", applyFilters);
});

$("resetFilters")?.addEventListener("click", () => {
  ["searchInput", "minPrice", "maxPrice"].forEach(id => {
    if ($(id)) $(id).value = "";
  });

  if ($("categoryFilter")) {
    $("categoryFilter").value = "all";
  }

  if ($("sortSelect")) {
    $("sortSelect").value = "newest";
  }

  applyFilters();
});

// ==========================================
// 17. ĐIỀU KHIỂN GIỎ HÀNG
// ==========================================

$("cartButton")?.addEventListener("click", () => {
  renderCart();
  $("cartDrawer")?.classList.remove("hidden");
});

document.querySelectorAll("[data-close-cart]").forEach(element => {
  element.addEventListener("click", () => {
    $("cartDrawer")?.classList.add("hidden");
  });
});

$("checkoutButton")?.addEventListener("click", checkout);

// ==========================================
// 18. KIỂM TRA ĐĂNG NHẬP
// ==========================================

onAuthStateChanged(auth, async user => {
  currentUser = user;
  currentUserRole = "user";

  if (user) {
    try {
      const userSnapshot = await getDoc(
        doc(db, "users", user.uid)
      );

      if (userSnapshot.exists()) {
        currentUserRole = userSnapshot.data().role === "admin"
          ? "admin"
          : "user";
      }
    } catch (error) {
      console.error("Không đọc được quyền tài khoản:", error);
    }
  }

  renderUserArea();
});

// ==========================================
// 19. NHẬN DANH MỤC TỪ URL
// ==========================================

const categoryFromURL =
  new URLSearchParams(location.search).get("category");

if (categoryFromURL && $("categoryFilter")) {
  const valid = [...$("categoryFilter").options].some(
    option => option.value === categoryFromURL
  );

  if (valid) {
    $("categoryFilter").value = categoryFromURL;
  }
}

// ==========================================
// 20. KHỞI ĐỘNG
// ==========================================

renderCart();
loadProducts();


