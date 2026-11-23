// Kirana Rate Board: same UI as before, data now lives in Firestore.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";
import { SEARCH_SYNONYMS } from "./data/synonyms.js";

const MODE_KEY = "kirana_store_ui_mode_v5";

const CATEGORIES = [
  "Atta & Flours", "Dal & Pulses", "Rice & Grains", "Spices & Masala", "Oil & Ghee",
  "Sugar & Sweeteners", "Dry Fruits & Seeds", "Snacks & Ready-to-Eat",
  "Vrat / Fasting & Pooja", "Household & Misc"
];

const CATEGORY_ICONS = {
  "Atta & Flours": "🌾", "Dal & Pulses": "🫘", "Rice & Grains": "🍚", "Spices & Masala": "🌶️",
  "Oil & Ghee": "🫗", "Sugar & Sweeteners": "🍯", "Dry Fruits & Seeds": "🥜",
  "Snacks & Ready-to-Eat": "🍿", "Vrat / Fasting & Pooja": "🪔", "Household & Misc": "🧹"
};

// ---------- Firebase ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const itemsCol = collection(db, "items");

// ---------- State ----------
let items = [];                 // always sorted by seq (notebook order)
let activeCategoryFilter = "all";
let activeSortOrder = "original";
let searchQuery = "";
let currentMode = "view";
let currentUser = null;
let isEditor = false;
let unsubscribeItems = null;
let toastTimeout = null;
let renderPending = false;
let pendingDeleteId = null;

// ---------- Helpers ----------
function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function showToast(message, icon = "✓") {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toast-message");
  const iconEl = document.getElementById("toast-icon");
  if (!toast || !msgEl) return;
  msgEl.textContent = message;
  if (iconEl) iconEl.textContent = icon;
  toast.classList.remove("translate-y-20", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-20", "opacity-0");
  }, 2200);
}

function setStatus(text, cls) {
  const el = document.getElementById("save-status");
  if (!el) return;
  el.textContent = text;
  el.className = cls + " font-semibold";
}

function getSortableName(name) {
  const match = String(name || "").match(/\(([^)]+)\)/);
  return (match ? match[1] : String(name || "")).trim().toLowerCase();
}

function writeFailed(err) {
  console.warn(err);
  const msg = err && err.code === "permission-denied" ? "Not allowed: editor access needed" : "Could not save";
  showToast(msg, "!");
}

// ---------- Auth ----------
const loginScreen = document.getElementById("login-screen");
function showLogin() { loginScreen.classList.remove("hidden"); loginScreen.classList.add("flex"); }
function hideLogin() { loginScreen.classList.add("hidden"); loginScreen.classList.remove("flex"); }

// Reads the user's role. Returns null if it could not be checked (offline or slow).
async function readRole(user, forceRefresh) {
  try {
    const result = await Promise.race([
      user.getIdTokenResult(forceRefresh),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000))
    ]);
    return result.claims.role || "";
  } catch (err) {
    return null;
  }
}

function enterApp(role) {
  if (role === "") {                      // signed in, but no role given yet
    isEditor = false;
    setStatus("● No access. Ask the owner to give your account a role.", "text-rose-600");
    showToast("Your account has no role yet", "!");
    return;
  }
  isEditor = role === "editor";           // null (could not check) behaves like viewer
  let savedMode = "view";
  try { savedMode = localStorage.getItem(MODE_KEY) || "view"; } catch (e) {}
  setMode(isEditor ? savedMode : "view");
  if (!unsubscribeItems) startListening();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null; isEditor = false;
    if (unsubscribeItems) { unsubscribeItems(); unsubscribeItems = null; }
    items = [];
    showLogin();                          // only shown when really signed out
    return;
  }
  currentUser = user;
  hideLogin();                            // saved login: go straight to the list

  // 1) Use the saved token first. No network wait, so the list opens at once.
  const cachedRole = await readRole(user, false);
  enterApp(cachedRole);

  // 2) Quietly refresh in the background so role changes apply.
  const freshRole = await readRole(user, true);
  if (freshRole !== null && freshRole !== cachedRole) enterApp(freshRole);
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("login-error");
  errEl.classList.add("hidden");
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("login-email").value.trim(),
      document.getElementById("login-password").value
    );
    document.getElementById("login-password").value = "";
  } catch (err) {
    errEl.textContent = "Wrong email or password, or no internet.";
    errEl.classList.remove("hidden");
  }
});

