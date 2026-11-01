import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, collection, getDocs,
  addDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
let admin = null;
let products = [];

const money = n => new Intl.NumberFormat("vi-VN", {
  style: "currency", currency: "VND", maximumFractionDigits: 0
}).format(Number(n) || 0);

const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]
);

function msg(id, text, success = false) {
  const el = $(id);
  if (el) {
    el.textContent = text;
    el.classList.toggle("success", success);
  }
}

function errorText(e) {
  if (e.code === "auth/invalid-credential") return "Email hoặc mật khẩu không đúng.";
  if (e.code === "permission-denied") return "Firestore Rules từ chối truy cập.";
  return e.message || "Đã xảy ra lỗi.";
}

async function checkAdmin(user) {
  const snap = await getDoc(doc(db, "users", user.uid));
  return snap.exists() && String(snap.data().role ?? "").trim() === "admin";
}

async function enterDashboard(user) {
  if (!await checkAdmin(user)) {
    msg("adminLoginMessage", "Tài khoản chưa được cấp role = admin trong Firestore.");
    await signOut(auth);
    return;
  }

  admin = user;
  $("adminLoginBox").classList.add("hidden");
  $("adminDashboard").classList.remove("hidden");
  $("adminWelcome").textContent = "Đã đăng nhập: " + user.email;
  await refresh().catch(e => msg("dashboardMessage", errorText(e)));
}

$("adminLoginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;
  msg("adminLoginMessage", "Đang kiểm tra tài khoản...");

  try {
    await signInWithEmailAndPassword(
      auth, $("adminEmail").value.trim(), $("adminPassword").value
    );
    // onAuthStateChanged handles authorization and opening the dashboard.
  } catch (err) {
    msg("adminLoginMessage", errorText(err));
  } finally {
    button.disabled = false;
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    admin = null;
    $("adminDashboard").classList.add("hidden");
    $("adminLoginBox").classList.remove("hidden");
    document.body.classList.remove("sidebar-open");
    $("sidebarBackdrop").hidden = true;
    return;
  }
  try {
    await enterDashboard(user);
  } catch (e) {
    console.error(e);
    msg("adminLoginMessage", "Không kiểm tra được quyền Admin: " + errorText(e));
  }
});

$("adminLogout").addEventListener("click", async () => {
  await signOut(auth);
  admin = null;
  $("adminDashboard").classList.add("hidden");
  $("adminLoginBox").classList.remove("hidden");
  $("adminLoginForm").reset();
});

async function refresh() {
  if (!admin) return;
  const [ps, os] = await Promise.all([
    getDocs(collection(db, "products")),
    getDocs(collection(db, "orders"))
  ]);

  products = ps.docs.map(d => ({ id: d.id, ...d.data() }));
  $("adminProductCount").textContent = products.length;
  $("adminOrderCount").textContent = os.size;
  $("navProductCount").textContent = products.length;
  $("adminStockCount").textContent = products.reduce((sum, p) => sum + Math.max(0, Number(p.stock) || 0), 0).toLocaleString("vi-VN");
  $("adminFeaturedCount").textContent = products.filter(p => p.featured === true).length;
  $("lastUpdated").textContent = "Cập nhật lúc " + new Date().toLocaleTimeString("vi-VN", {hour: "2-digit", minute: "2-digit"}) + " · Dữ liệu cửa hàng";
  msg("dashboardMessage", "");
  const categories = [...new Set(["Laptop", "PC", "Linh kiện", "Phụ kiện", ...products.map(p => p.category || "Khác")])];
  $("categoryOverview").innerHTML = categories.map(category => {
    const count = products.filter(p => (p.category || "Khác") === category).length;
    return `<div class="category-row"><span>${esc(category)}</span><div class="category-track"><span style="width:${products.length ? count / products.length * 100 : 0}%"></span></div><strong>${count}</strong></div>`;
  }).join("");
  renderProducts();
}

