
import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ======================================
// 1. KẾT NỐI FIREBASE
// ======================================

const firebaseConfig = {
  apiKey: "AIzaSyDA3KUOezOc_xlbHwFknYQBWMffswFYOfI",
  authDomain: "viet-f635b.firebaseapp.com",
  projectId: "viet-f635b",
  storageBucket: "viet-f635b.firebasestorage.app",
  messagingSenderId: "114490863826",
  appId: "1:490863:web:8cba769efb9b2ac642bd0b",
  measurementId: "G-24LW1005EM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

// ======================================
// 2. HIỂN THỊ THÔNG BÁO
// ======================================

function message(id, text, success = false) {
  const el = $(id);

  if (!el) return;

  el.textContent = text;
  el.classList.toggle("success", success);
}

// ======================================
// 3. XỬ LÝ LỖI FIREBASE
// ======================================

function errorText(error) {
  const errors = {
    "auth/email-already-in-use":
      "Email này đã được đăng ký.",

    "auth/invalid-email":
      "Email không hợp lệ.",

    "auth/weak-password":
      "Mật khẩu phải có ít nhất 6 ký tự.",

    "auth/invalid-credential":
      "Email hoặc mật khẩu không chính xác.",

    "auth/user-not-found":
      "Không tìm thấy tài khoản.",

    "auth/wrong-password":
      "Mật khẩu không chính xác.",

    "auth/too-many-requests":
      "Bạn đã thử quá nhiều lần. Hãy thử lại sau.",

    "auth/network-request-failed":
      "Không có kết nối Internet.",

    "permission-denied":
      "Không có quyền truy cập dữ liệu Firestore."
  };

  return errors[error.code] ||
    error.message ||
    "Đã xảy ra lỗi. Vui lòng thử lại.";
}

// ======================================
// 4. CHUYỂN TRANG THEO QUYỀN
// ======================================

async function redirectByRole(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error(
      "Tài khoản chưa có thông tin trong Firestore."
    );
  }

  const role = String(
    userSnap.data().role || "user"
  ).trim().toLowerCase();

  if (role === "admin") {
    window.location.replace("admin.html");
  } else {
    window.location.replace("index.html");
  }
}

// ======================================
// 5. CHUYỂN TAB ĐĂNG NHẬP / ĐĂNG KÝ
// ======================================

document.querySelectorAll(".tab").forEach(button => {

  button.addEventListener("click", () => {

    document.querySelectorAll(".tab").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    if ($("loginForm")) {
      $("loginForm").classList.toggle(
        "hidden",
        button.dataset.show !== "loginForm"
      );
    }

    if ($("registerForm")) {
      $("registerForm").classList.toggle(
        "hidden",
        button.dataset.show !== "registerForm"
      );
    }

  });

});

// ======================================
// 6. ĐĂNG NHẬP CHUNG ADMIN VÀ USER
// ======================================

if ($("loginForm")) {

  $("loginForm").addEventListener("submit", async e => {

    e.preventDefault();

    const button = e.submitter ||
      $("loginForm").querySelector('[type="submit"]');

    if (button) button.disabled = true;

    message("loginMessage", "Đang đăng nhập...");

    try {

      const email = $("loginEmail").value.trim();
      const password = $("loginPassword").value;

      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = credential.user;

      message(
        "loginMessage",
        "Đăng nhập thành công. Đang kiểm tra quyền...",
        true
      );

      await redirectByRole(user);

    } catch (error) {

      message("loginMessage", errorText(error));

    } finally {

      if (button) button.disabled = false;

    }

  });

}

// ======================================
// 7. ĐĂNG KÝ TÀI KHOẢN USER
// ======================================

if ($("registerForm")) {

  $("registerForm").addEventListener("submit", async e => {

    e.preventDefault();

    const name = $("registerName").value.trim();
    const email = $("registerEmail").value.trim();
    const password = $("registerPassword").value;
    const confirmPassword = $("registerConfirm").value;

    if (!name) {
      message("registerMessage", "Vui lòng nhập họ tên.");
      return;
    }

    if (password.length < 6) {
      message(
        "registerMessage",
        "Mật khẩu phải có ít nhất 6 ký tự."
      );
      return;
    }

    if (password !== confirmPassword) {
      message(
        "registerMessage",
        "Hai mật khẩu không khớp."
      );
      return;
    }

    const button = e.submitter ||
      $("registerForm").querySelector('[type="submit"]');

    if (button) button.disabled = true;

    message("registerMessage", "Đang tạo tài khoản...");

    try {

      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = credential.user;

      await updateProfile(user, {
        displayName: name
      });

      // Người đăng ký mới luôn có quyền USER.
      await setDoc(doc(db, "users", user.uid), {

        uid: user.uid,
        displayName: name,
        email: email,
        role: "user",
        createdAt: serverTimestamp()

      });

      message(
        "registerMessage",
        "Đăng ký thành công! Đang chuyển trang...",
        true
      );

      window.location.replace("index.html");

    } catch (error) {

      message("registerMessage", errorText(error));

    } finally {

      if (button) button.disabled = false;

    }

  });

}

// ======================================
// 8. QUÊN MẬT KHẨU
// ======================================

if ($("forgotPassword")) {

  $("forgotPassword").addEventListener("click", async () => {

    const email = $("loginEmail").value.trim();

    if (!email) {
      message(
        "loginMessage",
        "Vui lòng nhập email trước."
      );
      return;
    }

    try {

      await sendPasswordResetEmail(auth, email);

      message(
        "loginMessage",
        "Nếu email đã đăng ký, hướng dẫn đặt lại mật khẩu sẽ được gửi.",
        true
      );

    } catch (error) {

      message("loginMessage", errorText(error));

    }

  });

}
