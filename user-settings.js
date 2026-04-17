/**
 * Top-right Account menu: appearance (always), plan + saved books only when logged in (singlewordConnectedAccount).
 * Background keys: space, minimal, midnight, aurora, ocean, dusk, paper (see space-bg.css).
 * Works on landing (index.html) and reader (app.html). Theme keys match localStorage used by app.js.
 */
(function () {
  "use strict";

  const STORAGE_THEME = "singlewordUiTheme";
  const STORAGE_BG = "singlewordUiBg";

  const IDB_NAME = "singlewordReader";
  const IDB_VER = 1;
  const IDB_STORE = "books";

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

  const ALLOWED_BG = new Set([
    "space",
    "minimal",
    "paper",
    "midnight",
    "nebula",
    "aurora",
    "synthwave",
    "forest",
    "meadow",
    "sakura",
    "ocean",
    "arctic",
    "dusk",
    "sepia",
    "volcano",
  ]);

  function applyThemeFromStorage() {
    const theme = localStorage.getItem(STORAGE_THEME) || "dark";
    const rawBg = localStorage.getItem(STORAGE_BG) || "space";
    const bg = ALLOWED_BG.has(rawBg) ? rawBg : "space";
    document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
    document.documentElement.setAttribute("data-bg", bg);
  }

  function isLoggedIn() {
    return localStorage.getItem("singlewordConnectedAccount") === "1";
  }

  /** Paid / free plan copy — only shown when logged in (caller gates visibility). */
  function planSummaryHtml() {
    const paid = localStorage.getItem("singlewordPaid") === "1";
    if (paid) {
      return "<strong>Paid</strong> — full access on this device.";
    }
    return "<strong>Free</strong> — limited words; complete payment in the reader when you hit the free limit.";
  }

  function syncMenuGatingForRoot(root) {
    if (!root || !root.matches || !root.matches("[data-user-menu]")) return;
    const logged = isLoggedIn();
    root.querySelectorAll("[data-user-plan-section]").forEach((el) => {
      el.hidden = !logged;
    });
    root.querySelectorAll("[data-user-plan-guest]").forEach((el) => {
      el.hidden = logged;
    });
    root.querySelectorAll("[data-user-library-section]").forEach((el) => {
      el.hidden = !logged;
    });
    root.querySelectorAll("[data-user-library-guest]").forEach((el) => {
      el.hidden = logged;
    });
    root.querySelectorAll("[data-user-library-link]").forEach((el) => {
      el.hidden = !logged;
    });
    const planEl = root.querySelector("[data-user-plan]");
    if (planEl) {
      planEl.innerHTML = logged ? planSummaryHtml() : "";
    }
  }

  function syncAllAccountMenus() {
    document.querySelectorAll("[data-user-menu]").forEach(syncMenuGatingForRoot);
  }

  async function fillLibrary(container, context) {
    if (!container) return;
    container.innerHTML = "";
    if (!isLoggedIn()) {
      return;
    }
    let books = [];
    try {
      books = await idbGetAllBooks();
    } catch {
      const p = document.createElement("p");
      p.className = "user-menu__lib-empty";
      p.textContent = "Could not read storage.";
      container.appendChild(p);
      return;
    }
    books.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!books.length) {
      const p = document.createElement("p");
      p.className = "user-menu__lib-empty";
      p.textContent =
        context === "landing"
          ? "No books saved yet. Open the reader and choose a file — saves stay on this device."
          : "No books saved yet. Choose a file below to add one.";
      container.appendChild(p);
      return;
    }
    const max = 5;
    for (let i = 0; i < Math.min(books.length, max); i++) {
      const b = books[i];
      const pct = b.wordCount > 0 ? Math.round(((Math.min(b.savedIndex ?? 0, b.wordCount - 1) + 1) / b.wordCount) * 100) : 0;
      const item = document.createElement("div");
      item.className = "user-menu__lib-item";
      const title = document.createElement("p");
      title.className = "user-menu__lib-title";
      title.textContent = b.filename || "Untitled";
      const meta = document.createElement("p");
      meta.className = "user-menu__lib-meta";
      meta.textContent = `${b.wordCount.toLocaleString()} words · ${pct}% read`;
      item.appendChild(title);
      item.appendChild(meta);

      if (context === "app") {
        const actions = document.createElement("div");
        actions.className = "user-menu__lib-actions";
        const resumeBtn = document.createElement("button");
        resumeBtn.type = "button";
        resumeBtn.className = "user-menu__btn";
        resumeBtn.textContent = "Resume";
        resumeBtn.dataset.resumeId = b.id;
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "user-menu__btn user-menu__btn--ghost";
        removeBtn.textContent = "Remove";
        removeBtn.dataset.removeId = b.id;
        actions.appendChild(resumeBtn);
        actions.appendChild(removeBtn);
        item.appendChild(actions);
      }
      container.appendChild(item);
    }
    if (books.length > max) {
      const more = document.createElement("p");
      more.className = "user-menu__lib-meta";
      more.style.margin = "4px 0 0";
      more.textContent = `+ ${books.length - max} more in the reader library panel.`;
      container.appendChild(more);
    }
  }

  function wireLibraryActions(container, menuRoot) {
    if (!container) return;
    container.addEventListener("click", async (e) => {
      const resumeBtn = e.target.closest("button[data-resume-id]");
      if (resumeBtn) {
        const id = resumeBtn.getAttribute("data-resume-id");
        const fn = window.resumeBookFromMenu;
        if (typeof fn === "function" && id) {
          try {
            await fn(id);
          } catch (_) {
            /* handled in app */
          }
          closeMenu(menuRoot);
        }
        return;
      }
      const removeBtn = e.target.closest("button[data-remove-id]");
      if (removeBtn) {
        const id = removeBtn.getAttribute("data-remove-id");
        if (id && window.confirm("Remove this book from saved storage?")) {
          try {
            await idbDeleteBook(id);
            if (typeof window.resetReaderIfBook === "function") {
              window.resetReaderIfBook(id);
            }
            document.dispatchEvent(new CustomEvent("singleword-library-updated"));
          } catch (_) {
            /* ignore */
          }
        }
      }
    });
  }

  function closeMenu(root) {
    const trigger = root.querySelector(".user-menu__trigger");
    const panel = root.querySelector(".user-menu__panel");
    if (!trigger || !panel) return;
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function openMenu(root) {
    const trigger = root.querySelector(".user-menu__trigger");
    const panel = root.querySelector(".user-menu__panel");
    if (!trigger || !panel) return;
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  }

  function initUserMenu(root) {
    const trigger = root.querySelector(".user-menu__trigger");
    const panel = root.querySelector(".user-menu__panel");
    const themeSelect = root.querySelector("[data-user-theme]");
    const bgSelect = root.querySelector("[data-user-bg]");
    const libContainer = root.querySelector("[data-user-menu-library]");
    const context = root.getAttribute("data-context") || "landing";

    syncMenuGatingForRoot(root);

    if (themeSelect) {
      themeSelect.value = localStorage.getItem(STORAGE_THEME) || "dark";
      themeSelect.addEventListener("change", () => {
        localStorage.setItem(STORAGE_THEME, themeSelect.value);
        applyThemeFromStorage();
      });
    }
    if (bgSelect) {
      const stored = localStorage.getItem(STORAGE_BG) || "space";
      bgSelect.value = ALLOWED_BG.has(stored) ? stored : "space";
      bgSelect.addEventListener("change", () => {
        localStorage.setItem(STORAGE_BG, bgSelect.value);
        applyThemeFromStorage();
      });
    }

    if (trigger && panel) {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!panel.hidden) {
          closeMenu(root);
          return;
        }
        document.querySelectorAll("[data-user-menu] .user-menu__panel").forEach((p) => {
          p.hidden = true;
        });
        document.querySelectorAll("[data-user-menu] .user-menu__trigger").forEach((t) => {
          t.setAttribute("aria-expanded", "false");
        });
        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        fillLibrary(libContainer, context);
      });
    }

    if (libContainer && context === "app") {
      wireLibraryActions(libContainer, root);
    }

    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) closeMenu(root);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu(root);
    });
  }

  function refreshPlanAndLibraryMenus() {
    syncAllAccountMenus();
    document.querySelectorAll("[data-user-menu-library]").forEach((el) => {
      const menu = el.closest("[data-user-menu]");
      const ctx = menu ? menu.getAttribute("data-context") || "landing" : "landing";
      fillLibrary(el, ctx);
    });
  }

  function init() {
    applyThemeFromStorage();
    document.querySelectorAll("[data-user-menu]").forEach(initUserMenu);

    document.addEventListener("singleword-library-updated", () => {
      document.querySelectorAll("[data-user-menu-library]").forEach((el) => {
        const menu = el.closest("[data-user-menu]");
        const ctx = menu ? menu.getAttribute("data-context") || "landing" : "landing";
        fillLibrary(el, ctx);
      });
    });

    document.addEventListener("singleword-account-connected", refreshPlanAndLibraryMenus);

    document.addEventListener("singleword-account-disconnected", refreshPlanAndLibraryMenus);

    document.addEventListener("singleword-paid-updated", refreshPlanAndLibraryMenus);

    window.addEventListener("storage", (e) => {
      if (e.key === "singlewordPaid" || e.key === "singlewordConnectedAccount") {
        refreshPlanAndLibraryMenus();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
