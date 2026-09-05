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
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

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
// 食譜照片改用 Firebase Storage（不像書籍封面塞 base64 進 Firestore），
// 需要在 Firebase Console 開通 Storage，並貼上對應的 Storage 安全規則。
export const storage = getStorage(app);
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
// 圖示統一採用單色線條 SVG（stroke-width 1.8、圓角端點、無填色），
// 跟其他頁面的 icon 風格一致，不使用彩色 emoji。
export const APPS = [
  {
    key: "books",
    label: "書庫",
    href: "index.html",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5h4.5a2 2 0 012 2V20H6a2 2 0 01-2-2z"/><path d="M10.5 6.5H14a2 2 0 012 2V20h-3.5a2 2 0 01-2-2z"/><path d="M16.3 6.9l3 .9a1.6 1.6 0 011.1 2l-3.3 11a1.6 1.6 0 01-2 1.1l-1.3-.4"/></svg>`
  },
  {
    key: "recipes",
    label: "食譜",
    href: "recipes.html",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3v6"/><path d="M8.5 3v6"/><path d="M10.5 3v6"/><path d="M8.5 9v12"/><path d="M16.5 3c-1.6 2-1.6 5.8 0 7.8v10.2"/></svg>`
  },
  {
    key: "diary",
    label: "日記",
    href: "diary.html",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 3.5v17"/><path d="M12.5 8h4"/><path d="M12.5 11.5h4"/><path d="M12.5 15h2.5"/></svg>`
  },
  {
    key: "retrospect",
    label: "回顧",
    href: "retrospect.html",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9a8 8 0 118 11"/><path d="M4 9v5h5"/><path d="M12 8v5l3.5 2"/></svg>`
  }
];

// 把切換列畫進 id="app-switcher" 的容器裡；activeKey 是目前所在的模組 key。
export function renderAppSwitcher(activeKey) {
  const container = $("app-switcher");
  if (!container) return;
  container.innerHTML = APPS.map(
    (a) => `
    <a class="app-switcher-btn${a.key === activeKey ? " active" : ""}" href="${a.href}" title="${a.label}">
      <span class="app-switcher-icon">${a.icon}</span>
      <span class="app-switcher-label">${a.label}</span>
    </a>`
  ).join("");
}

