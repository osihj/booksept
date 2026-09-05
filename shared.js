// ============================================================
// shared.js — 4 個模組（書庫／食譜／日記／回顧）共用的 Firebase 初始化、
// 登入驗證、App 切換列。
//
// index.html（書庫）目前還是用自己內嵌的一份，沒有改用這份檔案，
// 這樣風險最低、不會動到已經在運作的書庫功能。
// recipes.html / diary.html / retrospect.html 這三個新頁面共用這份。
//
// 之後如果想把 index.html 也一起改成用這份 shared.js，記得同步
// firebaseConfig / ALLOWED_EMAIL，兩邊要完全一致。
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// 跟 index.html 使用同一個 Firebase 專案，設定值必須保持完全一致。
export const firebaseConfig = {
  apiKey: "AIzaSyDkG-iHRYVLDtX6_H5EFJt4wlB2JH51xA8",
  authDomain: "booksept.firebaseapp.com",
  projectId: "booksept",
  storageBucket: "booksept.firebasestorage.app",
  messagingSenderId: "496792717845",
  appId: "1:496792717845:web:2ddf2af5d69e61b8a7dc1c"
};

// 只允許這個 email 登入使用；留空字串代表不限制。跟 index.html 保持一致。
export const ALLOWED_EMAIL = "hsinglinstar@gmail.com";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export const $ = (id) => document.getElementById(id);

// ---------- 登入畫面事件（Google 登入／Email 登入／忘記密碼／登出） ----------
// 每個頁面的登入畫面 HTML id 需要跟 index.html 一致：
// login-screen, app, google-login-btn, email-input, password-input,
// email-login-btn, forgot-password-btn, login-error, logout-top-btn
export function wireLoginScreen() {
  const loginBtn = $("google-login-btn");
  const emailInput = $("email-input");
  const passwordInput = $("password-input");
  const emailLoginBtn = $("email-login-btn");
  const forgotPasswordBtn = $("forgot-password-btn");
  const loginError = $("login-error");
  const logoutTopBtn = $("logout-top-btn");

  loginBtn?.addEventListener("click", async () => {
    loginError.hidden = true;
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      loginError.textContent = "登入失敗：" + (err.code || err.message || err);
      loginError.hidden = false;
    }
  });

  emailLoginBtn?.addEventListener("click", async () => {
    loginError.hidden = true;
    loginError.style.color = "#96352b";

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      loginError.textContent = "請輸入 Email 和密碼。";
      loginError.hidden = false;
      return;
    }

    emailLoginBtn.disabled = true;
    emailLoginBtn.textContent = "登入中...";

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      switch (err.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          loginError.textContent = "Email 或密碼錯誤，請確認後再試。";
          break;
        case "auth/invalid-email":
          loginError.textContent = "Email 格式不正確。";
          break;
        case "auth/too-many-requests":
          loginError.textContent = "登入嘗試次數過多，請稍後再試。";
          break;
        default:
          loginError.textContent = "登入失敗：" + (err.message || err);
      }
      loginError.hidden = false;
    } finally {
      emailLoginBtn.disabled = false;
      emailLoginBtn.textContent = "Email 登入";
    }
  });

  [emailInput, passwordInput].forEach((input) => {
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") emailLoginBtn.click();
    });
  });

  forgotPasswordBtn?.addEventListener("click", async () => {
    loginError.hidden = true;
    loginError.style.color = "#96352b";

    const email = emailInput.value.trim();
    if (!email) {
      loginError.textContent = "請先輸入 Email，再按「忘記密碼」。";
      loginError.hidden = false;
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      loginError.textContent = "重設密碼信已寄出，請查看你的 Email。";
      loginError.style.color = "#2c5a38";
      loginError.hidden = false;
    } catch (err) {
      console.error(err);
      loginError.textContent =
        err.code === "auth/invalid-email" ? "Email 格式不正確。" : "無法寄送重設信：" + (err.message || err);
      loginError.hidden = false;
    }
  });

  logoutTopBtn?.addEventListener("click", () => signOut(auth));
}

// ---------- 登入狀態監看 ----------
// 通過 ALLOWED_EMAIL 檢查的使用者才會進入 onSignedIn(user)；
// 未登入或被擋下時會呼叫 onSignedOut()（可省略）。
export function watchAuth(onSignedIn, onSignedOut) {
  const loginScreen = $("login-screen");
  const appRoot = $("app");
  const loginError = $("login-error");

  loginScreen.hidden = false;
  appRoot.hidden = true;

  onAuthStateChanged(auth, (user) => {
    if (user && ALLOWED_EMAIL && user.email !== ALLOWED_EMAIL) {
      loginError.textContent = "這個 Google 帳號沒有使用權限。";
      loginError.hidden = false;
      loginScreen.hidden = false;
      appRoot.hidden = true;
      signOut(auth);
      return;
    }

    if (user) {
      loginScreen.hidden = true;
      appRoot.hidden = false;
      onSignedIn(user);
    } else {
      loginScreen.hidden = false;
      appRoot.hidden = true;
      if (typeof onSignedOut === "function") onSignedOut();
    }
  });
}

// ---------- App 切換列 ----------
// 四個模組共用同一份清單，之後新增模組只要改這裡。
export const APPS = [
  { key: "books", label: "書庫", emoji: "📚", href: "index.html" },
  { key: "recipes", label: "食譜", emoji: "🍳", href: "recipes.html" },
  { key: "diary", label: "日記", emoji: "📖", href: "diary.html" },
  { key: "retrospect", label: "回顧", emoji: "✨", href: "retrospect.html" }
];

// 把切換列畫進 id="app-switcher" 的容器裡；activeKey 是目前所在的模組 key。
export function renderAppSwitcher(activeKey) {
  const container = $("app-switcher");
  if (!container) return;
  container.innerHTML = APPS.map(
    (a) => `
    <a class="app-switcher-btn${a.key === activeKey ? " active" : ""}" href="${a.href}" title="${a.label}">
      <span class="app-switcher-emoji">${a.emoji}</span>
      <span class="app-switcher-label">${a.label}</span>
    </a>`
  ).join("");
}
