"use strict";

let COUNTS_FOR_PIVOT;
try {
  COUNTS_FOR_PIVOT = /[\p{L}\p{N}'’\-\u2010\u2011\u2013\u2014]/u;
} catch {
  COUNTS_FOR_PIVOT = /[A-Za-zÀ-ÿ0-9'’\-]/;
}

function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: ${id}`);
  return el;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeText(raw) {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(raw) {
  return String(raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Stable id for the same book text (used for resume + IndexedDB key). */
function corpusFingerprint(text) {
  const t = String(text);
  let h = 2166136261;
  const mix = `${t.length}\n${t.slice(0, 5000)}\n${t.slice(-800)}`;
  for (let i = 0; i < mix.length; i++) {
    h ^= mix.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fp-${(h >>> 0).toString(16)}-${t.length}`;
}

/** One-line slice around the current word for large-book mode (keeps the panel light). */
function buildViewportSnippet(corpus, tok, pad = 72) {
  if (!corpus || !tok || tok.start > tok.end) return { plain: "", html: "" };
  const a = clamp(Math.max(0, tok.start - pad), 0, corpus.length);
  const b = clamp(Math.max(tok.end + pad, a), a, corpus.length);
  const lead = a > 0 ? "… " : "";
  const trail = b < corpus.length ? " …" : "";
  const body = corpus.slice(a, b);
  const plain = lead + body + trail;
  const mark0 = lead.length + (tok.start - a);
  const mark1 = mark0 + (tok.end - tok.start);
  const before = escapeHtml(plain.slice(0, mark0));
  const mid = escapeHtml(plain.slice(mark0, mark1));
  const after = escapeHtml(plain.slice(mark1));
  const html = `${before}<mark class="field__mark">${mid}</mark>${after}`;
  return { plain, html };
}

const IDB_NAME = "singlewordReader";
const IDB_VER = 1;
const IDB_STORE = "books";
const MAX_SAVED_BOOKS = 6;

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
  });
}

async function idbPutBook(record) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetBook(id) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const r = tx.objectStore(IDB_STORE).get(id);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbGetAllBooks() {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const r = tx.objectStore(IDB_STORE).getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

async function idbDeleteBook(id) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbClearAllBooks() {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function pruneOldBooks(keepId) {
  const all = await idbGetAllBooks();
  if (all.length <= MAX_SAVED_BOOKS) return;
  all.sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0));
  for (let i = MAX_SAVED_BOOKS; i < all.length; i++) {
    if (all[i].id !== keepId) await idbDeleteBook(all[i].id);
  }
}

/** Single pass, O(n) — no huge intermediate arrays. */
function roughWordCount(s) {
  let count = 0;
  let inWord = false;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) {
    const nonWs = !/\s/.test(str[i]);
    if (nonWs) {
      if (!inWord) {
        count++;
        inWord = true;
      }
    } else {
      inWord = false;
    }
  }
  return count;
}

function buildTokensFromNormalized(normalized) {
  if (!normalized) return [];
  const tokens = [];
  for (const match of normalized.matchAll(/\S+/g)) {
    const word = match[0];
    const start = match.index || 0;
    tokens.push({ word, start, end: start + word.length });
  }
  return tokens;
}

