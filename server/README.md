# Single Word — API (local testing)

Backend for **trying paid vs free before you plug in Lemon Squeezy**. It stores **test entitlements** in SQLite and can optionally receive **Lemon Squeezy** webhooks later.

## Quick start

1. Install [Node.js 18+](https://nodejs.org/).

2. In this folder:

   ```bash
   npm install
   ```

3. Create `.env`:

   ```bash
   copy .env.example .env
   ```

   Set **`DEV_API_KEY`** to any long random string (keep it secret).

4. Run:

   ```bash
   npm run dev
   ```

5. Open [http://127.0.0.1:3847/api/health](http://127.0.0.1:3847/api/health).

## Test paid / free (no Lemon Squeezy)

**Mark an email as paid** (replace the key with your `DEV_API_KEY`):

```bash
curl -s -X POST http://127.0.0.1:3847/api/dev/entitlement ^
  -H "Content-Type: application/json" ^
  -H "X-Dev-Key: YOUR_DEV_API_KEY" ^
  -d "{\"email\":\"you@example.com\",\"paid\":true}"
```

**Mark as free again:**

```bash
curl -s -X POST http://127.0.0.1:3847/api/dev/entitlement ^
  -H "Content-Type: application/json" ^
  -H "X-Dev-Key: YOUR_DEV_API_KEY" ^
  -d "{\"email\":\"you@example.com\",\"paid\":false}"
```

**Remove the test override** (Lemon Squeezy rows are left as-is):

```bash
curl -s -X DELETE "http://127.0.0.1:3847/api/dev/entitlement?email=you@example.com" ^
  -H "X-Dev-Key: YOUR_DEV_API_KEY"
```

**Read effective entitlement** (test row wins over Lemon Squeezy until you delete the test row):

- With key: `Authorization: Bearer YOUR_DEV_API_KEY` or `X-Dev-Key: YOUR_DEV_API_KEY`
- Or with **`ALLOW_LOCAL_ENTITLEMENT_READ=1`** in `.env`, open in the browser on the same PC (no key):

  [http://127.0.0.1:3847/api/entitlement?email=you@example.com](http://127.0.0.1:3847/api/entitlement?email=you@example.com)

## Endpoints

| Method | Path | Purpose |
|--------|------|--------|
| `GET` | `/api/health` | Alive check |
| `GET` | `/api/entitlement?email=` | Current paid/free (test + optional LS) |
| `GET` | `/api/me/entitlement` | Same payload for the **signed-in Supabase user** — send `Authorization: Bearer <access_token>`; requires `SUPABASE_JWT_SECRET` in `server/.env` |
| `POST` | `/api/dev/entitlement` | Set test `{ email, paid }` — needs `DEV_API_KEY`; with **`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`** also syncs **`profiles.paid`** (Fase 3) |
| `DELETE` | `/api/dev/entitlement?email=` | Clear test row — needs `DEV_API_KEY` |
| `POST` | `/api/webhooks/lemonsqueezy` | Only when `LEMONSQUEEZY_WEBHOOK_SECRET` is set |

## Data

- SQLite file: `server/data/singleword.db`
- Table **`test_entitlements`**: your dev toggles
- Table **`subscriptions`**: filled later by Lemon Squeezy webhooks

## When you add Lemon Squeezy

1. Set `LEMONSQUEEZY_WEBHOOK_SECRET` in `.env`.
2. Point the webhook URL at `/api/webhooks/lemonsqueezy`.
3. Pass **custom checkout data** with the user’s email so rows link correctly.

`GET /api/entitlement` treats the user as paid if **either** the test row says paid **or** the stored subscription status is active-like.

## Wire the reader app

The static reader calls **`GET /api/me/entitlement`** with the Supabase session (see repo **`docs/SUPABASE-FASE2.md`**). Fase 3 adds **`profiles.paid`** in Supabase — see **`docs/SUPABASE-FASE3.md`**.
