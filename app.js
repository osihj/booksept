import { firebaseConfig, ALLOWED_EMAIL } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, deleteDoc, query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ---------- DOM refs ----------
const $ = (id) => document.getElementById(id);
const loginScreen = $("login-screen");
const appRoot = $("app");
const loginBtn = $("google-login-btn");
const loginError = $("login-error");
const logoutBtn = $("logout-btn");
const userAvatar = $("user-avatar");
const userMenuBtn = $("user-menu-btn");
const userMenu = $("user-menu");
const userEmailEl = $("user-email");

const bookGrid = $("book-grid");
const emptyState = $("empty-state");
const searchInput = $("search-input");
const sortSelect = $("sort-select");
const statusFilters = $("status-filters");
const tagFiltersEl = $("tag-filters");

const modal = $("book-modal");
const modalTitle = $("modal-title");
const bookForm = $("book-form");
const closeModalBtn = $("close-modal-btn");
const cancelBtn = $("cancel-btn");
const deleteBookBtn = $("delete-book-btn");

const scanCameraInput = $("scan-camera-input");
const scanUploadInput = $("scan-upload-input");
const manualIsbnBtn = $("manual-isbn-btn");
const isbnManualRow = $("isbn-manual-row");
const isbnManualInput = $("isbn-manual-input");
const isbnLookupBtn = $("isbn-lookup-btn");
const scanStatus = $("scan-status");

const coverPreview = $("cover-preview");
const coverUploadInput = $("cover-upload-input");
const removeCoverBtn = $("remove-cover-btn");
const starInput = $("star-input");
const notesList = $("notes-list");
const noteInput = $("note-input");
const addNoteBtn = $("add-note-btn");

// ---------- State ----------
let currentUser = null;
let allBooks = [];
let unsubscribeBooks = null;
let activeStatus = "all";
let activeTag = null;

let editingId = null;
let currentCoverUrl = "";   // 目前要儲存的封面網址（可能來自 API 或上傳後的 storage 網址）
let pendingCoverFile = null; // 使用者剛選的檔案，存檔時才上傳
let currentRating = 0;
let currentNotes = [];

// ================= Auth =================
loginBtn.addEventListener("click", async () => {
  loginError.hidden = true;
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    loginError.textContent = "登入失敗，請再試一次。";
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user && ALLOWED_EMAIL && user.email !== ALLOWED_EMAIL) {
    loginError.textContent = "這個 Google 帳號沒有使用權限。";
    loginError.hidden = false;
    signOut(auth);
    return;
  }
  currentUser = user;
  if (user) {
    loginScreen.hidden = true;
    appRoot.hidden = false;
    userAvatar.src = user.photoURL || "";
    userEmailEl.textContent = user.email || "";
    subscribeBooks(user.uid);
  } else {
    loginScreen.hidden = false;
    appRoot.hidden = true;
    if (unsubscribeBooks) unsubscribeBooks();
    allBooks = [];
  }
});

userMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  userMenu.hidden = !userMenu.hidden;
});
document.addEventListener("click", () => { userMenu.hidden = true; });

// ================= Firestore subscription =================
function subscribeBooks(uid) {
  const q = query(collection(db, "books"), where("uid", "==", uid));
  unsubscribeBooks = onSnapshot(q, (snap) => {
    allBooks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTagFilters();
    render();
  }, (err) => {
    console.error(err);
  });
}

// ================= Render =================
function render() {
  let books = [...allBooks];

  if (activeStatus !== "all") {
    books = books.filter((b) => b.status === activeStatus);
  }
  if (activeTag) {
    books = books.filter((b) => (b.tags || []).includes(activeTag));
  }
  const term = searchInput.value.trim().toLowerCase();
  if (term) {
    books = books.filter((b) => {
      const hay = [b.title, b.author, b.translator, ...(b.tags || [])].join(" ").toLowerCase();
      return hay.includes(term);
    });
  }

  const [sortField, sortDir] = sortSelect.value.split("-");
  books.sort((a, b) => {
    let av = a[sortField], bv = b[sortField];
    if (sortField === "createdAt") { av = a.createdAt?.seconds || 0; bv = b.createdAt?.seconds || 0; }
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av === undefined || av === null || av === "") av = sortDir === "desc" ? -Infinity : Infinity;
    if (bv === undefined || bv === null || bv === "") bv = sortDir === "desc" ? -Infinity : Infinity;
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  bookGrid.innerHTML = "";
  emptyState.hidden = allBooks.length > 0;
  books.forEach((b) => bookGrid.appendChild(renderCard(b)));

  renderStats();
}

function renderCard(b) {
  const card = document.createElement("div");
  card.className = "book-card";
  card.addEventListener("click", () => openEditModal(b));

  const statusLabel = { unread: "未讀", reading: "閱讀中", finished: "已讀完" }[b.status] || "未讀";
  const rating = b.rating || 0;
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    stars += `<i class="ti ti-star${i <= rating ? "" : " empty"}"></i>`;
  }

  card.innerHTML = `
    <div class="book-cover">
      ${b.coverUrl ? `<img src="${escapeHtml(b.coverUrl)}" alt="">` : `<i class="ti ti-photo"></i>`}
    </div>
    <p class="book-title">${escapeHtml(b.title || "未命名")}</p>
    <p class="book-author">${escapeHtml(b.author || "")}</p>
    <div class="book-meta">
      <span class="status-badge ${b.status === "unread" ? "unread" : ""}">${statusLabel}</span>
      <span class="book-rating">${stars}</span>
    </div>
  `;
  return card;
}

