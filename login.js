/**
 * Standalone sign-in (preview). Matches app.js localStorage keys.
 * After success: sessionStorage singlewordPostLoginReturn + redirect to app.html.
 */
(function () {
  "use strict";

  const STORAGE_EMAIL = "singlewordSessionEmail";
  const STORAGE_CONNECTED = "singlewordConnectedAccount";

  function safeReturnPath(raw) {
    const fallback = "./index.html";
    if (!raw || typeof raw !== "string") return fallback;
    let t;
    try {
      t = decodeURIComponent(raw.trim());
    } catch {
      return fallback;
    }
    if (!t || /[\s\\]/.test(t)) return fallback;
    if (/^javascript:/i.test(t) || t.includes("://") || t.startsWith("//")) return fallback;
    if (!/^[a-zA-Z0-9._\-/#?=&%+]+$/.test(t)) return fallback;
    if (t.startsWith("/")) return fallback;
    return t.startsWith("./") ? t : "./" + t.replace(/^\.\//, "");
  }

  const params = new URLSearchParams(window.location.search);
  const returnParam = params.get("return") || "index.html";
  const safeReturn = safeReturnPath(returnParam);

  const form = document.getElementById("loginForm");
  const emailEl = document.getElementById("loginEmail");
  const passwordEl = document.getElementById("loginPassword");
  const statusEl = document.getElementById("loginStatus");
  const submitBtn = document.getElementById("loginSubmit");
  const forgotBtn = document.getElementById("loginForgotBtn");
  const forgotDialog = document.getElementById("forgotPasswordDialog");
  const backLink = document.getElementById("loginBackLink");
  const alreadyEl = document.getElementById("loginAlreadySignedIn");

  if (backLink) backLink.href = safeReturn;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function applyLoginPreview(email) {
    localStorage.setItem(STORAGE_EMAIL, email);
    localStorage.setItem(STORAGE_CONNECTED, "1");
    document.dispatchEvent(new CustomEvent("singleword-account-connected"));
    try {
      sessionStorage.setItem("singlewordPostLoginReturn", safeReturn);
    } catch (_) {
      /* ignore */
    }
  }

  if (localStorage.getItem(STORAGE_CONNECTED) === "1") {
    if (form) form.hidden = true;
    if (alreadyEl) {
      alreadyEl.hidden = false;
      const openReader = alreadyEl.querySelector("[data-open-reader]");
      const back = alreadyEl.querySelector("[data-back-link]");
      if (openReader) {
        openReader.addEventListener("click", (e) => {
          e.preventDefault();
          try {
            sessionStorage.setItem("singlewordPostLoginReturn", safeReturn);
          } catch (_) {
            /* ignore */
          }
          window.location.href = "./app.html";
        });
      }
      if (back) back.href = safeReturn;
    }
    return;
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = (emailEl && emailEl.value.trim()) || "";
      const password = (passwordEl && passwordEl.value) || "";
      if (!email) {
        setStatus("Enter your email.");
        if (emailEl) emailEl.focus();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus("Enter a valid email address.");
        if (emailEl) emailEl.focus();
        return;
      }
      if (!password.length) {
        setStatus("Enter your password.");
        if (passwordEl) passwordEl.focus();
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      setStatus("Signing in…");
      applyLoginPreview(email);
      if (passwordEl) passwordEl.value = "";
      window.location.href = "./app.html";
    });
  }

  if (forgotBtn && forgotDialog && typeof forgotDialog.showModal === "function") {
    forgotBtn.addEventListener("click", () => forgotDialog.showModal());
  }
})();