/** Yields so the tab stays responsive on very long books (paid uploads). */
async function buildTokensFromNormalizedAsync(normalized, onProgress) {
  if (!normalized) return [];
  const tokens = [];
  const re = /\S+/g;
  let m;
  let batch = 0;
  while ((m = re.exec(normalized)) !== null) {
    const word = m[0];
    const start = m.index;
    tokens.push({ word, start, end: start + word.length });
    batch++;
    if (batch >= 12000) {
      batch = 0;
      if (typeof onProgress === "function") onProgress(tokens.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return tokens;
}

function tokenizeWithPositions(text) {
  const normalized = normalizeText(text);
  if (!normalized) return { normalized: "", tokens: [] };
  return { normalized, tokens: buildTokensFromNormalized(normalized) };
}

/** Tokenize without collapsing spaces — keeps indices aligned with the textarea while editing. */
function tokenizeWithPositionsRaw(text) {
  const s = String(text ?? "");
  if (!s.trim()) return { normalized: "", tokens: [] };
  const tokens = [];
  for (const match of s.matchAll(/\S+/g)) {
    const word = match[0];
    const start = match.index || 0;
    tokens.push({ word, start, end: start + word.length });
  }
  return { normalized: s, tokens };
}

function significantCharIndices(w) {
  const idx = [];
  for (let i = 0; i < w.length; i++) {
    if (COUNTS_FOR_PIVOT.test(w[i])) idx.push(i);
  }
  return idx;
}

/**
 * Middle letter among significant (letter/digit) chars only; punctuation stays in left/right slices.
 * e.g. 15 letters → 7 + 1 + 7; trailing ",." do not change which letter is centred.
 */
function splitWordForPivot(word) {
  const w = String(word || "");
  const L = w.length;
  if (L === 0) return { left: "", pivot: "", right: "" };

  const sig = significantCharIndices(w);
  if (sig.length === 0) {
    const mid = Math.floor((L - 1) / 2);
    return {
      left: w.slice(0, mid),
      pivot: w[mid] || "",
      right: w.slice(mid + 1),
    };
  }

  const n = sig.length;
  const centerSig = Math.floor((n - 1) / 2);
  const pivotIdx = sig[centerSig];
  return {
    left: w.slice(0, pivotIdx),
    pivot: w[pivotIdx] || "",
    right: w.slice(pivotIdx + 1),
  };
}

function msPerWordFromWpm(wpm) {
  const safe = clamp(Number(wpm) || 300, 60, 2000);
  return Math.round(60000 / safe);
}

function getExtension(filename) {
  const name = String(filename || "").toLowerCase();
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1) : "";
}

function isLikelyTextFile(ext) {
  return new Set([
    "txt", "md", "markdown", "csv", "tsv", "json", "xml",
    "html", "htm", "js", "ts", "css", "py", "java", "c",
    "cpp", "h", "hpp", "go", "rs", "rb", "php", "yaml",
    "yml", "log", "rtf",
  ]).has(ext);
}

const PLAY_SVG = '<polygon points="9 6.5 17 12 9 17.5 9 6.5"/>';
const PAUSE_SVG = '<rect x="7" y="5" width="4" height="14" rx="1"/><rect x="13" y="5" width="4" height="14" rx="1"/>';

async function restoreSupabaseSessionToLegacyLocals() {
  if (typeof window.createSwSupabaseClient !== "function") return;
  const client = window.createSwSupabaseClient();
  if (!client) return;
  try {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (session?.user?.email) {
      localStorage.setItem("singlewordSessionEmail", session.user.email);
      localStorage.setItem("singlewordConnectedAccount", "1");
    }
  } catch {
    /* ignore */
  }
}

/** Fase 2: sync paid flag from API using Supabase session (requires SINGLEWORD_API_URL in supabase-config.js). */
async function syncEntitlementFromApi() {
  const mistaken =
    typeof window.__SUPABASE_SINGLEWORD_API_URL === "string"
      ? window.__SUPABASE_SINGLEWORD_API_URL
      : "";
  const primary = typeof window.__SINGLEWORD_API_URL === "string" ? window.__SINGLEWORD_API_URL : "";
  const raw = (primary || mistaken).trim().replace(/\/+$/, "");
  if (!raw) return;
  if (typeof window.createSwSupabaseClient !== "function") return;
  const client = window.createSwSupabaseClient();
  if (!client) return;
  try {
    const {
      data: { session },
    } = await client.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch(`${raw}/api/me/entitlement`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const body = await res.json();
    if (typeof body.paid === "boolean") {
      localStorage.setItem("singlewordPaid", body.paid ? "1" : "0");
    }
  } catch {
    /* ignore — offline or API down keeps last localStorage value */
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await restoreSupabaseSessionToLegacyLocals();
  await syncEntitlementFromApi();
  const textInput = byId("textInput");
  const textMirror = byId("textMirror");
  const fileInput = byId("fileInput");
  const resetBtn = byId("resetBtn");
  const limitModal = byId("limitModal");
  const limitTitle = byId("limitTitle");
  const limitMessage = byId("limitMessage");
  const limitPrimaryBtn = byId("limitPrimaryBtn");
  const limitSignUpBtn = byId("limitSignUpBtn");

  const wpmRange = byId("wpmRange");
  const wpmOut = byId("wpmOut");
  const fontRange = byId("fontRange");
  const fontOut = byId("fontOut");

  const pivotColor = byId("pivotColor");
  const pivotColorHex = byId("pivotColorHex");

  const backBtn = byId("backBtn");
  const playPauseBtn = byId("playPauseBtn");
  const playPauseIcon = byId("playPauseIcon");
  const nextBtn = byId("nextBtn");

  const progressBar = byId("progressBar");
  const counter = byId("counter");
  const progressPaywall = byId("progressPaywall");
  const progressBuyBtn = byId("progressBuyBtn");

  const wordLeft = byId("wordLeft");
  const wordPivot = byId("wordPivot");
  const wordRight = byId("wordRight");
  const hint = byId("hint");
  const libraryList = byId("libraryList");
  const libraryEmpty = byId("libraryEmpty");
  const clearLibraryBtn = byId("clearLibraryBtn");

  const root = document.documentElement;

  let words = [];
  let tokens = [];
  let index = 0;
  let isPlaying = false;
  let timerId = null;
  let preferredSource = "paste";
  let canFollowPaste = false;
  const FREE_WORD_LIMIT = 1000;
  /** Max words in the Source box per paste/session chunk; same cap for free-tier single load. */
  const PASTE_PANEL_MAX_WORDS = 1000;
  let wordsUsed = Number(localStorage.getItem("singlewordWordsUsed") || "0");
  let hasConnectedAccount = localStorage.getItem("singlewordConnectedAccount") === "1";
  let hasPaid = localStorage.getItem("singlewordPaid") === "1";
  let freeLimitBlocked = false;
  /** Token count after last successful textarea sync (for free-tier delta, not double-counting edits). */
  let lastCommittedTokenCount = 0;
  let textareaSyncTimer = null;
  /** Debounced IndexedDB write for paid paste → Your library. */
  let paidPasteLibraryTimer = null;
  /** IndexedDB book id (fingerprint for files, fixed id for paste) for progress + library list. */
  let activeBookId = null;
  let progressSaveTimer = null;

  /** Paid large-book mode: full text kept in memory, not in the textarea (keeps UI fast). */
  let fileCorpusText = "";
  let useFileCorpusBuffer = false;

  /** Paid: allow large uploads; hard cap avoids tab crashes. Free: smaller cap saves slow loads before paywall. */
  const MAX_FILE_BYTES_PAID = 100 * 1024 * 1024;
  const MAX_FILE_BYTES_FREE = 4 * 1024 * 1024;
  /** After normalization — safety ceiling for paid “full book” in memory. */
  const MAX_CORPUS_CHARS_PAID = 28_000_000;
  /** Above this, paid file loads use buffer mode (no giant textarea / mirror DOM). */
  const LARGE_CORPUS_BUFFER_CHARS = 100_000;
  const LARGE_CORPUS_BUFFER_WORDS = 45_000;
  /** Use incremental indexing so the tab doesn’t freeze on long books. */
  const ASYNC_TOKENIZE_MIN_CHARS = 35_000;
  /** Max length for a library item title (paste or upload). */
  const LIBRARY_TITLE_MAX = 120;
  /** Single library row for Source paste (paid); content updates in place — not content-hash ids. */
  const PASTE_LIBRARY_BOOK_ID = "singleword-paste-document";

  /**
   * Max word tokens allowed in the Source textarea right now.
   * Paid: panel chunk size only. Free: cannot exceed lifetime free quota (FREE_WORD_LIMIT vs wordsUsed).
   */
  function getPasteWordHardCap() {
    if (hasPaid || useFileCorpusBuffer) return PASTE_PANEL_MAX_WORDS;
    return Math.min(
      PASTE_PANEL_MAX_WORDS,
      Math.max(0, FREE_WORD_LIMIT - wordsUsed + lastCommittedTokenCount)
    );
  }

  function getCorpusText() {
    return useFileCorpusBuffer && fileCorpusText ? fileCorpusText : String(textInput.value || "");
  }

  function getCorpusLength() {
    return getCorpusText().length;
  }

  function saveLimitState() {
    localStorage.setItem("singlewordWordsUsed", String(wordsUsed));
    localStorage.setItem("singlewordConnectedAccount", hasConnectedAccount ? "1" : "0");
    localStorage.setItem("singlewordPaid", hasPaid ? "1" : "0");
  }

  /** Free tier: no playback or scrubbing once quota is hit (paid users exempt). */
  function isFreeTierLocked() {
    return !hasPaid && (wordsUsed >= FREE_WORD_LIMIT || freeLimitBlocked);
  }

  function updateLimitGateUi() {
    if (!hasConnectedAccount) {
      limitTitle.textContent = "Sign in to continue";
      limitMessage.textContent = `You reached the free limit (${FREE_WORD_LIMIT.toLocaleString()} words). Open Account (top right) to sign in, or use Create account if you’re new (preview — email and password on this device).`;
      limitPrimaryBtn.textContent = "Sign in";
      if (limitSignUpBtn) limitSignUpBtn.hidden = false;
      return;
    }

    if (!hasPaid) {
      limitTitle.textContent = "Activate paid plan";
      limitMessage.textContent = "Account connected. Complete payment to keep using Single word.";
      limitPrimaryBtn.textContent = "Pay now";
      if (limitSignUpBtn) limitSignUpBtn.hidden = true;
      return;
    }

    limitTitle.textContent = "Plan active";
    limitMessage.textContent = "You now have paid access.";
    limitPrimaryBtn.textContent = "Continue";
    if (limitSignUpBtn) limitSignUpBtn.hidden = true;
  }

  function openLimitModal() {
    updateLimitGateUi();
    if (typeof limitModal.showModal === "function") limitModal.showModal();
  }

  function syncMirrorScroll() {
    textMirror.scrollTop = textInput.scrollTop;
    textMirror.scrollLeft = textInput.scrollLeft;
  }

  function renderPasteMirror() {
    if (useFileCorpusBuffer && fileCorpusText) {
      syncMirrorScroll();
      const tok = tokens[index];
      if (!tok) {
        textMirror.innerHTML = "";
        return;
      }
      const { plain, html } = buildViewportSnippet(fileCorpusText, tok);
      textInput.value = plain;
      textMirror.innerHTML = `<div class="field__mirror-viewport">${html}</div>`;
      return;
    }

    const text = String(textInput.value || "");
    syncMirrorScroll();
    if (!text) {
      textMirror.innerHTML = "";
      return;
    }

    if (!canFollowPaste || !tokens.length) {
      textMirror.textContent = text;
      return;
    }

    const parts = [];
    for (let i = 0; i < tokens.length; i++) {
      if (i > 0) parts.push(" ");
      const t = tokens[i];
      if (t.start >= t.end || t.end > text.length) {
        textMirror.textContent = text;
        return;
      }
      const slice = escapeHtml(text.slice(t.start, t.end));
      const inner = i === index ? `<mark class="field__mark">${slice}</mark>` : slice;
      parts.push(`<span class="field__word" data-wi="${i}" title="Click to jump the reader here">${inner}</span>`);
    }
    textMirror.innerHTML = parts.join("");
  }

  function wordIndexFromPointer(clientX, clientY) {
    textInput.style.pointerEvents = "none";
    const under = document.elementFromPoint(clientX, clientY);
    textInput.style.pointerEvents = "";
    if (!under) return null;
    const el = under.nodeType === Node.TEXT_NODE ? under.parentElement : under;
    const wordEl = el && el.closest ? el.closest(".field__word") : null;
    if (!wordEl || !textMirror.contains(wordEl)) return null;
    const wi = Number(wordEl.dataset.wi);
    return Number.isFinite(wi) ? wi : null;
  }

  function goToWordAtPointer(clientX, clientY) {
    if (useFileCorpusBuffer) return false;
    if (!canFollowPaste || !tokens.length || !words.length) return false;
    const wi = wordIndexFromPointer(clientX, clientY);
    if (wi == null) return false;
    index = clamp(wi, 0, words.length - 1);
    pause();
    renderCurrentWord();
    const t = tokens[index];
    if (t) {
      textInput.focus();
      /* Collapsed caret so the default blue selection box does not cover the mirror */
      textInput.setSelectionRange(t.start, t.start);
    }
    return true;
  }

  function syncPasteHighlight() {
    const token = tokens[index];
    if (!token || !canFollowPaste) {
      renderPasteMirror();
      return;
    }
    if (useFileCorpusBuffer) {
      renderPasteMirror();
      return;
    }
    const ratio = token.start / Math.max(1, getCorpusLength());
    textInput.scrollTop = ratio * Math.max(0, textInput.scrollHeight - textInput.clientHeight);
    renderPasteMirror();
  }

  function setButtonsEnabled(enabled) {
    const locked = isFreeTierLocked();
    const ok = enabled && !locked;
    backBtn.disabled = !ok;
    playPauseBtn.disabled = !ok;
    nextBtn.disabled = !ok;
    progressBar.disabled = locked || !words.length || words.length <= 1;
  }

  function updateCounterAndProgress() {
    const total = words.length;
    if (hasPaid) {
      counter.textContent = `${total ? index + 1 : 0} / ${total}`;
    } else {
      const remaining = Math.max(0, FREE_WORD_LIMIT - wordsUsed);
      counter.textContent = `Free mode: ${remaining} / ${FREE_WORD_LIMIT} words left`;
    }
    if (total <= 1) {
      progressBar.min = 0;
      progressBar.value = 0;
      progressBar.max = 1;
      return;
    }
    progressBar.min = 0;
    progressBar.max = total - 1;
    progressBar.value = index;
    updateProgressPaywallUi();
  }

  function updateProgressPaywallUi() {
    const reachedFreeLimit = !hasPaid && (wordsUsed >= FREE_WORD_LIMIT || freeLimitBlocked);
    progressPaywall.hidden = !reachedFreeLimit;
    if (reachedFreeLimit) pause();
    setButtonsEnabled(words.length > 0);
  }

  function renderCurrentWord() {
    const total = words.length;
    if (!total) {
      wordLeft.textContent = "";
      wordPivot.textContent = "";
      wordRight.textContent = "";
      hint.textContent = "Paste or type text above — the reader syncs a moment after you edit.";
      textInput.classList.remove("field__textarea--wordNav");
      renderPasteMirror();
      syncMirrorScroll();
      return;
    }
    index = clamp(index, 0, total - 1);
    const { left, pivot, right } = splitWordForPivot(words[index]);
    wordLeft.textContent = left;
    wordPivot.textContent = pivot;
    wordRight.textContent = right;
    textInput.classList.toggle("field__textarea--wordNav", Boolean(canFollowPaste && total > 0));
    syncPasteHighlight();
    if (!useFileCorpusBuffer) hint.textContent = "";
    updateCounterAndProgress();
    scheduleSaveReadingProgress();
  }

  function stopTimer() {
    if (timerId != null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function updatePlayPauseUi() {
    playPauseBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    playPauseIcon.innerHTML = isPlaying ? PAUSE_SVG : PLAY_SVG;
  }

  function pause() {
    isPlaying = false;
    stopTimer();
    updatePlayPauseUi();
  }

  function step(delta) {
    if (!words.length) return;
    if (isFreeTierLocked()) return;
    index = clamp(index + delta, 0, words.length - 1);
    renderCurrentWord();
  }

  function atEnd() {
    return words.length > 0 && index >= words.length - 1;
  }

  function tick() {
    if (!isPlaying) return;
    if (isFreeTierLocked()) {
      pause();
      return;
    }
    if (atEnd()) {
      pause();
      return;
    }
    index += 1;
    renderCurrentWord();
  }

  function startOrRestartTimer() {
    stopTimer();
    timerId = setInterval(tick, msPerWordFromWpm(wpmRange.value));
  }

  function play() {
    if (!words.length) return;
    if (isFreeTierLocked()) return;
    if (atEnd()) {
      index = 0;
      renderCurrentWord();
    }
    isPlaying = true;
    updatePlayPauseUi();
    startOrRestartTimer();
  }

  function togglePlayPause() {
    if (!words.length) return;
    if (isFreeTierLocked()) return;
    if (isPlaying) pause();
    else play();
  }

  async function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("Failed to read file."));
      r.onload = () => resolve(r.result);
      r.readAsArrayBuffer(file);
    });
  }

  async function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("Failed to read file."));
      r.onload = () => resolve(String(r.result || ""));
      r.readAsText(file);
    });
  }

  async function extractPdfText(ab) {
    const pdfjsLib = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.min.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs";
    const doc = await pdfjsLib.getDocument({ data: ab }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return pages.join(" ");
  }

  async function extractDocxText(ab) {
    if (!window.mammoth || !window.mammoth.extractRawText) throw new Error("DOCX parser unavailable.");
    const result = await window.mammoth.extractRawText({ arrayBuffer: ab });
    return String(result.value || "");
  }

  async function extractTextFromFile(file) {
    const ext = getExtension(file.name);
    const mime = String(file.type || "").toLowerCase();

    if (ext === "pdf" || mime.includes("pdf")) return extractPdfText(await readFileAsArrayBuffer(file));

    if (ext === "docx" || mime.includes("officedocument.wordprocessingml.document") || mime.includes("msword"))
      return extractDocxText(await readFileAsArrayBuffer(file));

    if (isLikelyTextFile(ext) || mime.startsWith("text/") || !mime) {
      try {
        return await readFileAsText(file);
      } catch (_) {
        const ab = await readFileAsArrayBuffer(file);
        return new TextDecoder("utf-8", { fatal: false }).decode(ab);
      }
    }

    const ab = await readFileAsArrayBuffer(file);
    return new TextDecoder("utf-8", { fatal: false }).decode(ab);
  }

  function handleLoadError(err) {
    pause();
    setButtonsEnabled(false);
    hint.textContent = err?.message || "Failed to load text.";
  }

  function cancelTextareaSync() {
    if (textareaSyncTimer != null) {
      clearTimeout(textareaSyncTimer);
      textareaSyncTimer = null;
    }
  }

  function cancelPaidPasteLibraryTimer() {
    if (paidPasteLibraryTimer != null) {
      clearTimeout(paidPasteLibraryTimer);
      paidPasteLibraryTimer = null;
    }
  }

  function schedulePersistPaidPasteToLibrary() {
    if (!hasPaid || useFileCorpusBuffer || preferredSource !== "paste") return;
    cancelPaidPasteLibraryTimer();
    paidPasteLibraryTimer = setTimeout(() => {
      paidPasteLibraryTimer = null;
      void persistPaidPasteToLibraryNow();
    }, 550);
  }

  /** One library row for paid paste; always upserts `PASTE_LIBRARY_BOOK_ID`. */
  async function persistPaidPasteToLibraryNow() {
    if (!hasPaid || useFileCorpusBuffer || preferredSource !== "paste") return;
    const norm = normalizeText(textInput.value);
    if (!norm.trim() || !words.length) {
      activeBookId = null;
      try {
        await idbDeleteBook(PASTE_LIBRARY_BOOK_ID);
      } catch (_) {
        /* ignore */
      }
      await renderLibrary().catch(() => {});
      return;
    }

    let prev = null;
    try {
      prev = await idbGetBook(PASTE_LIBRARY_BOOK_ID);
    } catch (_) {
      /* ignore */
    }
    const titleRaw =
      (prev && typeof prev.filename === "string" && prev.filename.trim() && prev.filename) || "Pasted text";
    const title = String(titleRaw).trim().slice(0, LIBRARY_TITLE_MAX);

    activeBookId = PASTE_LIBRARY_BOOK_ID;
    try {
      await idbPutBook({
        id: PASTE_LIBRARY_BOOK_ID,
        filename: title,
        text: norm,
        wordCount: words.length,
        savedIndex: index,
        updatedAt: Date.now(),
      });
      await pruneOldBooks(PASTE_LIBRARY_BOOK_ID);
      await renderLibrary();
    } catch (_) {
      /* ignore */
    }
  }

  function scheduleTextareaSync() {
    cancelTextareaSync();
    textareaSyncTimer = setTimeout(() => {
      textareaSyncTimer = null;
      commitPasteQuotaOnly();
    }, 400);
  }

  /** Truncate raw textarea string to first `maxWords` whitespace-separated tokens (indices use original string). */
  function trimTextareaToMaxWords(raw, maxWords) {
    const parsed = tokenizeWithPositionsRaw(raw);
    if (maxWords <= 0) {
      return { text: "", didTrim: parsed.tokens.length > 0 };
    }
    if (parsed.tokens.length <= maxWords) return { text: raw, didTrim: false };
    const last = parsed.tokens[maxWords - 1];
    return { text: raw.slice(0, last.end), didTrim: true };
  }

  const STORAGE_SESSION_EMAIL = "singlewordSessionEmail";

  const settingsConnectBtn = document.getElementById("settingsConnectBtn");
  const settingsAccountStatus = document.getElementById("settingsAccountStatus");
  const accountSignInForm = document.getElementById("accountSignInForm");
  const accountEmail = document.getElementById("accountEmail");
  const accountPassword = document.getElementById("accountPassword");
  const accountSignedIn = document.getElementById("accountSignedIn");
  const accountSignedInSummary = document.getElementById("accountSignedInSummary");
  const accountSignOutBtn = document.getElementById("accountSignOutBtn");
  const accountForgotBtn = document.getElementById("accountForgotBtn");
  const forgotPasswordDialog = document.getElementById("forgotPasswordDialog");

  function sessionEmailDisplay() {
    return localStorage.getItem(STORAGE_SESSION_EMAIL) || "";
  }

  function openAccountMenuAndFocusSignIn() {
    const panel = document.getElementById("userMenuPanelApp");
    const trigger = document.getElementById("userMenuBtnApp");
    if (panel && trigger) {
      document.querySelectorAll("[data-user-menu] .user-menu__panel").forEach((p) => {
        p.hidden = true;
      });
      document.querySelectorAll("[data-user-menu] .user-menu__trigger").forEach((t) => {
        t.setAttribute("aria-expanded", "false");
      });
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
    }
    if (accountEmail && !hasConnectedAccount) {
      setTimeout(() => accountEmail.focus(), 80);
    }
  }

  function trySignInFromForm() {
    if (hasConnectedAccount) return;
    const email = (accountEmail && accountEmail.value.trim()) || "";
    const password = (accountPassword && accountPassword.value) || "";
    if (!email) {
      hint.textContent = "Enter your email to sign in.";
      if (accountEmail) accountEmail.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      hint.textContent = "Enter a valid email address.";
      if (accountEmail) accountEmail.focus();
      return;
    }
    if (!password.length) {
      hint.textContent = "Enter your password.";
      if (accountPassword) accountPassword.focus();
      return;
    }
    localStorage.setItem(STORAGE_SESSION_EMAIL, email);
    if (accountPassword) accountPassword.value = "";
    applyConnectedAccountPreview();
    hint.textContent = `Signed in (preview) as ${email}. Saved library is available.`;
    closeAccountMenuIfOpen();
  }

  function signOutPreview() {
    hasConnectedAccount = false;
    localStorage.removeItem(STORAGE_SESSION_EMAIL);
    saveLimitState();
    updateLimitGateUi();
    renderLibrary().catch(() => {});
    document.dispatchEvent(new CustomEvent("singleword-account-disconnected"));
    updateSettingsAccountUi();
    hint.textContent = "Signed out (preview). Sign in again from Account (top right).";
  }

  function updateUserMenuSignInUi() {
    const heading = document.getElementById("userMenuAccountHeading");
    if (heading) heading.textContent = hasConnectedAccount ? "Signed in" : "Sign in";
  }

  function updateSettingsAccountUi() {
    const email = sessionEmailDisplay();
    if (accountSignInForm && accountSignedIn) {
      if (hasConnectedAccount) {
        accountSignInForm.hidden = true;
        accountSignedIn.hidden = false;
        if (accountSignedInSummary) {
          accountSignedInSummary.textContent = hasPaid
            ? `Signed in (preview) as ${email || "your account"} — paid plan active.`
            : `Signed in (preview) as ${email || "your account"} — finish payment when you reach the free word limit.`;
        }
      } else {
        accountSignInForm.hidden = false;
        accountSignedIn.hidden = true;
        if (settingsAccountStatus) {
          settingsAccountStatus.textContent =
            "Not signed in — use Sign in or Create account (opens full page). Preview only; no server.";
        }
      }
    }
    updateUserMenuSignInUi();
  }

  function signInPreviewFromAnywhere() {
    if (hasConnectedAccount) return;
    const email = (accountEmail && accountEmail.value.trim()) || "";
    const password = (accountPassword && accountPassword.value) || "";
    if (email && password) {
      trySignInFromForm();
      return;
    }
    openAccountMenuAndFocusSignIn();
    hint.textContent =
      "Enter email and password here, or open Create account in the same menu (preview).";
  }

  function closeAccountMenuIfOpen() {
    const panel = document.getElementById("userMenuPanelApp");
    const trigger = document.getElementById("userMenuBtnApp");
    if (panel && !panel.hidden && trigger) {
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    }
  }

  function applyConnectedAccountPreview() {
    hasConnectedAccount = true;
    saveLimitState();
    updateLimitGateUi();
    renderLibrary().catch(() => {});
    document.dispatchEvent(new CustomEvent("singleword-account-connected"));
    updateSettingsAccountUi();
  }

  /**
   * Keep tokens, mirror, and reader in sync with the textarea on every edit (caret, delete, paste behave normally).
   * Paid + paste: tokenize normalized text so IndexedDB matches library resume; free users keep raw positions.
   */
  function syncPasteFromTextareaImmediate() {
    if (useFileCorpusBuffer) return;
    if (!hasPaid) {
      activeBookId = null;
    }
    pause();

    if (preferredSource === "paste" && !useFileCorpusBuffer) {
      const cap = getPasteWordHardCap();
      const trimmed = trimTextareaToMaxWords(textInput.value, cap);
      if (trimmed.didTrim || textInput.value !== trimmed.text) {
        textInput.value = trimmed.text;
        if (!hasPaid && cap < PASTE_PANEL_MAX_WORDS) {
          hint.textContent = `Free plan: you’ve used your ${FREE_WORD_LIMIT.toLocaleString()} words in the Source box. Remove text or upgrade to paste more.`;
        } else {
          hint.textContent = `The Source box is limited to ${PASTE_PANEL_MAX_WORDS.toLocaleString()} words at a time. Extra words were removed.`;
        }
      }
    }

    let parsed;
    if (hasPaid && preferredSource === "paste") {
      parsed = tokenizeWithPositions(textInput.value);
      tokens = parsed.tokens;
      words = tokens.map((t) => t.word);
      if (parsed.normalized && textInput.value !== parsed.normalized) {
        textInput.value = parsed.normalized;
      }
    } else {
      parsed = tokenizeWithPositionsRaw(textInput.value);
      tokens = parsed.tokens;
      words = tokens.map((t) => t.word);
    }

    preferredSource = "paste";
    canFollowPaste = words.length > 0;
    index = clamp(index, 0, Math.max(0, words.length - 1));

    if (hasPaid && words.length) {
      activeBookId = PASTE_LIBRARY_BOOK_ID;
      schedulePersistPaidPasteToLibrary();
    } else {
      activeBookId = null;
      if (hasPaid && preferredSource === "paste" && !words.length) {
        cancelPaidPasteLibraryTimer();
        void persistPaidPasteToLibraryNow();
      }
    }

    renderPasteMirror();
    renderCurrentWord();
    setButtonsEnabled(words.length > 0);
  }

  /** Debounced: free-tier word accounting only (does not block typing or word-pick UX). */
  function commitPasteQuotaOnly(quotaRetry) {
    if (useFileCorpusBuffer) return;
    const parsed =
      hasPaid && preferredSource === "paste"
        ? tokenizeWithPositions(textInput.value)
        : tokenizeWithPositionsRaw(textInput.value);
    const incoming = parsed.tokens.length;
    const delta = Math.max(0, incoming - lastCommittedTokenCount);

    if (!hasPaid && wordsUsed + delta > FREE_WORD_LIMIT) {
      const maxW = getPasteWordHardCap();
      const trimmed = trimTextareaToMaxWords(textInput.value, maxW);
      if (trimmed.text !== textInput.value && !quotaRetry) {
        textInput.value = trimmed.text;
        syncPasteFromTextareaImmediate();
        commitPasteQuotaOnly(true);
        return;
      }
      freeLimitBlocked = true;
      updateProgressPaywallUi();
      if (!limitModal.open) openLimitModal();
      hint.textContent = "Free limit reached — remove text from Source or upgrade to paste more.";
      return;
    }

    freeLimitBlocked = false;
    if (!hasPaid) {
      wordsUsed += delta;
    }
    lastCommittedTokenCount = incoming;
    saveLimitState();
    updateProgressPaywallUi();
  }

  async function renderLibrary() {
    let books = [];
    try {
      books = await idbGetAllBooks();
    } catch {
      libraryList.innerHTML = "";
      libraryEmpty.hidden = false;
      libraryEmpty.textContent = "Could not read saved books (storage blocked or unavailable).";
      document.dispatchEvent(new CustomEvent("singleword-library-updated"));
      return;
    }
    books.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const lockedEl = document.getElementById("libraryPanelLocked");
    const bodyEl = document.getElementById("libraryPanelBody");
    const showLibraryBody = hasConnectedAccount || books.length > 0;
    if (lockedEl && bodyEl) {
      lockedEl.hidden = showLibraryBody;
      bodyEl.hidden = !showLibraryBody;
    }

    if (!showLibraryBody) {
      libraryList.innerHTML = "";
      libraryEmpty.hidden = false;
      libraryEmpty.textContent =
        "Sign in or create an account from Account (top right) to see saved files.";
      document.dispatchEvent(new CustomEvent("singleword-library-updated"));
      return;
    }

    libraryEmpty.hidden = books.length > 0;
    libraryList.innerHTML = "";
    libraryEmpty.textContent =
      "No saved books yet. Choose a file above — it loads automatically and your place is saved in your library.";
    for (const b of books) {
      const pct = b.wordCount > 0 ? Math.round(((Math.min(b.savedIndex ?? 0, b.wordCount - 1) + 1) / b.wordCount) * 100) : 0;
      const card = document.createElement("article");
      card.className = "library-card";
      const main = document.createElement("div");
      main.className = "library-card__main";
      const title = document.createElement("h3");
      title.className = "library-card__title";
      title.textContent = b.filename || "Untitled";
      const meta = document.createElement("p");
      meta.className = "library-card__meta";
      const si = typeof b.savedIndex === "number" ? b.savedIndex : 0;
      meta.textContent = `${b.wordCount.toLocaleString()} words · ${pct}% read · stopped at word ${Math.min(si + 1, b.wordCount)}`;
      main.appendChild(title);
      main.appendChild(meta);
      const actions = document.createElement("div");
      actions.className = "library-card__actions";
      const resumeBtn = document.createElement("button");
      resumeBtn.type = "button";
      resumeBtn.className = "cta cta--small";
      resumeBtn.textContent = "Resume";
      resumeBtn.setAttribute("data-lib-action", "resume");
      resumeBtn.setAttribute("data-lib-id", b.id);
      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "cta cta--ghost cta--small";
      renameBtn.textContent = "Rename";
      renameBtn.setAttribute("data-lib-action", "rename");
      renameBtn.setAttribute("data-lib-id", b.id);
      renameBtn.setAttribute("aria-label", `Rename ${b.filename || "item"}`);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "cta cta--ghost cta--small";
      removeBtn.textContent = "Remove";
      removeBtn.setAttribute("data-lib-action", "remove");
      removeBtn.setAttribute("data-lib-id", b.id);
      actions.appendChild(resumeBtn);
      actions.appendChild(renameBtn);
      actions.appendChild(removeBtn);
      card.appendChild(main);
      card.appendChild(actions);
      libraryList.appendChild(card);
    }
    document.dispatchEvent(new CustomEvent("singleword-library-updated"));
  }

  function scheduleSaveReadingProgress() {
    if (!activeBookId || !words.length) return;
    if (progressSaveTimer != null) clearTimeout(progressSaveTimer);
    progressSaveTimer = setTimeout(async () => {
      progressSaveTimer = null;
      try {
        const rec = await idbGetBook(activeBookId);
        if (!rec) return;
        rec.savedIndex = index;
        rec.updatedAt = Date.now();
        await idbPutBook(rec);
        renderLibrary();
      } catch (_) {
        /* ignore */
      }
    }, 450);
  }

  /**
   * Apply normalized text from a file load or library resume. Full text is stored in IndexedDB for resume.
   * @param {{ resume?: boolean, savedIndex?: number, bookId?: string }} opts — `bookId` keeps library key when resuming (e.g. paste slot vs content hash).
   */
  async function applyLoadedCorpus(sourceText, filename, opts = {}) {
    const resume = Boolean(opts.resume);
    if (!sourceText.trim()) {
      hint.textContent = "No readable text found. Try another file or paste text.";
      throw new Error("No readable text in that file.");
    }

    if (!resume) {
      if (hasPaid && sourceText.length > MAX_CORPUS_CHARS_PAID) {
        throw new Error(
          "This book is too large to load safely in the browser. Try a smaller export or split into parts."
        );
      }
      const rough = roughWordCount(sourceText);
      if (!hasPaid && wordsUsed + rough > FREE_WORD_LIMIT) {
        freeLimitBlocked = true;
        updateProgressPaywallUi();
        openLimitModal();
        throw new Error("Free limit reached.");
      }
    }

    let tokensBuilt;
    if (sourceText.length >= ASYNC_TOKENIZE_MIN_CHARS) {
      hint.textContent = "Indexing words…";
      tokensBuilt = await buildTokensFromNormalizedAsync(sourceText, (n) => {
        hint.textContent = `Indexing… ${n.toLocaleString()} words`;
      });
    } else {
      tokensBuilt = buildTokensFromNormalized(sourceText);
    }

    const incoming = tokensBuilt.length;
    if (!resume) {
      const wouldExceedFree = !hasPaid && wordsUsed + incoming > FREE_WORD_LIMIT;
      if (wouldExceedFree) {
        freeLimitBlocked = true;
        updateProgressPaywallUi();
        openLimitModal();
        throw new Error("Free limit reached.");
      }
      freeLimitBlocked = false;
      if (!hasPaid) wordsUsed += incoming;
    }

    lastCommittedTokenCount = incoming;
    saveLimitState();
    tokens = tokensBuilt;
    words = tokens.map((t) => t.word);

    const storeId =
      typeof opts.bookId === "string" && opts.bookId.length > 0 ? opts.bookId : corpusFingerprint(sourceText);
    let existingBook = null;
    try {
      existingBook = await idbGetBook(storeId);
    } catch (_) {
      /* ignore */
    }

    let startIndex = 0;
    if (resume && opts && typeof opts.savedIndex === "number") {
      startIndex = clamp(opts.savedIndex, 0, Math.max(0, words.length - 1));
    } else if (!resume && existingBook && typeof existingBook.savedIndex === "number") {
      startIndex = clamp(existingBook.savedIndex, 0, Math.max(0, words.length - 1));
    }

    const useBuffer =
      hasPaid &&
      (sourceText.length >= LARGE_CORPUS_BUFFER_CHARS || words.length >= LARGE_CORPUS_BUFFER_WORDS);

    if (useBuffer) {
      useFileCorpusBuffer = true;
      fileCorpusText = sourceText;
      textInput.readOnly = true;
      textInput.rows = 1;
      textInput.classList.add("field__textarea--corpusBuffer", "field__textarea--viewportLine");
      canFollowPaste = false;
    } else {
      useFileCorpusBuffer = false;
      fileCorpusText = "";
      textInput.readOnly = false;
      textInput.rows = 4;
      textInput.classList.remove("field__textarea--corpusBuffer", "field__textarea--viewportLine");
      textInput.value = sourceText;
      canFollowPaste = words.length > 0;
    }

    activeBookId = storeId;
    index = startIndex;

    const defaultUploadName = (filename || "Uploaded file").trim().slice(0, LIBRARY_TITLE_MAX);
    const mergedTitle =
      existingBook && typeof existingBook.filename === "string" && existingBook.filename.trim()
        ? existingBook.filename.trim().slice(0, LIBRARY_TITLE_MAX)
        : defaultUploadName;

    await idbPutBook({
      id: storeId,
      filename: mergedTitle,
      text: sourceText,
      wordCount: words.length,
      savedIndex: index,
      updatedAt: Date.now(),
    });
    await pruneOldBooks(storeId);

    pause();
    renderCurrentWord();
    setButtonsEnabled(words.length > 0);
    updateProgressPaywallUi();
    renderLibrary();

    if (!words.length) {
      hint.textContent = "No readable text found. Try another file or paste text.";
    } else if (useBuffer) {
      hint.textContent =
        "Large book: only one line of text is shown around your current word so the page stays fast. Your place is saved in Your library.";
    } else {
      hint.textContent = "";
    }
  }

  async function resumeFromLibrary(bookId) {
    const rec = await idbGetBook(bookId);
    if (!rec || !rec.text) {
      hint.textContent = "Could not open that book — try loading the file again.";
      return;
    }
    preferredSource = bookId === PASTE_LIBRARY_BOOK_ID ? "paste" : "file";
    hint.textContent = "Opening saved book…";
    try {
      await applyLoadedCorpus(rec.text, rec.filename, {
        resume: true,
        savedIndex: rec.savedIndex,
        bookId,
      });
    } catch (err) {
      handleLoadError(err);
    }
  }

  /** Load text from file; corpus is saved locally for resume (see Your library). */
  async function loadText() {
    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (!file) {
      hint.textContent = "Choose a file to load.";
      throw new Error("No file selected.");
    }

    const maxBytes = hasPaid ? MAX_FILE_BYTES_PAID : MAX_FILE_BYTES_FREE;
    if (file.size > maxBytes) {
      const mb = Math.round(maxBytes / (1024 * 1024));
      throw new Error(
        hasPaid
          ? `This file is larger than the app allows (${mb} MB max). Try splitting the book or exporting a section.`
          : `Free mode: files up to ${mb} MB. Upgrade for much larger uploads.`
      );
    }

    preferredSource = "file";
    hint.textContent = "Reading file…";
    resetBtn.disabled = true;

    try {
      const raw = await extractTextFromFile(file);
      hint.textContent = "Preparing text…";
      await new Promise((r) => setTimeout(r, 0));
      const sourceText = normalizeText(raw);
      await applyLoadedCorpus(sourceText, file.name, { resume: false });
    } finally {
      resetBtn.disabled = false;
    }
  }

  function setWpmUi() {
    wpmOut.textContent = `${wpmRange.value} WPM`;
    if (isPlaying) startOrRestartTimer();
  }

  function setFontUi() {
    const px = `${fontRange.value}px`;
    fontOut.textContent = px;
    root.style.setProperty("--reader-size", px);
  }

  function hexLabel(input) {
    return String(input.value || "#000000").toUpperCase();
  }

  function setPivotColorUi() {
    root.style.setProperty("--pivot-color", pivotColor.value || "#ffffff");
    pivotColorHex.textContent = hexLabel(pivotColor);
    localStorage.setItem("speedReaderPivot", pivotColor.value || "#ffffff");
  }

  function resetAll() {
    pause();
    cancelTextareaSync();
    cancelPaidPasteLibraryTimer();
    words = [];
    tokens = [];
    index = 0;
    preferredSource = "paste";
    canFollowPaste = false;
    freeLimitBlocked = false;
    lastCommittedTokenCount = 0;
    useFileCorpusBuffer = false;
    fileCorpusText = "";
    activeBookId = null;
    if (progressSaveTimer != null) {
      clearTimeout(progressSaveTimer);
      progressSaveTimer = null;
    }
    textInput.readOnly = false;
    textInput.rows = 4;
    textInput.classList.remove("field__textarea--corpusBuffer", "field__textarea--viewportLine");
    textInput.classList.remove("field__textarea--wordNav");
    textInput.value = "";
    fileInput.value = "";
    renderCurrentWord();
    updateCounterAndProgress();
    setButtonsEnabled(false);
    hint.textContent =
      "Paste or type text — the reader updates shortly after you edit. Choose a file above to load longer texts.";
    updateProgressPaywallUi();
    if (hasPaid) {
      void persistPaidPasteToLibraryNow();
    }
  }

  libraryList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-lib-id]");
    if (!btn) return;
    const id = btn.getAttribute("data-lib-id");
    const action = btn.getAttribute("data-lib-action");
    if (!id || !action) return;
    if (action === "resume") {
      resumeFromLibrary(id).catch(handleLoadError);
    } else if (action === "rename") {
      void (async () => {
        try {
          const rec = await idbGetBook(id);
          if (!rec) return;
          const current = String(rec.filename || "Untitled").slice(0, LIBRARY_TITLE_MAX);
          const next = window.prompt("Name this item", current);
          if (next == null) return;
          const trimmed = next.trim().slice(0, LIBRARY_TITLE_MAX);
          if (!trimmed) {
            hint.textContent = "Name can't be empty.";
            return;
          }
          rec.id = id;
          rec.filename = trimmed;
          rec.updatedAt = Date.now();
          await idbPutBook(rec);
          hint.textContent = "";
          await renderLibrary();
          document.dispatchEvent(new CustomEvent("singleword-library-updated"));
        } catch (_) {
          hint.textContent = "Could not rename.";
        }
      })();
    } else if (action === "remove") {
      idbDeleteBook(id).then(async () => {
        if (activeBookId === id) resetAll();
        await renderLibrary();
      });
    }
  });

  clearLibraryBtn.addEventListener("click", () => {
    if (!window.confirm("Remove all saved files from this device? Your current session will reset.")) return;
    idbClearAllBooks()
      .then(() => {
        activeBookId = null;
        resetAll();
        return renderLibrary();
      })
      .catch(() => {
        hint.textContent = "Could not delete files.";
      });
  });

  resetBtn.addEventListener("click", resetAll);
  if (accountSignInForm) {
    accountSignInForm.addEventListener("submit", (e) => {
      e.preventDefault();
      trySignInFromForm();
    });
  }
  if (accountForgotBtn && forgotPasswordDialog) {
    accountForgotBtn.addEventListener("click", () => {
      if (typeof forgotPasswordDialog.showModal === "function") forgotPasswordDialog.showModal();
    });
  }
  if (accountSignOutBtn) {
    accountSignOutBtn.addEventListener("click", () => signOutPreview());
  }
  if (limitSignUpBtn) {
    limitSignUpBtn.addEventListener("click", () => {
      if (limitModal.open) limitModal.close();
      window.location.href = "./login.html?return=app.html&mode=signup";
    });
  }
  limitPrimaryBtn.addEventListener("click", () => {
    if (!hasConnectedAccount) {
      if (limitModal.open) limitModal.close();
      openAccountMenuAndFocusSignIn();
      hint.textContent =
        "Free limit: open Account (top right) to sign in or follow Create account (preview).";
      return;
    }

    if (!hasPaid) {
      hasPaid = true;
      freeLimitBlocked = false;
      saveLimitState();
      if (limitModal.open) limitModal.close();
      hint.textContent = "Payment successful (preview). Paid access unlocked.";
      updateCounterAndProgress();
      updateProgressPaywallUi();
      updateSettingsAccountUi();
      document.dispatchEvent(new CustomEvent("singleword-paid-updated"));
      syncPasteFromTextareaImmediate();
      commitPasteQuotaOnly();
      return;
    }

    if (limitModal.open) limitModal.close();
  });
  playPauseBtn.addEventListener("click", togglePlayPause);
  progressBuyBtn.addEventListener("click", () => {
    openLimitModal();
  });
  backBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));

  wpmRange.addEventListener("input", setWpmUi);
  fontRange.addEventListener("input", setFontUi);
  pivotColor.addEventListener("input", setPivotColorUi);

  progressBar.addEventListener("input", () => {
    if (!words.length) return;
    if (isFreeTierLocked()) return;
    pause();
    index = clamp(Number(progressBar.value) || 0, 0, words.length - 1);
    renderCurrentWord();
  });

  textInput.addEventListener("input", () => {
    preferredSource = "paste";
    syncPasteFromTextareaImmediate();
    scheduleTextareaSync();
  });
  textInput.addEventListener("paste", (e) => {
    if (hasPaid || useFileCorpusBuffer) return;
    if (getPasteWordHardCap() <= 0) {
      e.preventDefault();
      freeLimitBlocked = true;
      updateProgressPaywallUi();
      if (!limitModal.open) openLimitModal();
      hint.textContent = `Free plan: no words left in the Source box (${FREE_WORD_LIMIT.toLocaleString()} total). Upgrade to paste more.`;
    }
  });
  textInput.addEventListener("blur", () => {
    if (textareaSyncTimer != null) {
      cancelTextareaSync();
      commitPasteQuotaOnly();
    }
    cancelPaidPasteLibraryTimer();
    if (hasPaid && !useFileCorpusBuffer && preferredSource === "paste") {
      void persistPaidPasteToLibraryNow();
    }
  });
  textInput.addEventListener("scroll", syncMirrorScroll);

  /**
   * Click a word: move reader + red mark (collapsed caret avoids the blue selection box).
   * Tiny drag still counts as a click; larger move skips so drag-select works.
   */
  let wordNavMouseDown = null;
  textInput.addEventListener(
    "mousedown",
    (e) => {
      if (e.button !== 0) return;
      wordNavMouseDown = { x: e.clientX, y: e.clientY };
    },
    true
  );

  textInput.addEventListener(
    "mouseup",
    (e) => {
      if (e.button !== 0 || !wordNavMouseDown) return;
      const dx = e.clientX - wordNavMouseDown.x;
      const dy = e.clientY - wordNavMouseDown.y;
      wordNavMouseDown = null;
      if (dx * dx + dy * dy > 49) return;
      if (!canFollowPaste || !tokens.length) return;
      goToWordAtPointer(e.clientX, e.clientY);
    },
    true
  );

  textInput.addEventListener("mouseleave", () => {
    wordNavMouseDown = null;
  });

  let wordNavTouchStart = null;
  textInput.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      wordNavTouchStart = { x: t.clientX, y: t.clientY };
    },
    { capture: true, passive: true }
  );

  textInput.addEventListener(
    "touchend",
    (e) => {
      if (!wordNavTouchStart || !canFollowPaste || !tokens.length) return;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) {
        wordNavTouchStart = null;
        return;
      }
      const dx = t.clientX - wordNavTouchStart.x;
      const dy = t.clientY - wordNavTouchStart.y;
      wordNavTouchStart = null;
      if (dx * dx + dy * dy > 100) return;
      goToWordAtPointer(t.clientX, t.clientY);
    },
    { capture: true, passive: true }
  );

  textInput.addEventListener(
    "touchcancel",
    () => {
      wordNavTouchStart = null;
    },
    true
  );
  fileInput.addEventListener("change", () => {
    preferredSource = "file";
    if (fileInput.files && fileInput.files[0]) {
      loadText().catch(handleLoadError);
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    if (!words.length) return;
    if (isFreeTierLocked()) return;
    if (e.code === "Space") {
      e.preventDefault();
      togglePlayPause();
      return;
    }
    if (e.code === "ArrowLeft") {
      e.preventDefault();
      pause();
      step(-1);
      return;
    }
    if (e.code === "ArrowRight") {
      e.preventDefault();
      pause();
      step(1);
    }
  });

  setButtonsEnabled(false);
  updatePlayPauseUi();
  setWpmUi();
  setFontUi();

  const savedPivot = localStorage.getItem("speedReaderPivot");
  if (savedPivot) pivotColor.value = savedPivot;
  setPivotColorUi();
  renderPasteMirror();
  renderCurrentWord();
  updateProgressPaywallUi();
  if (!hasPaid && !words.length) {
    hint.textContent = `Free mode: ${wordsUsed.toLocaleString()} / ${FREE_WORD_LIMIT.toLocaleString()} words used. Paste or type in the Source box — it updates automatically.`;
  }

  (function initPostLoginReturnLink() {
    const el = document.getElementById("navReturnLink");
    if (!el) return;
    let u;
    try {
      u = sessionStorage.getItem("singlewordPostLoginReturn");
    } catch (_) {
      return;
    }
    if (!u) return;
    el.href = u;
    el.hidden = false;
    el.addEventListener("click", () => {
      try {
        sessionStorage.removeItem("singlewordPostLoginReturn");
      } catch (_) {
        /* ignore */
      }
    });
  })();

  updateSettingsAccountUi();
  renderLibrary().catch(() => {
    libraryEmpty.hidden = false;
    libraryEmpty.textContent = "Could not read saved books.";
  });

  window.addEventListener("storage", (e) => {
    if (e.key === "singlewordConnectedAccount") {
      hasConnectedAccount = localStorage.getItem("singlewordConnectedAccount") === "1";
      renderLibrary().catch(() => {});
      document.dispatchEvent(new CustomEvent("singleword-library-updated"));
      updateSettingsAccountUi();
    }
    if (e.key === "singlewordPaid") {
      hasPaid = localStorage.getItem("singlewordPaid") === "1";
      updateSettingsAccountUi();
      updateCounterAndProgress();
      updateProgressPaywallUi();
    }
  });

  window.resumeBookFromMenu = resumeFromLibrary;
  window.signInPreviewFromMenu = signInPreviewFromAnywhere;
  window.resetReaderIfBook = (id) => {
    if (activeBookId === id) resetAll();
  };
});
