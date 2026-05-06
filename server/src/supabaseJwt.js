import * as jose from "jose";

/**
 * Verifies a Supabase Auth access token (HS256).
 * Set SUPABASE_JWT_SECRET from Supabase → Project Settings → JWT Keys (legacy JWT secret / signing secret).
 * @returns {{ email: string | null, sub: string | null }}
 */
export async function verifySupabaseAccessToken(token) {
  const secret = (process.env.SUPABASE_JWT_SECRET || "").trim();
  if (!secret) {
    const err = new Error("SUPABASE_JWT_SECRET is not set");
    err.code = "missing_secret";
    throw err;
  }
  const key = new TextEncoder().encode(secret);
  const { payload } = await jose.jwtVerify(token, key, { algorithms: ["HS256"] });
  const meta = payload.user_metadata && typeof payload.user_metadata === "object" ? payload.user_metadata : null;
  const email =
    typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : meta && typeof meta.email === "string"
        ? String(meta.email).trim().toLowerCase()
        : "";
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  return { email: email || null, sub };
}

/** @deprecated use verifySupabaseAccessToken */
export async function getEmailFromSupabaseAccessToken(token) {
  const { email } = await verifySupabaseAccessToken(token);
  return email;
}
