# 我的書單

個人家庭藏書管理網站：拍照掃描 ISBN 自動帶入書籍資料、記錄購買資訊與二手／新書、閱讀狀態、星等評分、心得筆記，並用 Google 帳號登入保護資料。

## 功能總覽

- 拍照或上傳條碼照片，自動辨識 ISBN 並用 Google Books API 查詢書名、作者、出版社、封面
- 譯者欄位手動填寫／確認（國際書目資料庫通常沒有標準化的譯者欄位）
- 記錄購買日期、購買金額、新書／二手
- 閱讀狀態（未讀／閱讀中／已讀完）、星等評分、存放位置、自訂標籤
- 多筆閱讀心得，附時間戳記
- 搜尋、依狀態／標籤篩選、多種排序
- 統計：藏書量、總花費、已讀完數量、今年購入數量
- Google 帳號登入，資料僅本人可讀寫（Firestore 安全規則限制）
- 沒有查到封面時可自行上傳圖片（瀏覽器端壓縮後存進資料庫，不需要額外的付費儲存服務）

## 一、建立 Firebase 專案（你已經申請好了，接下來做這幾步）

1. 到 [Firebase Console](https://console.firebase.google.com)，選你剛建立的專案
2. **開啟 Google 登入**：左側選單 Build → Authentication → Get started → Sign-in method → 啟用「Google」
3. **建立 Firestore 資料庫**：左側選單 Build → Firestore Database → Create database → 選一個離你近的地區（例如 asia-east1）→ 用「production mode」（正式模式）
4. **取得設定金鑰**：左上角齒輪 → Project settings → 往下滑到「Your apps」→ 點 `</>`（網頁圖示）新增一個網頁應用程式 → 取得 `firebaseConfig` 物件
5. 把整段 `firebaseConfig` 貼到 `js/firebase-config.js` 取代裡面的預留值
6. （選用）如果想限制只有你自己的 Google 帳號能登入，把你的 email 填進同一個檔案裡的 `ALLOWED_EMAIL`

## 二、部署 Firestore 安全規則

這一步很重要——沒有部署規則的話，Firestore 預設是正式模式（拒絕所有讀寫），你的網站會完全無法存取資料。

**用 Firebase Console 手動貼上（最簡單，不用裝任何工具）：**
1. Firestore Database → Rules 分頁
2. 把 `firestore.rules` 檔案裡的內容整段貼上取代
3. 按「發布」

之後每次書單資料量變大也不需要重新部署，這份規則不用再動。

## 三、上架到 GitHub Pages

1. 把這個資料夾裡的所有檔案 push 到你的 GitHub repo
2. Repo 設定 → Pages → Source 選擇你放程式碼的分支（通常是 `main`），資料夾選 `/ (root)`
3. 存檔後，GitHub 會給你一個網址，例如 `https://你的帳號.github.io/repo名稱/`，等一兩分鐘部署完成即可使用

## 四、Google 登入網域授權（重要）

Firebase 預設只允許特定網域呼叫 Google 登入，部署到 GitHub Pages 後第一次登入可能會失敗，這是正常的，處理方式：

1. Firebase Console → Authentication → Settings → Authorized domains
2. 新增你的 GitHub Pages 網域，例如 `你的帳號.github.io`

## 檔案結構

```
booklist/
├── index.html            主頁面結構
├── css/style.css         淺綠色書房風格樣式
├── js/
│   ├── firebase-config.js   ← 你的 Firebase 金鑰放這裡
│   └── app.js                主要邏輯（登入、掃描查詢、CRUD、渲染）
├── firestore.rules       Firestore 安全規則（只有本人能讀寫自己的資料）
└── README.md
```

## 已知限制／之後可以延伸的方向

- **ISBN 辨識**：用 [html5-qrcode](https://github.com/mebjas/html5-qrcode) 讀取靜態照片中的條碼，不用即時相機串流，相容性較好，但照片必須夠清晰、對準條碼；辨識不出來時可以手動輸入 ISBN 或書名。
- **譯者資訊**：Google Books API 沒有標準化的譯者欄位，查詢後通常需要你手動補上或修正。
- **共用書單**：目前資料是依登入者的 Google 帳號 uid 各自獨立。如果之後想跟家人共用同一份書單，需要調整 Firestore 規則跟查詢方式（改成用一個共用的「家庭 ID」而不是個人 uid），這部分我可以之後再幫你加。
- **封面圖片**：儲存為壓縮過的 base64 圖片直接存在 Firestore 文件裡，單一書籍資料在 1MB 上限內綽綽有餘，但不適合存原始畫質的高解析度圖片。
