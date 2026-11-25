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
import { rankItems, chooseTranscript, suggestHindi } from "./smart-search.js";
import { extractKeywords } from "./voice.js";

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
    window.setMode("view");
    renderCategoryPills();
    window.closeShopMenu();
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

// Old Firestore documents remain readable without a destructive migration.
function ratesOf(item) {
  if (Array.isArray(item.variants) && item.variants.length) {
    return item.variants.map(v => ({ quantity: String(v.quantity || ""), price: Number(v.price) })).filter(v => Number.isSafeInteger(v.price) && v.price >= 0);
  }
  const n = Number(String(item.price ?? "0").replace(/[^0-9.]/g, ""));
  return [{ quantity: String(item.amountOfItem || "1 piece"), price: Number.isFinite(n) ? Math.round(n) : 0 }];
}
function namesOf(item) {
  const match = String(item.itemName || "").match(/^(.+?)\\s*\\((.+)\\)\\s*$/);
  return { en: item.nameEn || (match ? match[2] : item.itemName || ""), hi: item.nameHi || (match ? match[1] : "") };
}
const expandedItems = new Set();
// ---------- Rendering ----------
function renderCategoryPills() {
  const chips = document.getElementById("category-chips");
  if (chips) {
    const options = [["all", "All items"], ...CATEGORIES.map(cat => [cat, (CATEGORY_ICONS[cat] || "📦") + " " + cat])];
    chips.replaceChildren(...options.map(([value, label]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "category-chip";
      btn.textContent = label;
      btn.setAttribute("aria-pressed", String(activeCategoryFilter === value));
      btn.onclick = () => window.setCategoryFilter(value);
      return btn;
    }));
  }
}

window.setMode = function (mode) {
  currentMode = mode === "edit" && isEditor ? "edit" : "view";
  try { localStorage.setItem(MODE_KEY, currentMode); } catch (err) {}

  const isEdit = currentMode === "edit";
  const editBtn = document.getElementById("mode-edit-btn");
  const editActions = document.getElementById("edit-toolbar-actions");
  const thCategory = document.getElementById("th-category");
  const thActions = document.getElementById("th-actions");
  editBtn.classList.toggle("hidden", !isEditor);
  editBtn.textContent = isEdit ? "✓ Finish editing" : "✏️ Edit Mode";
  editActions.classList.toggle("hidden", !isEdit);
  thCategory.classList.toggle("hidden", !isEdit);
  thActions.classList.toggle("hidden", !isEdit);
  renderTable();
};

window.toggleEditMode = () => { if (isEditor) window.setMode(currentMode === "edit" ? "view" : "edit"); };
const shopMenu = document.getElementById("shop-menu");
window.closeShopMenu = () => { shopMenu.open = false; };
document.addEventListener("click", e => { if (!shopMenu.contains(e.target)) window.closeShopMenu(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && shopMenu.open) {
    window.closeShopMenu();
    shopMenu.querySelector("summary").focus();
  }
});