window.logout = () => signOut(auth);

// ---------- Live data ----------
function startListening() {
  if (unsubscribeItems) unsubscribeItems();
  const q = query(itemsCol, orderBy("seq"));
  unsubscribeItems = onSnapshot(q, (snap) => {
    items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const m = snap.metadata;
    if (m.hasPendingWrites) setStatus("● Saving… will sync when online", "text-amber-600");
    else if (m.fromCache) setStatus("● Offline copy", "text-amber-600");
    else setStatus("● Synced", "text-emerald-600");

    // Don't wipe a cell someone is typing in; redraw after they finish.
    const a = document.activeElement;
    if (a && a.isContentEditable) { renderPending = true; return; }
    renderCategoryPills();
    renderTable();
  }, (err) => {
    console.warn(err);
    setStatus("● Cannot read data (check login / rules)", "text-rose-600");
  });
}

// ---------- Rendering ----------
function renderCategoryPills() {
  const select = document.getElementById("category-select");
  if (!select) return;
  let html = `<option value="all"${activeCategoryFilter === "all" ? " selected" : ""}>All Categories (${items.length})</option>`;
  CATEGORIES.forEach(cat => {
    const count = items.filter(i => i.category === cat).length;
    const icon = CATEGORY_ICONS[cat] || "📦";
    const selected = activeCategoryFilter === cat ? " selected" : "";
    html += `<option value="${escapeHTML(cat)}"${selected}>${icon} ${escapeHTML(cat)} (${count})</option>`;
  });
  select.innerHTML = html;
}

window.setMode = function (mode) {
  currentMode = mode === "edit" && isEditor ? "edit" : "view";
  try { localStorage.setItem(MODE_KEY, currentMode); } catch (err) {}

  const isEdit = currentMode === "edit";
  const viewBtn = document.getElementById("mode-view-btn");
  const editBtn = document.getElementById("mode-edit-btn");
  const editActions = document.getElementById("edit-toolbar-actions");
  const thCategory = document.getElementById("th-category");
  const thActions = document.getElementById("th-actions");
  const modeBadge = document.getElementById("mode-badge");
  const footerHint = document.getElementById("footer-hint");

  editBtn.classList.toggle("hidden", !isEditor); // viewers never see the Edit button

  const activeCls = "flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-white text-amber-900 shadow-xs transition cursor-pointer";
  const idleCls = "flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-amber-100 hover:text-white transition cursor-pointer";

  if (isEdit) {
    viewBtn.className = idleCls; editBtn.className = activeCls + (isEditor ? "" : " hidden");
    editActions.classList.remove("hidden");
    thCategory.classList.remove("hidden"); thActions.classList.remove("hidden");
    modeBadge.className = "text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap";
    modeBadge.textContent = "✏️ Edit Mode Active";
    footerHint.innerHTML = "Edit Mode active — tap any cell to edit text directly. Changes save automatically.";
  } else {
    viewBtn.className = activeCls; editBtn.className = idleCls + (isEditor ? "" : " hidden");
    editActions.classList.add("hidden");
    thCategory.classList.add("hidden"); thActions.classList.add("hidden");
    modeBadge.className = "text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap";
    modeBadge.textContent = "👁️ Simple View";
    footerHint.innerHTML = isEditor
      ? "Simple View Mode active — switch to <strong>Edit Mode</strong> in the top bar to modify prices, categories, or items."
      : "Simple View Mode active.";
  }
  renderTable();
};

