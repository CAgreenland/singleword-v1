/**
 * Standalone sign-in + create account (preview). Matches app.js localStorage keys.
 * After success: sessionStorage singlewordPostLoginReturn + redirect to app.html.
 */
(function () {
  "use strict";

  const STORAGE_EMAIL = "singlewordSessionEmail";
  const STORAGE_CONNECTED = "singlewordConnectedAccount";
  const STORAGE_REGISTERED = "singlewordRegisteredEmails";

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

  function getRegisteredEmails() {
    try {
      const raw = localStorage.getItem(STORAGE_REGISTERED);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map((e) => String(e).toLowerCase().trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function addRegisteredEmail(emailLower) {
    const list = getRegisteredEmails();
    if (list.includes(emailLower)) return false;
    list.push(emailLower);
    localStorage.setItem(STORAGE_REGISTERED, JSON.stringify(list));
    return true;
  }

  const params = new URLSearchParams(window.location.search);
  const returnParam = params.get("return") || "index.html";
  const safeReturn = safeReturnPath(returnParam);
  const modeParam = (params.get("mode") || "").toLowerCase();

  const form = document.getElementById("loginForm");
  const emailEl = document.getElementById("loginEmail");
  const passwordEl = document.getElementById("loginPassword");
  const statusEl = document.getElementById("loginStatus");
  const submitBtn = document.getElementById("loginSubmit");
  const forgotBtn = document.getElementById("loginForgotBtn");
  const forgotDialog = document.getElementById("forgotPasswordDialog");
  const backLink = document.getElementById("loginBackLink");
  const alreadyEl = document.getElementById("loginAlreadySignedIn");
  const signInPanel = document.getElementById("loginPanelSignIn");
  const signUpPanel = document.getElementById("loginPanelSignUp");
  const signUpForm = document.getElementById("signUpForm");
  const signUpEmail = document.getElementById("signUpEmail");
  const signUpPassword = document.getElementById("signUpPassword");
  const signUpPasswordConfirm = document.getElementById("signUpPasswordConfirm");
  const signUpStatus = document.getElementById("signUpStatus");
  const signUpSubmit = document.getElementById("signUpSubmit");
  const showSignUpBtn = document.getElementById("showSignUpBtn");
  const showSignInBtn = document.getElementById("showSignInBtn");
  const loginCardTitle = document.getElementById("loginCardTitle");
  const loginCardLead = document.getElementById("loginCardLead");

  if (backLink) backLink.href = safeReturn;

  const LEAD_SIGNIN =
    "Use email and password (preview — stored on this device only). After signing in you’ll go to the reader.";
  const LEAD_SIGNUP =
    "Create a preview account with email and password on this device. When you connect a backend, this becomes real registration.";

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function setSignUpStatus(msg) {
    if (signUpStatus) signUpStatus.textContent = msg || "";
  }

  function showSignInView(clearMessages) {
    if (loginCardTitle) loginCardTitle.textContent = "Sign in";
    if (loginCardLead) loginCardLead.textContent = LEAD_SIGNIN;
    if (signInPanel) signInPanel.hidden = false;
    if (signUpPanel) signUpPanel.hidden = true;
    if (clearMessages !== false) {
      setStatus("");
      setSignUpStatus("");
    }
  }

  function showSignUpView() {
    if (loginCardTitle) loginCardTitle.textContent = "Create account";
    if (loginCardLead) loginCardLead.textContent = LEAD_SIGNUP;
    if (signInPanel) signInPanel.hidden = true;
    if (signUpPanel) signUpPanel.hidden = false;
    setStatus("");
    setSignUpStatus("");
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
    if (signInPanel) signInPanel.hidden = true;
    if (signUpPanel) signUpPanel.hidden = true;
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

  if (showSignUpBtn) {
    showSignUpBtn.addEventListener("click", () => showSignUpView());
  }
  if (showSignInBtn) {
    showSignInBtn.addEventListener("click", () => showSignInView());
  }

  if (modeParam === "signup" || modeParam === "register") {
    showSignUpView();
  } else {
    showSignInView();
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

  if (signUpForm) {
    signUpForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = (signUpEmail && signUpEmail.value.trim()) || "";
      const pass = (signUpPassword && signUpPassword.value) || "";
      const pass2 = (signUpPasswordConfirm && signUpPasswordConfirm.value) || "";
      const lower = email.toLowerCase();

      if (!email) {
        setSignUpStatus("Enter your email.");
        if (signUpEmail) signUpEmail.focus();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setSignUpStatus("Enter a valid email address.");
        if (signUpEmail) signUpEmail.focus();
        return;
      }
      if (pass.length < 8) {
        setSignUpStatus("Password must be at least 8 characters.");
        if (signUpPassword) signUpPassword.focus();
        return;
      }
      if (pass !== pass2) {
        setSignUpStatus("Passwords do not match.");
        if (signUpPasswordConfirm) signUpPasswordConfirm.focus();
        return;
      }

      const registered = getRegisteredEmails();
      if (registered.includes(lower)) {
        showSignInView(false);
        if (emailEl) emailEl.value = email;
        setStatus("This email is already registered — sign in below.");
        setSignUpStatus("");
        return;
      }

      if (signUpSubmit) signUpSubmit.disabled = true;
      setSignUpStatus("Creating account…");
      addRegisteredEmail(lower);
      if (signUpPassword) signUpPassword.value = "";
      if (signUpPasswordConfirm) signUpPasswordConfirm.value = "";
      applyLoginPreview(email);
      window.location.href = "./app.html";
    });
  }

  if (forgotBtn && forgotDialog && typeof forgotDialog.showModal === "function") {
    forgotBtn.addEventListener("click", () => forgotDialog.showModal());
  }
})();