// ============================================================
// Icon 系統：跟 index.html（書庫）同一套，內嵌 SVG 取代外部圖示字型，
// 用 <i class="ti ti-xxx"> 標記、由 hydrateIcon() 動態塞入對應的 SVG。
// 這樣食譜／日記／回顧頁面可以直接沿用書庫已經在用的圖示，視覺風格一致，
// 不用每個頁面各自維護一份圖示對照表。
// ============================================================
export const ICONS = {
  star: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2.5l2.98 6.04 6.67.97-4.83 4.7 1.14 6.65L12 17.77l-5.96 3.09 1.14-6.65-4.83-4.7 6.67-.97z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16"/><path d="M4 12h16"/></svg>`,
  photo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" stroke="none"/><path d="M3 16.5l5.5-5 4.5 4.5 3-3L21 17"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14"/><path d="M19 5L5 19"/></svg>`,
  "sort-descending": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h10"/><path d="M4 12h7"/><path d="M4 18h4"/><path d="M17 5v14"/><path d="M13.5 15.5L17 19l3.5-3.5"/></svg>`,
  "sort-ascending": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18h10"/><path d="M4 12h7"/><path d="M4 6h4"/><path d="M17 19V5"/><path d="M13.5 8.5L17 5l3.5 3.5"/></svg>`,
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4.5 6h.01"/><path d="M4.5 12h.01"/><path d="M4.5 18h.01"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>`,
  books: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5h4.5a2 2 0 012 2V20H6a2 2 0 01-2-2z"/><path d="M10.5 6.5H14a2 2 0 012 2V20h-3.5a2 2 0 01-2-2z"/><path d="M16.3 6.9l3 .9a1.6 1.6 0 011.1 2l-3.3 11a1.6 1.6 0 01-2 1.1l-1.3-.4"/></svg>`,
  tags: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5V5a1 1 0 011-1h5.5L20 14.5 14.5 20 4 9.5z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5V5a1 1 0 011-1h5.5L20 14.5 14.5 20 4 9.5z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3"/><path d="M15 16l4-4-4-4"/><path d="M19 12H9"/></svg>`,
  "list-details": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6h.01"/><path d="M4.5 12h.01"/><path d="M4.5 18h.01"/><path d="M9 6h11"/><path d="M9 12h7"/><path d="M9 18h9"/></svg>`,
  library: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16"/><path d="M4 4h3v16H4z"/><path d="M9 4h3v16H9z"/><path d="M14.3 4.6l2.9-.6 3.3 15.7-2.9.6z"/></svg>`,
  "layout-grid": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>`,
  "help-circle": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 014.9.8c0 1.8-2.4 2-2.4 3.5"/><path d="M12 17h.01"/></svg>`,
  "filter-off": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16"/><path d="M6 4h14l-5.5 7v6l-4 2v-8L6 4"/></svg>`,
  "file-type-json": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v4h4"/><text x="7" y="17.5" font-family="sans-serif" font-size="6.2" stroke="none" fill="currentColor" font-weight="700">JSON</text></svg>`,
  "file-type-csv": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v4h4"/><text x="7.3" y="17.5" font-family="sans-serif" font-size="6.8" stroke="none" fill="currentColor" font-weight="700">CSV</text></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><path d="M4 18.5h16"/></svg>`,
  "chart-bar": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M20 20H4"/></svg>`,
  "brand-google": `<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.23c0-.82-.07-1.42-.22-2.05H12v3.72h6.02c-.12.97-.78 2.43-2.24 3.41l-.02.14 3.25 2.52.23.02c2.07-1.91 3.26-4.72 3.26-7.76z"/><path fill="#34A853" d="M12 23c2.94 0 5.4-.97 7.2-2.63l-3.43-2.66c-.92.64-2.16 1.09-3.77 1.09-2.88 0-5.32-1.9-6.19-4.53l-.13.01-3.38 2.62-.04.13C4.24 20.55 7.83 23 12 23z"/><path fill="#FBBC05" d="M5.81 14.27a6.6 6.6 0 01-.36-2.13c0-.74.13-1.46.35-2.13l-.01-.14-3.42-2.66-.11.05A10.94 10.94 0 001 12.14c0 1.78.43 3.46 1.26 4.94z"/><path fill="#EA4335" d="M12 5.48c2.04 0 3.42.88 4.21 1.62l3.07-3c-1.9-1.77-4.36-2.85-7.28-2.85-4.17 0-7.76 2.45-9.43 6.03l3.55 2.76c.87-2.63 3.31-4.56 6.19-4.56z"/></svg>`,
  bookshelf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4v16"/><path d="M21 4v16"/><path d="M3 20h18"/><path d="M6 4v13"/><path d="M9.5 4v13"/><path d="M14.8 4.6l2.9-.5 2.2 12.8-2.9.5z"/></svg>`,
  "adjustments-horizontal": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h6"/><path d="M14 6h6"/><circle cx="11" cy="6" r="2"/><path d="M4 12h10"/><path d="M18 12h2"/><circle cx="16" cy="12" r="2"/><path d="M4 18h4"/><path d="M12 18h8"/><circle cx="9" cy="18" r="2"/></svg>`,
  pencil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a1.5 1.5 0 000-2.12l-1.88-1.88a1.5 1.5 0 00-2.12 0L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>`,
  "grip-vertical": `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`,
  scan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 011-1h3"/><path d="M20 8V5a1 1 0 00-1-1h-3"/><path d="M4 16v3a1 1 0 001 1h3"/><path d="M20 16v3a1 1 0 01-1 1h-3"/><path d="M7 9v6"/><path d="M10 9v6"/><path d="M13 9v6"/><path d="M16.5 9v6"/></svg>`,
  // 以下是給食譜／日記／回顧模組新增的圖示，風格(stroke-width 1.8、圓角端點、無填色)
  // 跟上面書庫既有的圖示保持一致。
  utensils: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3v6"/><path d="M8.5 3v6"/><path d="M10.5 3v6"/><path d="M8.5 9v12"/><path d="M16.5 3c-1.6 2-1.6 5.8 0 7.8v10.2"/></svg>`,
  notebook: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 3.5v17"/><path d="M12.5 8h4"/><path d="M12.5 11.5h4"/><path d="M12.5 15h2.5"/></svg>`,
  history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9a8 8 0 118 11"/><path d="M4 9v5h5"/><path d="M12 8v5l3.5 2"/></svg>`,
  "chevron-up": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>`,
  "chevron-down": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`
};

