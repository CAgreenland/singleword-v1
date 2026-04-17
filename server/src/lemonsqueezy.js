import crypto from "node:crypto";

/**
 * Verifies Lemon Squeezy webhook signature (HMAC-SHA256 hex in X-Signature).
 * @see https://docs.lemonsqueezy.com/help/webhooks/signing-requests
 * @param {Buffer} rawBody
 * @param {string | undefined} signatureHeader
 * @param {string} secret
 */
export function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader || !rawBody?.length) {
    return false;
  }
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const digest = Buffer.from(hmac.digest("hex"), "utf8");
  const signature = Buffer.from(signatureHeader, "utf8");
  if (digest.length !== signature.length) {
    return false;
  }
  return crypto.timingSafeEqual(digest, signature);
}

/** Subscription statuses that mean "paid / entitled" for a typical SaaS. */
const PAID_LIKE = new Set(["active", "on_trial", "paused"]);

/**
 * @param {string} eventName from X-Event-Name header
 * @param {object} payload parsed JSON body
 */
export function extractSubscriptionRow(eventName, payload) {
  const meta = payload.meta || {};
  const custom = meta.custom_data || {};
  const data = payload.data;
  if (!data || data.type !== "subscriptions") {
    return null;
  }
  const attrs = data.attributes || {};
  const subId = String(data.id);
  const status = String(attrs.status || "unknown");
  const customerId = attrs.customer_id != null ? String(attrs.customer_id) : null;
  const renewsAt = attrs.renews_at || null;
  const endsAt = attrs.ends_at || null;

  let userEmail =
    custom.email ||
    custom.user_email ||
    attrs.user_email ||
    attrs.customer_email ||
    null;
  if (userEmail && typeof userEmail === "string") {
    userEmail = userEmail.trim().toLowerCase();
  }

  return {
    ls_subscription_id: subId,
    ls_customer_id: customerId,
    user_email: userEmail,
    status,
    renews_at: renewsAt,
    ends_at: endsAt,
    raw_event: JSON.stringify({ eventName, receivedAt: new Date().toISOString() }),
    updated_at: new Date().toISOString(),
  };
}

export function subscriptionIsPaidLike(status) {
  return PAID_LIKE.has(String(status).toLowerCase());
}
