// ============================================================
// 這個檔案請填入你自己 Firebase 專案的設定值。
// 步驟：Firebase Console → 專案設定 → 一般 → 你的應用程式 → SDK 設定
// 把整段 firebaseConfig 物件複製貼上取代下面的內容即可。
// 這組 config 是公開的用戶端識別資訊，不是密碼，可以安心放在 GitHub 上，
// 真正的存取控制是靠 firestore.rules 和 storage.rules 限制只有你能讀寫。
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyDkG-iHRYVLDtX6_H5EFJt4wlB2JH51xA8",
  authDomain: "booksept.firebaseapp.com",
  projectId: "booksept",
  storageBucket: "booksept.firebasestorage.app",
  messagingSenderId: "496792717845",
  appId: "1:496792717845:web:2ddf2af5d69e61b8a7dc1c"
};

// 選填：如果你想額外限制「只有這個 email 能登入使用」，
// 把你的 Google 帳號信箱填在這裡，app.js 會在登入後檢查這個值。
// 留空字串代表不限制（任何登入的 Google 帳號都能看到自己的空書單，
// 但仍然完全看不到、也改不了你的資料，因為 Firestore 規則是用 uid 隔開的）。
export const ALLOWED_EMAIL = "hsinglinstar@gmail.com";
