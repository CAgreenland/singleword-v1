# Fase 3 — Plan y pago en `profiles` (Supabase)

Objetivo: guardar **`plan`** y **`paid`** (y campos Lemon opcionales) en la tabla **`public.profiles`**, sin que el usuario pueda falsificarlos desde el navegador. El servidor usa la clave **service_role** solo en `server/`.

## 1. SQL en Supabase

1. Abre **SQL Editor**.
2. Pega y ejecuta **`supabase/migrations/002_phase3_profiles_plan.sql`** (después de la migración Fase 1).

Eso añade columnas y un **trigger** que bloquea cambios a `paid` / `plan` / etc. salvo peticiones con rol **`service_role`** (tu API con `SUPABASE_SERVICE_ROLE_KEY`).

## 2. Variables en `server/.env`

Añade (además de `SUPABASE_JWT_SECRET` de Fase 2):

```env
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

- **Project URL** y **service_role**: Supabase → **Project Settings** → **API** (pestaña legacy o nueva; la **service_role** nunca va al frontend).

Reinicia la API: `npm run dev` en `server/`.

## 3. Cómo se decide si alguien está “paid”

En **`GET /api/me/entitlement`** el orden es:

1. **Test** en SQLite (`POST /api/dev/entitlement`) — solo desarrollo.
2. **`profiles.paid`** en Supabase (Fase 3).
3. **Suscripción Lemon** en SQLite (webhook existente), como antes.

Si no configuraste `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, el paso 2 se omite y sigue valiendo SQLite + test.

## 4. Sincronizar “paid” de prueba a Supabase

Con la API y variables listas, al llamar:

`POST /api/dev/entitlement` con `DEV_API_KEY`

se actualiza **SQLite** y, si existe fila en **`profiles`** con ese **email**, también **`profiles.paid`** / **`plan`**.

## 5. Siguiente (Fase 4)

Conectar **checkout Lemon Squeezy** y webhooks para escribir `paid` / `lemon_*` en `profiles` sin usar el endpoint de dev.
