import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "singleword.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS test_entitlements (
    email TEXT PRIMARY KEY NOT NULL,
    paid INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ls_subscription_id TEXT UNIQUE NOT NULL,
    ls_customer_id TEXT,
    user_email TEXT,
    status TEXT NOT NULL,
    renews_at TEXT,
    ends_at TEXT,
    raw_event TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(user_email);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(ls_customer_id);
`);

/**
 * @param {object} row
 */
export function upsertSubscription(row) {
  const stmt = db.prepare(`
    INSERT INTO subscriptions (
      ls_subscription_id, ls_customer_id, user_email, status, renews_at, ends_at, raw_event, updated_at
    ) VALUES (
      @ls_subscription_id, @ls_customer_id, @user_email, @status, @renews_at, @ends_at, @raw_event, @updated_at
    )
    ON CONFLICT(ls_subscription_id) DO UPDATE SET
      ls_customer_id = excluded.ls_customer_id,
      user_email = COALESCE(excluded.user_email, subscriptions.user_email),
      status = excluded.status,
      renews_at = excluded.renews_at,
      ends_at = excluded.ends_at,
      raw_event = excluded.raw_event,
      updated_at = excluded.updated_at
  `);
  stmt.run(row);
}

/**
 * @param {string} email normalized lowercase
 */
export function getSubscriptionByEmail(email) {
  const row = db
    .prepare(
      `SELECT ls_subscription_id, ls_customer_id, user_email, status, renews_at, ends_at, updated_at
       FROM subscriptions WHERE lower(user_email) = ? ORDER BY updated_at DESC LIMIT 1`
    )
    .get(email.trim().toLowerCase());
  return row ?? null;
}

/**
 * @param {string} email
 * @param {boolean} paid
 */
export function setTestEntitlement(email, paid) {
  const norm = email.trim().toLowerCase();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO test_entitlements (email, paid, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET paid = excluded.paid, updated_at = excluded.updated_at`
  ).run(norm, paid ? 1 : 0, now);
}

/**
 * @param {string} email
 */
export function getTestEntitlement(email) {
  const norm = email.trim().toLowerCase();
  return db.prepare(`SELECT email, paid, updated_at FROM test_entitlements WHERE email = ?`).get(norm) ?? null;
}

/**
 * @param {string} email
 */
export function deleteTestEntitlement(email) {
  const norm = email.trim().toLowerCase();
  const info = db.prepare(`DELETE FROM test_entitlements WHERE email = ?`).run(norm);
  return info.changes > 0;
}

export function closeDb() {
  db.close();
}
