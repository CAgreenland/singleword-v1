/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} userId
 */
export async function fetchProfileEntitlementByUserId(admin, userId) {
  const { data, error } = await admin
    .from("profiles")
    .select("email, plan, paid, paid_until, lemon_customer_id, lemon_subscription_id, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} emailLower
 */
export async function fetchProfileIdByEmail(admin, emailLower) {
  const { data, error } = await admin.from("profiles").select("id").eq("email", emailLower).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} userId
 * @param {{ paid: boolean, plan?: string, paid_until?: string | null, lemon_customer_id?: string | null, lemon_subscription_id?: string | null }} patch
 */
export async function updateProfileBillingByUserId(admin, userId, patch) {
  const row = {
    paid: patch.paid,
    plan: patch.plan ?? (patch.paid ? "pro" : "free"),
    paid_until: patch.paid_until ?? null,
    lemon_customer_id: patch.lemon_customer_id ?? null,
    lemon_subscription_id: patch.lemon_subscription_id ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("profiles").update(row).eq("id", userId);
  if (error) throw error;
}