function renderStats() {
  $("stat-total").textContent = allBooks.length;
  const spent = allBooks.reduce((sum, b) => sum + (Number(b.price) || 0), 0);
  $("stat-spent").textContent = "$" + spent.toLocaleString();
  $("stat-finished").textContent = allBooks.filter((b) => b.status === "finished").length;
  const thisYear = String(new Date().getFullYear());
  $("stat-year").textContent = allBooks.filter((b) => (b.purchaseDate || "").startsWith(thisYear)).length;
}

function renderTagFilters() {
  const tagSet = new Set();
  allBooks.forEach((b) => (b.tags || []).forEach((t) => tagSet.add(t)));
  tagFiltersEl.innerHTML = "";
  [...tagSet].sort().forEach((tag) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (activeTag === tag ? " active" : "");
    chip.textContent = tag;
    chip.addEventListener("click", () => {
      activeTag = activeTag === tag ? null : tag;
      renderTagFilters();
      render();
    });
    tagFiltersEl.appendChild(chip);
  });
}

statusFilters.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  activeStatus = btn.dataset.status;
  [...statusFilters.children].forEach((c) => c.classList.toggle("active", c === btn));
  render();
});

searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);

// 把上傳的圖片在瀏覽器端縮小、壓縮成 JPEG，再轉成可以直接存進 Firestore 的文字格式
// 這樣就不需要另外開通 Firebase Storage（也就不需要 Blaze 付費方案）
function compressImageToDataUrl(file, maxWidth = 320, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ================= Modal open/close =================
$("add-book-btn").addEventListener("click", () => openAddModal());
$("empty-add-btn").addEventListener("click", () => openAddModal());
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

function openAddModal() {
  editingId = null;
  modalTitle.textContent = "新增書籍";
  deleteBookBtn.hidden = true;
  bookForm.reset();
  currentCoverUrl = "";
  pendingCoverFile = null;
  currentRating = 0;
  currentNotes = [];
  updateCoverPreview();
  updateStarDisplay();
  renderNotesList();
  scanStatus.hidden = true;
  isbnManualRow.hidden = true;
  modal.hidden = false;
}

function openEditModal(book) {
  editingId = book.id;
  modalTitle.textContent = "編輯書籍";
  deleteBookBtn.hidden = false;
  $("field-title").value = book.title || "";
  $("field-author").value = book.author || "";
  $("field-translator").value = book.translator || "";
  $("field-publisher").value = book.publisher || "";
  $("field-isbn").value = book.isbn || "";
  $("field-purchase-date").value = book.purchaseDate || "";
  $("field-price").value = book.price ?? "";
  $("field-condition").value = book.condition || "new";
  $("field-status").value = book.status || "unread";
  $("field-location").value = book.location || "";
  $("field-tags").value = (book.tags || []).join(", ");
  currentCoverUrl = book.coverUrl || "";
  pendingCoverFile = null;
  currentRating = book.rating || 0;
  currentNotes = [...(book.notes || [])];
  updateCoverPreview();
  updateStarDisplay();
  renderNotesList();
  scanStatus.hidden = true;
  isbnManualRow.hidden = true;
  modal.hidden = false;
}

function closeModal() { modal.hidden = true; }

// ================= Cover =================
function updateCoverPreview() {
  coverPreview.innerHTML = currentCoverUrl
    ? `<img src="${currentCoverUrl}" alt="">`
    : `<i class="ti ti-photo"></i>`;
  removeCoverBtn.hidden = !currentCoverUrl;
}

coverUploadInput.addEventListener("change", () => {
  const file = coverUploadInput.files[0];
  if (!file) return;
  pendingCoverFile = file;
  currentCoverUrl = URL.createObjectURL(file);
  updateCoverPreview();
});

removeCoverBtn.addEventListener("click", () => {
  currentCoverUrl = "";
  pendingCoverFile = null;
  updateCoverPreview();
});

// ================= Star rating =================
starInput.addEventListener("click", (e) => {
  const star = e.target.closest("[data-star]");
  if (!star) return;
  currentRating = Number(star.dataset.star);
  updateStarDisplay();
});
function updateStarDisplay() {
  [...starInput.children].forEach((el) => {
    el.classList.toggle("filled", Number(el.dataset.star) <= currentRating);
  });
}

// ================= Notes =================
addNoteBtn.addEventListener("click", () => {
  const text = noteInput.value.trim();
  if (!text) return;
  currentNotes.push({ date: new Date().toISOString(), text });
  noteInput.value = "";
  renderNotesList();
});

function renderNotesList() {
  notesList.innerHTML = "";
  currentNotes.slice().reverse().forEach((note) => {
    const idx = currentNotes.indexOf(note);
    const el = document.createElement("div");
    el.className = "note-item";
    const dateStr = new Date(note.date).toLocaleDateString("zh-TW");
    el.innerHTML = `<span class="note-date">${dateStr}</span>${escapeHtml(note.text)}`;
    const del = document.createElement("button");
    del.type = "button";
    del.className = "icon-btn";
    del.style.float = "right";
    del.innerHTML = `<i class="ti ti-x" style="font-size:14px"></i>`;
    del.addEventListener("click", () => {
      currentNotes.splice(idx, 1);
      renderNotesList();
    });
    el.prepend(del);
    notesList.appendChild(el);
  });
}

// ================= Barcode scan =================
manualIsbnBtn.addEventListener("click", () => {
  isbnManualRow.hidden = !isbnManualRow.hidden;
});

scanCameraInput.addEventListener("change", () => handleScanFile(scanCameraInput.files[0]));
scanUploadInput.addEventListener("change", () => handleScanFile(scanUploadInput.files[0]));

isbnLookupBtn.addEventListener("click", () => {
  const isbn = isbnManualInput.value.trim();
  if (isbn) lookupISBN(isbn);
});

async function handleScanFile(file) {
  if (!file) return;
  showScanStatus("正在辨識條碼...");
  try {
    const scanner = new Html5Qrcode("reader-hidden");
    const decoded = await scanner.scanFile(file, false);
    await lookupISBN(decoded.replace(/\D/g, ""));
  } catch (err) {
    showScanStatus("無法從照片辨識出條碼，請換一張更清晰、對準條碼的照片，或改用手動輸入 ISBN。");
  }
}

function showScanStatus(msg) {
  scanStatus.textContent = msg;
  scanStatus.hidden = false;
}

async function lookupISBN(isbn) {
  showScanStatus(`查詢 ISBN ${isbn} 中...`);
  $("field-isbn").value = isbn;
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const data = await res.json();
    const info = data.items && data.items[0] && data.items[0].volumeInfo;
    if (!info) {
      showScanStatus("查無這本書的資料，請手動填寫書籍資訊。");
      return;
    }
    $("field-title").value = info.title || "";
    $("field-author").value = (info.authors || []).join("、");
    $("field-publisher").value = info.publisher || "";
    if (!pendingCoverFile && info.imageLinks && info.imageLinks.thumbnail) {
      currentCoverUrl = info.imageLinks.thumbnail.replace("http://", "https://");
      updateCoverPreview();
    }
    showScanStatus("已自動帶入書籍資料，請確認並補上譯者等資訊。");
  } catch (err) {
    showScanStatus("查詢失敗，請檢查網路連線或手動輸入資料。");
  }
}