function renderTable() {
  const tbody = document.getElementById("table-body");
  const emptyState = document.getElementById("empty-state");
  if (!tbody) return;

  const isEdit = currentMode === "edit";
  const q = searchQuery.trim().toLowerCase();

  const eligible = items.filter(entry => activeCategoryFilter === "all" || entry.category === activeCategoryFilter);
  const filtered = rankItems(eligible, q, ratesOf).map(result => result.item);

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
    const rates = ratesOf(entry);
    const first = rates[0] || { quantity: "—", price: 0 };
    const names = namesOf(entry);
    const many = rates.length > 1;
    const open = many && expandedItems.has(entry.id);
    const categoryOptions = CATEGORIES.map(cat =>
      `<option value="${escapeHTML(cat)}"${entry.category === cat ? " selected" : ""}>${CATEGORY_ICONS[cat] || "📦"} ${escapeHTML(cat)}</option>`
    ).join("");
    const allRates = rates.map(r => `<div class="rate-option"><span>${escapeHTML(r.quantity)}</span><strong>₹${r.price}</strong></div>`).join("");
    return `
      <tr class="item-row" data-id="${id}">
        <td class="col-item" colspan="${isEdit ? 5 : 3}">
          <div class="compact-item">
            <div class="compact-main">
              <button type="button" class="compact-summary" ${many ? `onclick="toggleRates('${id}')" aria-expanded="${open}"` : 'disabled'} aria-label="${escapeHTML(names.hi || names.en)} ${many ? 'show or hide rates' : 'single rate'}">
                <span class="compact-names"><strong>${escapeHTML(names.hi || names.en)}</strong>${names.hi && names.en ? `<small>${escapeHTML(names.en)}</small>` : ""}</span>
                <span class="compact-primary"><strong>₹${first.price}</strong><small>${escapeHTML(first.quantity)}</small></span>
                ${many ? `<span class="compact-chevron" aria-hidden="true">${open ? "⌃" : "⌄"}</span>` : ""}
              </button>
              ${isEdit ? `<button type="button" class="compact-edit no-print" onclick="openPriceModal('${id}')" aria-label="Edit ${escapeHTML(names.en || names.hi)}">✎</button>` : ""}
            </div>
            ${open ? `<div class="compact-rates">${allRates}</div>` : ""}
            ${isEdit ? `<div class="compact-actions no-print">
              <select aria-label="Category" onchange="updateCategory('${id}',this.value)">${categoryOptions}</select>
              <button onclick="insertRowAfter('${id}')">+ Below</button>
              <button onclick="deleteRow('${id}')">Delete</button>
            </div>` : ""}
            <div class="print-rates">${allRates}</div>
          </div>
        </td>
      </tr>`;
  }).join("");
}

// ---------- Compact cards and multi-rate editor ----------
window.toggleRates = id => { if(expandedItems.has(id)) expandedItems.delete(id); else expandedItems.add(id); renderTable(); };
let editingPriceId = null;
let draftRates = [];
let hindiTouched = false;
function addRateField(quantity="", price="") {
  const wrap=document.createElement("div");
  wrap.className="rate-edit-row";
  const qty=document.createElement("input");
  qty.placeholder="e.g. 250 g"; qty.required=true; qty.value=quantity; qty.setAttribute("aria-label","Quantity");
  const amount=document.createElement("input");
  amount.type="number";amount.min="0";amount.step="1";amount.inputMode="numeric";amount.required=true;amount.value=price;amount.setAttribute("aria-label","Price in rupees");
  const remove=document.createElement("button");
  remove.type="button";remove.textContent="✕";remove.setAttribute("aria-label","Remove rate");
  remove.onclick=()=>{if(document.querySelectorAll(".rate-edit-row").length>1)wrap.remove();else showToast("Keep at least one rate","!");};
  wrap.append(qty,amount,remove);document.getElementById("rate-fields").append(wrap);
}
window.addRateField = () => addRateField();
window.openPriceModal = id => {
  if(!isEditor||currentMode!=="edit")return;
  const item=items.find(i=>i.id===id);if(!item)return;
  editingPriceId=id;hindiTouched=false;
  const names=namesOf(item);
  document.getElementById("product-english").value=names.en;
  document.getElementById("product-hindi").value=names.hi || suggestHindi(names.en);
  document.getElementById("rate-fields").replaceChildren();
  ratesOf(item).forEach(r=>addRateField(r.quantity,String(r.price)));
  const modal=document.getElementById("price-modal");modal.classList.remove("hidden");modal.classList.add("flex");
  document.getElementById("product-english").focus();
};
window.autoHindiName = () => {
  if(!hindiTouched)document.getElementById("product-hindi").value=suggestHindi(document.getElementById("product-english").value);
};
window.markHindiEdited = () => { hindiTouched=true; };
window.closePriceModal = () => {
  editingPriceId=null;
  const modal=document.getElementById("price-modal");modal.classList.add("hidden");modal.classList.remove("flex");
};
document.getElementById("price-form").addEventListener("submit", e => {
  e.preventDefault();if(!editingPriceId||!isEditor)return;
  const en=document.getElementById("product-english").value.trim();
  const hi=document.getElementById("product-hindi").value.trim();
  const variants=[...document.querySelectorAll(".rate-edit-row")].map(row=>({
    quantity:row.children[0].value.trim(),price:Number(row.children[1].value)
  }));
  if(!en||!variants.length||variants.some(r=>!r.quantity||!Number.isSafeInteger(r.price)||r.price<0)){
    showToast("Enter quantities and whole-number prices","!");return;
  }
  const first=variants[0];
  updateDoc(doc(db,"items",editingPriceId),{
    nameEn:en,nameHi:hi,itemName:hi ? hi+" ("+en+")" : en,
    variants,price:"₹"+first.price,amountOfItem:first.quantity,...stamp()
  }).then(()=>showToast("Rates saved")).catch(writeFailed);
  window.closePriceModal();
});
document.addEventListener("keydown", e => { if(e.key==="Escape")window.closePriceModal(); });
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
    nameEn: "New Item", nameHi: "नया आइटम",
    price: "₹0",
    amountOfItem: "1 packet / piece",
    variants: [{ quantity: "1 packet / piece", price: 0 }],
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