function hydrateIcon(el) {
  if (!el || el.nodeType !== 1 || !el.classList || !el.classList.contains("ti")) return;
  const cls = [...el.classList].find((c) => c !== "ti" && c.startsWith("ti-"));
  if (!cls) return;
  const name = cls.slice(3);
  if (el.dataset.iconName === name) return;
  const svg = ICONS[name];
  if (!svg) return;
  el.innerHTML = svg;
  el.dataset.iconName = name;
}
export function hydrateIcons(root) {
  (root || document).querySelectorAll("i.ti").forEach(hydrateIcon);
}
// 啟動圖示系統：先把目前畫面上的 <i class="ti ti-xxx"> 都塞入 SVG，
// 並監看之後動態新增／切換 class 的圖示元素，自動補上對應的 SVG。
// 每個頁面在畫面初始化時呼叫一次即可。
export function initIconSystem() {
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes") {
        hydrateIcon(m.target);
      } else if (m.type === "childList") {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          hydrateIcon(node);
          node.querySelectorAll && node.querySelectorAll("i.ti").forEach(hydrateIcon);
        });
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  hydrateIcons(document);
}

// ============================================================
// 共用工具函式：HTML escape、排序名單、「Notion 風格圓角膠囊」清單
// （書單管理／食譜分類管理都是同一套：可重新命名、刪除、拖曳排序）。
// 這些都是跟書籍／食譜無關的通用邏輯，從 index.html 的書單管理搬過來，
// 之後日記的標籤管理如果也要做同樣的功能，可以直接沿用。
// ============================================================
export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// 依照 orderArr 記錄的順序排列 names；orderArr 沒出現過的名字，
// 依字母／筆畫排在後面。
export function orderNames(names, orderArr) {
  const idx = new Map(orderArr.map((n, i) => [n, i]));
  const known = names.filter((n) => idx.has(n)).sort((a, b) => idx.get(a) - idx.get(b));
  const unknown = names.filter((n) => !idx.has(n)).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  return [...known, ...unknown];
}

// 產生一列「Notion 風格」圓角膠囊：預設顯示圓角文字徽章，點筆狀圖示才切換成
// 輸入框編輯；左側握把可上下拖曳排序。isTag 只影響顏色樣式。
export function renderManagePillRow(name, count, isTag) {
  const esc = escapeHtml(name);
  return `
    <div class="manage-pill" data-name="${esc}">
      <span class="manage-drag-handle" title="拖曳排序"><i class="ti ti-grip-vertical"></i></span>
      <span class="manage-pill-badge${isTag ? " is-tag" : ""}">${esc}</span>
      <input type="text" class="manage-pill-input" value="${esc}" hidden>
      <span class="manage-row-count">${count} 筆</span>
      <div class="manage-pill-actions view-actions">
        <button type="button" class="icon-btn manage-edit" title="編輯"><i class="ti ti-pencil"></i></button>
        <button type="button" class="icon-btn manage-delete" title="刪除"><i class="ti ti-trash"></i></button>
      </div>
      <div class="manage-pill-actions edit-actions" hidden>
        <button type="button" class="icon-btn manage-confirm" title="確認"><i class="ti ti-check"></i></button>
        <button type="button" class="icon-btn manage-cancel" title="取消"><i class="ti ti-x"></i></button>
      </div>
    </div>`;
}

