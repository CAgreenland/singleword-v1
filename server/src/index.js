import "dotenv/config";
import express from "express";
import cors from "cors";
import {
  upsertSubscription,
  getSubscriptionByEmail,
  setTestEntitlement,
  getTestEntitlement,
  deleteTestEntitlement,
} from "./db.js";
import {
  verifyWebhookSignature,
  extractSubscriptionRow,
  subscriptionIsPaidLike,
} from "./lemonsqueezy.js";

const PORT = Number(process.env.PORT || 3847);
const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "";
const DEV_API_KEY = process.env.DEV_API_KEY || "";
const ALLOW_LOCAL_ENTITLEMENT_READ = process.env.ALLOW_LOCAL_ENTITLEMENT_READ === "1";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "512kb" }));

function isLocalhost(req) {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function devKeyOk(req) {
  if (!DEV_API_KEY) return false;
  const auth = req.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = req.get("X-Dev-Key") || "";
  return bearer === DEV_API_KEY || header === DEV_API_KEY;
}

function requireDevKey(req, res, next) {
  if (!DEV_API_KEY) {
    return res.status(503).json({
      error: "DEV_API_KEY is not set",
      hint: "Add DEV_API_KEY to server/.env (see .env.example).",
    });
  }
  if (!devKeyOk(req)) {
    return res.status(401).json({ error: "Invalid or missing dev key" });
  }
  next();
}

function effectiveEntitlement(email) {
  const norm = email.trim().toLowerCase();
  const test = getTestEntitlement(norm);
  if (test && test.paid === 1) {
    return {
      email: norm,
      paid: true,
      source: "test",
      updated_at: test.updated_at,
    };
  }
  const sub = getSubscriptionByEmail(norm);
  if (sub && subscriptionIsPaidLike(sub.status)) {
    return {
      email: sub.user_email || norm,
      paid: true,
      source: "lemonsqueezy",
      status: sub.status,
      renews_at: sub.renews_at,
      ends_at: sub.ends_at,
      ls_subscription_id: sub.ls_subscription_id,
      updated_at: sub.updated_at,
    };
  }
  return {
    email: norm,
    paid: false,
    source: test ? "test" : sub ? "lemonsqueezy" : "none",
    ...(sub && {
      subscription_status: sub.status,
      renews_at: sub.renews_at,
      ends_at: sub.ends_at,
      ls_subscription_id: sub.ls_subscription_id,
      updated_at: sub.updated_at,
    }),
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "singleword-api",
    mode: "test-first (Lemon Squeezy optional)",
    time: new Date().toISOString(),
  });
});

/**
 * Read paid/free for an email (for testing your app before Lemon Squeezy).
 * Auth: Authorization: Bearer <DEV_API_KEY> or X-Dev-Key: <DEV_API_KEY>
 * Or set ALLOW_LOCAL_ENTITLEMENT_READ=1 and call only from this machine (localhost).
 */
app.get("/api/entitlement", (req, res) => {
  const email = typeof req.query.email === "string" ? req.query.email : "";
  if (!email.trim()) {
    return res.status(400).json({ error: "Missing email query parameter" });
  }

  const allowed =
    (ALLOW_LOCAL_ENTITLEMENT_READ && isLocalhost(req)) || devKeyOk(req);
  if (!allowed) {
    if (!DEV_API_KEY && !ALLOW_LOCAL_ENTITLEMENT_READ) {
      return res.status(503).json({
        error: "Not configured",
        hint:
          "Set DEV_API_KEY in .env and send it as Authorization: Bearer … or X-Dev-Key, or set ALLOW_LOCAL_ENTITLEMENT_READ=1 for localhost-only reads.",
      });
    }
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.json(effectiveEntitlement(email));
});

/** Set test paid/free (does not touch Lemon Squeezy data). */
app.post("/api/dev/entitlement", requireDevKey, (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const paid = Boolean(req.body?.paid);
  if (!email.trim()) {
    return res.status(400).json({ error: "Body must include { \"email\": \"...\", \"paid\": true|false }" });
  }
  setTestEntitlement(email, paid);
  return res.json({
    ok: true,
    email: email.trim().toLowerCase(),
    paid,
    note: "Stored in test_entitlements. Lemon Squeezy webhooks still apply if you add them later.",
  });
});

/** Remove test override for an email (subscription rows are unchanged). */
app.delete("/api/dev/entitlement", requireDevKey, (req, res) => {
  const email = typeof req.query.email === "string" ? req.query.email : "";
  if (!email.trim()) {
    return res.status(400).json({ error: "Missing email query parameter" });
  }
  const removed = deleteTestEntitlement(email);
  return res.json({ ok: true, removed });
});

/**
 * Lemon Squeezy — optional; enable when LEMONSQUEEZY_WEBHOOK_SECRET is set.
 */
app.post(
  "/api/webhooks/lemonsqueezy",
  express.raw({ type: "application/json" }),
  (req, res) => {
    if (!WEBHOOK_SECRET) {
      return res.status(503).json({
        error: "Webhook not configured",
        hint: "Set LEMONSQUEEZY_WEBHOOK_SECRET when you are ready to use Lemon Squeezy.",
      });
    }

    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from("");
    const sig = req.get("X-Signature") || req.get("x-signature");
    if (!verifyWebhookSignature(rawBody, sig, WEBHOOK_SECRET)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const eventName =
      req.get("X-Event-Name") || req.get("x-event-name") || payload.meta?.event_name || "unknown";

    try {
      const row = extractSubscriptionRow(eventName, payload);
      if (row) {
        upsertSubscription(row);
        console.log("[webhook]", eventName, "subscription", row.ls_subscription_id, row.status);
      } else {
        console.log("[webhook]", eventName, "(no subscription row extracted)");
      }
    } catch (e) {
      console.error("[webhook] handler error", e);
      return res.status(500).json({ error: "Handler failed" });
    }

    return res.status(200).json({ received: true });
  }
);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const server = app.listen(PORT, () => {
  console.log(`Single Word API (test mode) — http://127.0.0.1:${PORT}`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/entitlement?email=…`);
  console.log(`  POST /api/dev/entitlement  (needs DEV_API_KEY)`);
  console.log(`  DELETE /api/dev/entitlement?email=…`);
  if (WEBHOOK_SECRET) {
    console.log(`  POST /api/webhooks/lemonsqueezy (Lemon Squeezy enabled)`);
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n[Single Word API] Port ${PORT} is already in use (EADDRINUSE).\n` +
        `Close the other terminal running the API, or set a different PORT in server/.env\n`
    );
    // Exit 0 so `node --watch` does not respawn forever while the port stays taken.
    process.exit(0);
  }
  throw err;
});
