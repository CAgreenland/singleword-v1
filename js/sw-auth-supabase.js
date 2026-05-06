/**
 * Supabase browser client for Single word (vanilla JS, no bundler).
 * Requires: window.__SUPABASE_URL, window.__SUPABASE_ANON_KEY (from supabase-config.js)
 * and the UMD bundle from @supabase/supabase-js loaded before this file.
 */
(function () {
  "use strict";

  /**
   * @returns {import("@supabase/supabase-js").SupabaseClient | null}
   */
  window.createSwSupabaseClient = function createSwSupabaseClient() {
    const url = typeof window.__SUPABASE_URL === "string" ? window.__SUPABASE_URL.trim() : "";
    const key = typeof window.__SUPABASE_ANON_KEY === "string" ? window.__SUPABASE_ANON_KEY.trim() : "";
    if (!url || !key) return null;
    if (typeof supabase === "undefined" || typeof supabase.createClient !== "function") return null;
    return supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    });
  };
})();