// ================= Save / Delete =================
bookForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const submitBtn = bookForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const id = editingId || doc(collection(db, "books")).id;
    let coverUrl = currentCoverUrl;

    if (pendingCoverFile) {
      coverUrl = await compressImageToDataUrl(pendingCoverFile);
    }

    const tags = $("field-tags").value.split(",").map((t) => t.trim()).filter(Boolean);

    const data = {
      uid: currentUser.uid,
      title: $("field-title").value.trim(),
      author: $("field-author").value.trim(),
      translator: $("field-translator").value.trim(),
      publisher: $("field-publisher").value.trim(),
      isbn: $("field-isbn").value.trim(),
      purchaseDate: $("field-purchase-date").value,
      price: $("field-price").value ? Number($("field-price").value) : null,
      condition: $("field-condition").value,
      status: $("field-status").value,
      location: $("field-location").value.trim(),
      tags,
      rating: currentRating,
      notes: currentNotes,
      coverUrl,
      updatedAt: serverTimestamp(),
    };
    if (!editingId) data.createdAt = serverTimestamp();

    await setDoc(doc(db, "books", id), data, { merge: true });
    closeModal();
  } catch (err) {
    console.error(err);
    alert("儲存失敗，請稍後再試。");
  } finally {
    submitBtn.disabled = false;
  }
});

deleteBookBtn.addEventListener("click", async () => {
  if (!editingId) return;
  if (!confirm("確定要刪除這本書嗎？此動作無法復原。")) return;
  await deleteDoc(doc(db, "books", editingId));
  closeModal();
});