export function wireManagePillRow(row, { onRename, onDelete }) {
  const original = row.dataset.name;
  const badge = row.querySelector(".manage-pill-badge");
  const input = row.querySelector(".manage-pill-input");
  const viewActions = row.querySelector(".view-actions");
  const editActions = row.querySelector(".edit-actions");
  const confirmBtn = row.querySelector(".manage-confirm");

  function enterEdit() {
    badge.hidden = true; input.hidden = false;
    viewActions.hidden = true; editActions.hidden = false;
    input.value = original; input.focus(); input.select();
  }
  function exitEdit() {
    badge.hidden = false; input.hidden = true;
    viewActions.hidden = false; editActions.hidden = true;
  }
  async function confirmRename() {
    const next = input.value.trim();
    if (!next || next === original) { exitEdit(); return; }
    confirmBtn.disabled = true;
    try {
      await onRename(original, next);
      exitEdit();
    } catch (err) {
      console.error("重新命名失敗：", err);
      alert("重新命名失敗，請稍後再試。\n" + (err?.message || err));
    } finally {
      confirmBtn.disabled = false;
    }
  }

  row.querySelector(".manage-edit").addEventListener("click", enterEdit);
  row.querySelector(".manage-cancel").addEventListener("click", exitEdit);
  confirmBtn.addEventListener("click", confirmRename);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); confirmRename(); }
    else if (e.key === "Escape") { exitEdit(); }
  });
  row.querySelector(".manage-delete").addEventListener("click", async () => {
    try {
      await onDelete(original);
    } catch (err) {
      console.error("刪除失敗：", err);
      alert("刪除失敗，請稍後再試。\n" + (err?.message || err));
    }
  });
}

// 用指標事件（滑鼠／觸控皆可）實作握把拖曳排序，邏輯跟書庫的書單管理完全一致
// （見 index.html 內同名函式的註解）：拖曳中只用 CSS transform 做視覺位移，
// 放開後才真正重排 DOM 並寫回 Firestore；寫入失敗會呼叫 onRevert 還原畫面，
// 避免跟其他畫面（例如側邊欄）顯示的順序不同步。
export function enablePointerReorder(container, onReorderCommit, onRevert) {
  container.querySelectorAll(".manage-drag-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (e) => {
      const pill = handle.closest(".manage-pill");
      if (!pill) return;
      e.preventDefault();
      const pointerId = e.pointerId;
      try { handle.setPointerCapture(pointerId); } catch (err) {}

      const items = [...container.querySelectorAll(".manage-pill")];
      const dragIndex = items.indexOf(pill);
      if (dragIndex === -1) return;
      const originalTops = items.map((el) => el.getBoundingClientRect().top);
      const originalCenters = items.map((el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      const startY = e.clientY;
      const otherIdx = items.map((_, i) => i).filter((i) => i !== dragIndex);
      let lastCount = otherIdx.filter((i) => originalCenters[i] < originalCenters[dragIndex]).length;

      pill.classList.add("dragging");

      function applyVisual(count) {
        const finalOrderIdx = [...otherIdx.slice(0, count), dragIndex, ...otherIdx.slice(count)];
        finalOrderIdx.forEach((origIdx, slot) => {
          if (origIdx === dragIndex) return;
          const shift = originalTops[slot] - originalTops[origIdx];
          items[origIdx].style.transform = shift ? `translateY(${shift}px)` : "";
        });
      }

      function onMove(ev) {
        const deltaY = ev.clientY - startY;
        pill.style.transform = `translateY(${deltaY}px)`;
        const dragCenterY = originalCenters[dragIndex] + deltaY;
        let count = 0;
        for (const i of otherIdx) { if (originalCenters[i] < dragCenterY) count++; }
        lastCount = count;
        applyVisual(count);
      }

      function finishDrag() {
        try { handle.releasePointerCapture(pointerId); } catch (err) {}
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onCancel);

        const otherNames = otherIdx.map((i) => items[i].dataset.name);
        const draggedName = items[dragIndex].dataset.name;
        const finalNames = [...otherNames.slice(0, lastCount), draggedName, ...otherNames.slice(lastCount)];

        items.forEach((el) => { el.style.transform = ""; });
        pill.classList.remove("dragging");
        finalNames.forEach((name) => {
          const el = items.find((it) => it.dataset.name === name);
          if (el) container.appendChild(el);
        });
        return finalNames;
      }
      function onUp() {
        const finalNames = finishDrag();
        Promise.resolve(onReorderCommit(finalNames)).catch((err) => {
          console.error("排序儲存失敗：", err);
          let message = "排序儲存失敗，已還原成儲存前的順序，請稍後再試。";
          if (err?.code === "permission-denied") {
            message = "排序儲存失敗（permission-denied），已還原成儲存前的順序。\n請到 Firebase Console → Firestore Database → Rules，確認相關集合允許目前登入使用者讀寫自己的資料。";
          } else if (err?.message) {
            message += "\n" + err.message;
          }
          alert(message);
          if (typeof onRevert === "function") onRevert();
        });
      }
      function onCancel() { finishDrag(); }

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onCancel);
    });
  });
}