function renderProducts() {
  const container = $("adminProductsList");

  const query = $("adminSearch").value.trim().toLocaleLowerCase("vi-VN");
  const category = $("categoryFilter").value;
  const filtered = products.filter(p => (!category || p.category === category) &&
    `${p.name || ""} ${p.brand || ""} ${p.category || ""}`.toLocaleLowerCase("vi-VN").includes(query));
  $("productResultCount").textContent = `${filtered.length} / ${products.length} sản phẩm`;
  if (!filtered.length) {
    container.innerHTML = `<p class="empty-state">${products.length ? "Không tìm thấy sản phẩm phù hợp." : "Chưa có sản phẩm. Hãy thêm sản phẩm đầu tiên."}</p>`;
    return;
  }
  container.innerHTML = `<table class="products-table"><thead><tr><th scope="col">SẢN PHẨM</th><th scope="col">DANH MỤC</th><th scope="col">GIÁ BÁN</th><th scope="col">TỒN KHO</th><th scope="col">THAO TÁC</th></tr></thead><tbody>` + filtered.map(p => {
    const stock = Math.max(0, Number(p.stock) || 0);
    const image = /^https?:\/\//i.test(p.image || "") ? p.image : "assets/product-placeholder.svg";
    return `<tr>
      <td><div class="product-cell"><img src="${esc(image)}" alt="" loading="lazy"><div><h3>${esc(p.name)}</h3><small>${esc(p.brand)}${p.featured ? " · Nổi bật" : ""}</small></div></div></td>
      <td>${esc(p.category || "Khác")}</td><td>${money(p.price)}</td>
      <td><span class="stock-badge ${stock ? "" : "out"}">${stock ? stock + " còn hàng" : "Hết hàng"}</span></td>
      <td><div class="row-actions"><button class="btn secondary" data-edit="${esc(p.id)}" aria-label="Sửa ${esc(p.name)}">Sửa</button><button class="btn danger" data-delete="${esc(p.id)}" aria-label="Xóa ${esc(p.name)}">Xóa</button></div></td>
    </tr>`;
  }).join("") + "</tbody></table>";

  container.querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => editProduct(b.dataset.edit))
  );

  container.querySelectorAll("[data-delete]").forEach(b =>
    b.addEventListener("click", () => removeProduct(b.dataset.delete))
  );
}

function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p || !admin) return;

  $("productId").value = p.id;
  $("productName").value = p.name || "";
  $("productBrand").value = p.brand || "";
  $("productCategory").value = p.category || "Laptop";
  $("productPrice").value = p.price || 0;
  $("productOldPrice").value = p.oldPrice || 0;
  $("productStock").value = p.stock || 0;
  $("productBadge").value = p.badge || "";
  $("productImage").value = p.image || "";
  $("productDescription").value = p.description || "";
  $("productFeatured").checked = p.featured === true;
  $("productFormTitle").textContent = "Chỉnh sửa sản phẩm";
  $("productForm").scrollIntoView({ behavior: "smooth" });
}

$("productForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!admin) return msg("adminProductMessage", "Bạn chưa đăng nhập Admin.");

  const button = e.submitter;
  button.disabled = true;

  const price = Number($("productPrice").value);
  const oldPrice = Number($("productOldPrice").value || 0);
  const stock = Number($("productStock").value);
  const image = $("productImage").value.trim();

  if (price < 0 || oldPrice < 0 || stock < 0 ||
      !Number.isFinite(price) || !Number.isFinite(stock)) {
    msg("adminProductMessage", "Giá hoặc tồn kho không hợp lệ.");
    button.disabled = false;
    return;
  }

  if (!/^https?:\/\//i.test(image)) {
    msg("adminProductMessage", "URL ảnh phải bắt đầu bằng http:// hoặc https://.");
    button.disabled = false;
    return;
  }

  const data = {
    name: $("productName").value.trim(),
    brand: $("productBrand").value.trim(),
    category: $("productCategory").value,
    price, oldPrice, stock, image,
    badge: $("productBadge").value.trim(),
    description: $("productDescription").value.trim(),
    featured: $("productFeatured").checked,
    updatedAt: serverTimestamp()
  };

  try {
    const id = $("productId").value;
    if (id) {
      await updateDoc(doc(db, "products", id), data);
    } else {
      await addDoc(collection(db, "products"), {
        ...data, createdAt: serverTimestamp()
      });
    }

    $("productForm").reset();
    $("productId").value = "";
    $("productFormTitle").textContent = "Thêm sản phẩm";
    msg("adminProductMessage", "Lưu sản phẩm thành công!", true);
    await refresh();
  } catch (err) {
    msg("adminProductMessage", errorText(err));
  } finally {
    button.disabled = false;
  }
});

async function removeProduct(id) {
  if (!admin) return;
  const p = products.find(x => x.id === id);
  if (!p || !confirm(`Bạn muốn xóa "${p.name}"?`)) return;

  try {
    await deleteDoc(doc(db, "products", id));
    msg("adminProductMessage", "Đã xóa sản phẩm.", true);
    await refresh();
  } catch (err) {
    msg("adminProductMessage", errorText(err));
  }
}

$("cancelEdit").addEventListener("click", () => {
  $("productForm").reset();
  $("productId").value = "";
  $("productFormTitle").textContent = "Thêm sản phẩm";
  msg("adminProductMessage", "");
});

$("adminSearch").addEventListener("input", renderProducts);
$("categoryFilter").addEventListener("change", renderProducts);
$("refreshAdminProducts").addEventListener("click", async () => {
  const button = $("refreshAdminProducts");
  button.disabled = true;
  try { await refresh(); }
  catch (e) { msg("dashboardMessage", errorText(e)); }
  finally { button.disabled = false; }
});