// ---------- Search / filter (original sequence) ----------
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


// ---------- Export ----------
window.exportCSV = () => {
  const csvRows=[["Item Name","English Name","Hindi Name","Price","Quantity","Category"].join(",")];
  const quote=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  items.forEach(item=>{
    const names=namesOf(item);
    ratesOf(item).forEach(r=>csvRows.push([item.itemName,names.en,names.hi,r.price,r.quantity,item.category].map(quote).join(",")));
  });
  const blob=new Blob(["\\uFEFF"+csvRows.join("\\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download="kirana_store_rate_list.csv";
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  showToast("CSV exported with all rates","📊");
};

// ---------- Voice search: one mic, catalog-aware alternatives ----------
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let listening = false;
let preferredVoiceLang = "hi-IN";
let nextVoiceLang = preferredVoiceLang;
const otherLang = lang => lang === "hi-IN" ? "en-IN" : "hi-IN";

window.startVoice = () => {
  if (!SpeechRec) { showToast("Voice search is not supported in this browser", "!"); return; }
  if (listening && recognizer) { recognizer.stop(); return; }
  const mic = document.getElementById("mic-btn");
  const session = new SpeechRec();
  recognizer = session;
  const lang = nextVoiceLang;
  session.lang = lang;
  session.interimResults = false;
  session.maxAlternatives = 5;
  session.onstart = () => { mic.classList.add("animate-pulse"); showToast("Listening…", "🎤"); };
  session.onresult = e => {
    const result = e.results[e.resultIndex];
    const alternatives = Array.from(result, a => ({ transcript: a.transcript, confidence: a.confidence }));
    const best = chooseTranscript(alternatives, items, ratesOf, extractKeywords);
    if (!best) { nextVoiceLang = otherLang(lang); showToast("Tap mic and repeat once", "!"); return; }
    if (best.score >= 60) {
      preferredVoiceLang = lang;
      nextVoiceLang = preferredVoiceLang;
      if (activeCategoryFilter !== "all" && !rankItems(items.filter(i => i.category === activeCategoryFilter), best.query, ratesOf).some(r => r.score >= 60)) window.setCategoryFilter("all");
    } else {
      nextVoiceLang = otherLang(lang);
      showToast("No clear product match. Tap mic to retry automatically", "!");
    }
    document.getElementById("search-input").value = best.query;
    window.handleSearch(best.query);
  };
  session.onerror = e => {
    if (["no-speech","language-not-supported","nomatch"].includes(e.error)) nextVoiceLang = otherLang(lang);
    const msg = e.error === "not-allowed" || e.error === "service-not-allowed" ? "Allow microphone access for voice search"
      : e.error === "network" ? "Voice needs internet. Type to search offline."
      : e.error === "aborted" ? "Voice search stopped" : "Tap mic and repeat once";
    showToast(msg, "!");
  };
  session.onnomatch = () => { nextVoiceLang = otherLang(lang); showToast("Tap mic and repeat once", "!"); };
  session.onend = () => { listening = false; mic.classList.remove("animate-pulse"); };
  listening = true;
  try { session.start(); } catch (err) { listening = false; mic.classList.remove("animate-pulse"); showToast("Could not start microphone", "!"); }
};
if (!SpeechRec) document.getElementById("mic-btn").classList.add("hidden");

// ---------- PWA ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}