function renderTable() {
  const tbody = document.getElementById("table-body");
  const emptyState = document.getElementById("empty-state");
  if (!tbody) return;

  const isEdit = currentMode === "edit";
  const q = searchQuery.trim().toLowerCase();

  let searchTerms = [];
  if (q) {
    searchTerms.push(q);
    Object.keys(SEARCH_SYNONYMS).forEach(key => {
      if (key.includes(q) || q.includes(key)) searchTerms.push(...SEARCH_SYNONYMS[key]);
    });
  }

  const filtered = items.filter(entry => {
    if (activeCategoryFilter !== "all" && entry.category !== activeCategoryFilter) return false;
    if (!q) return true;
    const blob = `${entry.itemName} ${entry.price} ${entry.amountOfItem} ${entry.category}`.toLowerCase();
    return searchTerms.some(term => blob.includes(term));
  });

  if (activeSortOrder === "az") {
    filtered.sort((a, b) => getSortableName(a.itemName).localeCompare(getSortableName(b.itemName)));
  } else if (activeSortOrder === "za") {
    filtered.sort((a, b) => getSortableName(b.itemName).localeCompare(getSortableName(a.itemName)));
  }

  document.getElementById("visible-count").textContent = filtered.length;
  document.getElementById("total-count").textContent = items.length;

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    emptyState.classList.toggle("hidden", items.length === 0 && !currentUser);
    return;
  }
  emptyState.classList.add("hidden");

  tbody.innerHTML = filtered.map(entry => {
    const id = escapeHTML(entry.id);
    const catIcon = CATEGORY_ICONS[entry.category] || "📦";
    const editableAttr = isEdit ? `contenteditable="true"` : "";
    const cellEditClass = isEdit
      ? "border border-dashed border-amber-300/90 md:border-transparent bg-amber-50/40 md:bg-transparent hover:bg-amber-50/70 cursor-text"
      : "";
    const categoryOptionsHTML = CATEGORIES.map(cat =>
      `<option value="${escapeHTML(cat)}"${entry.category === cat ? " selected" : ""}>${CATEGORY_ICONS[cat] || "📦"} ${escapeHTML(cat)}</option>`
    ).join("");

    return `
      <tr class="item-row hover:bg-amber-50/30 transition-colors" data-id="${id}">
        <td class="col-item py-3 px-4 align-middle">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div ${editableAttr}
                 onblur="updateCell('${id}', 'itemName', this.innerText)"
                 onkeydown="handleCellKeydown(event, this)"
                 class="font-semibold text-slate-900 text-base md:text-sm px-2 py-1.5 rounded-lg ${cellEditClass} flex-grow">
              ${escapeHTML(entry.itemName)}
            </div>
            ${!isEdit ? `<span class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 whitespace-nowrap">${catIcon} ${escapeHTML(entry.category)}</span>` : ""}
          </div>
        </td>
        <td class="col-price py-3 px-4 align-middle">
          <div ${editableAttr}
               onblur="updateCell('${id}', 'price', this.innerText)"
               onkeydown="handleCellKeydown(event, this)"
               class="font-bold text-emerald-700 text-sm px-2 py-1.5 rounded-lg ${cellEditClass}">
            ${escapeHTML(entry.price)}
          </div>
        </td>
        <td class="col-amount py-3 px-4 align-middle">
          <div ${editableAttr}
               onblur="updateCell('${id}', 'amountOfItem', this.innerText)"
               onkeydown="handleCellKeydown(event, this)"
               class="font-medium text-slate-700 text-sm px-2 py-1.5 rounded-lg ${cellEditClass}">
            ${escapeHTML(entry.amountOfItem)}
          </div>
        </td>
        ${isEdit ? `
        <td class="col-category py-3 px-4 align-middle no-print">
          <select onchange="updateCategory('${id}', this.value)" class="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer">
            ${categoryOptionsHTML}
          </select>
        </td>
        <td class="col-actions py-3 px-4 align-middle text-center no-print">
          <div class="inline-flex items-center gap-1.5">
            <button onclick="insertRowAfter('${id}')" title="Insert item below" class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-sm transition cursor-pointer">+</button>
            <button onclick="deleteRow('${id}')" title="Delete item" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 font-bold text-sm transition cursor-pointer">✕</button>
          </div>
        </td>` : ""}
      </tr>`;
  }).join("");
}

// ---------- Edits (all go to Firestore; rules allow editors only) ----------
function stamp() {
  return { updatedAt: serverTimestamp(), updatedBy: currentUser ? currentUser.email : "" };
}

window.handleCellKeydown = (e, el) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); el.blur(); }
};

window.updateCell = (id, field, newValue) => {
  const item = items.find(i => i.id === id);
  const cleaned = newValue.trim();
  if (item && item[field] !== cleaned) {
    // Offline writes queue up and sync later, so don't wait for the server here.
    updateDoc(doc(db, "items", id), { [field]: cleaned, ...stamp() }).catch(writeFailed);
    showToast("Changes saved automatically");
  }
  if (renderPending) { renderPending = false; setTimeout(() => { renderCategoryPills(); renderTable(); }, 0); }
};

window.updateCategory = (id, newCat) => {
  updateDoc(doc(db, "items", id), { category: newCat, ...stamp() }).catch(writeFailed);
  showToast("Category updated");
};

function newItemData(category, seq) {
  return {
    seq, category,
    itemName: "नया आइटम (New Item)",
    price: "₹0",
    amountOfItem: "1 packet / piece",
    ...stamp()
  };
}

window.addNewRow = () => {
  const category = activeCategoryFilter !== "all" ? activeCategoryFilter : "Household & Misc";
  const lastSeq = items.length ? items[items.length - 1].seq : 0;
  addDoc(itemsCol, newItemData(category, lastSeq + 1)).catch(writeFailed);
  showToast("Added new item at bottom", "+");
};

window.insertRowAfter = (id) => {
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return;
  const cur = items[idx], next = items[idx + 1];
  const seq = next ? (cur.seq + next.seq) / 2 : cur.seq + 1; // slot between neighbours
  addDoc(itemsCol, newItemData(cur.category, seq)).catch(writeFailed);
  showToast("Inserted new item below", "+");
};

window.deleteRow = (id) => {
  const item = items.find(i => i.id === id);
  if (!item) return;
  pendingDeleteId = id;
  document.getElementById("delete-modal-text").textContent = `"${item.itemName}" will be removed for everyone.`;
  const modal = document.getElementById("delete-modal");
  modal.classList.remove("hidden"); modal.classList.add("flex");
};

window.closeDeleteModal = () => {
  pendingDeleteId = null;
  const modal = document.getElementById("delete-modal");
  modal.classList.add("hidden"); modal.classList.remove("flex");
};

window.confirmDelete = () => {
  if (pendingDeleteId) {
    deleteDoc(doc(db, "items", pendingDeleteId)).catch(writeFailed);
    showToast("Item removed", "✕");
  }
  window.closeDeleteModal();
};

// ---------- Search / filter / sort ----------
window.handleSearch = (val) => {
  searchQuery = val;
  document.getElementById("clear-search").classList.toggle("hidden", val.trim().length === 0);
  renderTable();
};

window.clearSearch = () => {
  searchQuery = "";
  document.getElementById("search-input").value = "";
  document.getElementById("clear-search").classList.add("hidden");
  renderTable();
};

window.setCategoryFilter = (cat) => { activeCategoryFilter = cat; renderCategoryPills(); renderTable(); };

window.setSortOrder = (order) => {
  activeSortOrder = order;
  document.getElementById("sort-select").value = order;
  renderTable();
};

// ---------- Export ----------
window.exportCSV = () => {
  const csvRows = [["Item Name", "Price", "Amount of Item", "Category"].join(",")];
  items.forEach(item => {
    csvRows.push([item.itemName, item.price, item.amountOfItem, item.category]
      .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob(["﻿" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "kirana_store_rate_list.csv";
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("CSV exported with Hindi & English text", "📊");
};

// ---------- PWA ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}