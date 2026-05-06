import { createClient } from "@supabase/supabase-js";

let _admin = null;

/** Service-role client for server-side writes to profiles (never expose this key to the browser). */
export function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  if (!_admin) {
    _admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return _admin;
}
