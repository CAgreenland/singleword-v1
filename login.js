/**
 * Standalone sign-in + create account. Preview (localStorage) or Supabase when configured.
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
  const signUpPasswordMatchHint = document.getElementById("signUpPasswordMatchHint");
  const signUpStatus = document.getElementById("signUpStatus");
  const signUpSubmit = document.getElementById("signUpSubmit");
  const loginSocialActions = document.getElementById("loginSocialActions");
  const loginGoogleBtn = document.getElementById("loginGoogleBtn");
  const showSignUpBtn = document.getElementById("showSignUpBtn");
  const showSignInBtn = document.getElementById("showSignInBtn");
  const loginCardTitle = document.getElementById("loginCardTitle");
  const loginCardLead = document.getElementById("loginCardLead");

  if (backLink) backLink.href = safeReturn;

  const LEAD_SIGNIN_PREVIEW =
    "Use email and password (preview — stored on this device only). After signing in you’ll go to the reader.";
  const LEAD_SIGNIN_SUPABASE =
    "Use your email and password. Your session is stored on this device and validated with Supabase.";
  const LEAD_SIGNUP_PREVIEW =
    "Create a preview account with email and password on this device. When you connect a backend, this becomes real registration.";
  const LEAD_SIGNUP_SUPABASE =
    "Create an account with email and password. If your project requires email confirmation, check your inbox before signing in.";

  const supabaseClient =
    typeof window.createSwSupabaseClient === "function" ? window.createSwSupabaseClient() : null;
  let socialOptionsUnlocked = false;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function setSignUpStatus(msg) {
    if (signUpStatus) signUpStatus.textContent = msg || "";
  }

  function updatePasswordMatchHint() {
    if (!signUpPasswordMatchHint || !signUpPassword || !signUpPasswordConfirm) return;
    const pass = signUpPassword.value || "";
    const pass2 = signUpPasswordConfirm.value || "";
    signUpPasswordMatchHint.classList.remove("login-hint--ok", "login-hint--error");
    if (!pass && !pass2) {
      signUpPasswordMatchHint.textContent = "";
      return;
    }
    if (!pass2.length) {
      signUpPasswordMatchHint.textContent = "Repeat your password to confirm.";
      return;
    }
    if (pass === pass2) {
      signUpPasswordMatchHint.textContent = "Passwords match.";
      signUpPasswordMatchHint.classList.add("login-hint--ok");
      return;
    }
    signUpPasswordMatchHint.textContent = "Passwords do not match yet.";
    signUpPasswordMatchHint.classList.add("login-hint--error");
  }

  async function signInWithOAuth(provider) {
    if (!supabaseClient) {
      setStatus("Social login requires Supabase configuration.");
      return;
    }
    setStatus(`Redirecting to ${provider}…`);
    const base = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}`;
    const redirectTo = `${base}login.html?return=${encodeURIComponent(safeReturn)}`;
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setStatus(error.message || `Could not start ${provider} login.`);
    }
  }

  function showSignInView(clearMessages) {
    if (loginCardTitle) loginCardTitle.textContent = "Sign in";
    if (loginCardLead)
      loginCardLead.textContent = supabaseClient ? LEAD_SIGNIN_SUPABASE : LEAD_SIGNIN_PREVIEW;
    if (signInPanel) signInPanel.hidden = false;
    if (signUpPanel) signUpPanel.hidden = true;
    if (loginSocialActions) loginSocialActions.hidden = !supabaseClient || !socialOptionsUnlocked;
    if (clearMessages !== false) {
      setStatus("");
      setSignUpStatus("");
    }
  }

  function showSignUpView() {
    if (loginCardTitle) loginCardTitle.textContent = "Create account";
    if (loginCardLead)
      loginCardLead.textContent = supabaseClient ? LEAD_SIGNUP_SUPABASE : LEAD_SIGNUP_PREVIEW;
    if (signInPanel) signInPanel.hidden = true;
    if (signUpPanel) signUpPanel.hidden = false;
    if (loginSocialActions) loginSocialActions.hidden = true;
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

  function showAlreadySignedIn() {
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
  }

  async function init() {
    if (loginSocialActions) loginSocialActions.hidden = true;

    if (supabaseClient) {
      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (session?.user?.email) {
          applyLoginPreview(session.user.email);
          showAlreadySignedIn();
          return;
        }
      } catch {
        /* ignore */
      }
    }

    if (localStorage.getItem(STORAGE_CONNECTED) === "1") {
      showAlreadySignedIn();
      return;
    }

    if (showSignUpBtn) {
      showSignUpBtn.addEventListener("click", () => {
        socialOptionsUnlocked = true;
        showSignUpView();
      });
    }
    if (showSignInBtn) {
      showSignInBtn.addEventListener("click", () => {
        socialOptionsUnlocked = true;
        showSignInView();
      });
    }
    if (signUpPassword) signUpPassword.addEventListener("input", updatePasswordMatchHint);
    if (signUpPasswordConfirm) signUpPasswordConfirm.addEventListener("input", updatePasswordMatchHint);
    updatePasswordMatchHint();

    if (loginGoogleBtn) {
      loginGoogleBtn.addEventListener("click", () => void signInWithOAuth("google"));
    }

    if (modeParam === "signup" || modeParam === "register") {
      showSignUpView();
    } else {
      showSignInView();
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
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

        if (supabaseClient) {
          if (submitBtn) submitBtn.disabled = true;
          setStatus("Signing in…");
          const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
          if (error) {
            setStatus(error.message || "Sign in failed.");
            if (submitBtn) submitBtn.disabled = false;
            return;
          }
          const resolvedEmail = data.user?.email || email;
          if (passwordEl) passwordEl.value = "";
          applyLoginPreview(resolvedEmail);
          window.location.href = "./app.html";
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
      signUpForm.addEventListener("submit", async (e) => {
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

        if (!supabaseClient) {
          const registered = getRegisteredEmails();
          if (registered.includes(lower)) {
            showSignInView(false);
            if (emailEl) emailEl.value = email;
            setStatus("This email is already registered — sign in below.");
            setSignUpStatus("");
            return;
          }
        }

        if (supabaseClient) {
          if (signUpSubmit) signUpSubmit.disabled = true;
          setSignUpStatus("Creating account…");
          const { data, error } = await supabaseClient.auth.signUp({ email, password: pass });
          if (error) {
            setSignUpStatus(error.message || "Could not create account.");
            if (signUpSubmit) signUpSubmit.disabled = false;
            return;
          }
          if (data.session) {
            const resolvedEmail = data.user?.email || email;
            if (signUpPassword) signUpPassword.value = "";
            if (signUpPasswordConfirm) signUpPasswordConfirm.value = "";
            applyLoginPreview(resolvedEmail);
            window.location.href = "./app.html";
            return;
          }
          setSignUpStatus(
            "If your project requires email confirmation, check your inbox before signing in."
          );
          if (signUpSubmit) signUpSubmit.disabled = false;
          if (signUpPassword) signUpPassword.value = "";
          if (signUpPasswordConfirm) signUpPasswordConfirm.value = "";
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

    if (forgotBtn) {
      forgotBtn.addEventListener("click", async () => {
        if (!supabaseClient) {
          if (forgotDialog && typeof forgotDialog.showModal === "function") forgotDialog.showModal();
          return;
        }
        const email = (emailEl && emailEl.value.trim()) || "";
        if (!email) {
          setStatus("Enter your email, then tap Forgot password again to receive a reset link.");
          if (emailEl) emailEl.focus();
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setStatus("Enter a valid email address first.");
          if (emailEl) emailEl.focus();
          return;
        }
        setStatus("Sending reset link…");
        const base = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}`;
        const redirectTo = `${base}login.html`;
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) {
          setStatus(error.message || "Could not send reset email.");
          return;
        }
        setStatus("Check your email for a reset link.");
      });
    }
  }

  void init();
})();
