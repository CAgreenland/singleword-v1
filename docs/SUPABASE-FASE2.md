# Fase 2 — Entitlement con JWT de Supabase + API Node

Objetivo: el lector deja de depender solo de `localStorage` para “paid” y puede leer el estado real desde tu API (`server/`), validando el **access token** de Supabase en el servidor.

## 1. Clave JWT en el servidor (no es la anon key)

1. Supabase → **Project Settings** → **JWT Keys** (o **API** en proyectos antiguos).
2. Copia el **JWT signing secret** (a veces llamado *JWT Secret* / clave simétrica HS256).
3. En `server/.env` añade:

```env
SUPABASE_JWT_SECRET=tu_jwt_signing_secret
```

**No** uses la clave **anon** ni **service_role** aquí: solo el secreto que firma los JWT de Auth.

## 2. Arrancar la API

En `server/`:

```bash
npm install
npm run dev
```

Por defecto escucha en **http://127.0.0.1:3847**.

## 3. Probar el endpoint

Con un **access token** válido de un usuario (puedes sacarlo desde la consola del navegador tras iniciar sesión, o con la herramienta de Supabase):

```bash
curl -s http://127.0.0.1:3847/api/me/entitlement -H "Authorization: Bearer ACCESS_TOKEN"
```

Debe devolver JSON con `paid`, `email`, `source`, etc. (misma forma que `GET /api/entitlement?email=` pero sin exponer email en la URL).

**Orden de prioridad en `GET /api/me/entitlement`:** test (SQLite) → **`profiles.paid` en Supabase (Fase 3)** → Lemon en SQLite. Ver **`docs/SUPABASE-FASE3.md`**.

## 4. Conectar el lector (build estático)

En la **raíz** del repo (donde está `app.html`), en tu `.env`:

```env
SINGLEWORD_API_URL=http://127.0.0.1:3847
```

Luego:

```bash
npm run build
```

Eso escribe `window.__SINGLEWORD_API_URL` en **`supabase-config.js`**. Al abrir **`app.html`**, el script llama a `GET /api/me/entitlement` con el Bearer de Supabase y actualiza **`singlewordPaid`** en `localStorage` si la respuesta trae `paid: true/false`.

- Si la API no está configurada o falla la petición, se mantiene el valor anterior de `localStorage` (modo preview sigue existiendo).

## 5. Marcar “paid” en desarrollo

Sigue funcionando **`POST /api/dev/entitlement`** con `DEV_API_KEY` para poner `paid: true` al email del usuario que coincida con el JWT.

## 6. Producción

- Despliega `server/` en un host con HTTPS.
- Pon `SINGLEWORD_API_URL=https://tu-api.example.com` en Vercel (variables de entorno del **frontend**) y redeploy.
- En `server/.env` de producción: `SUPABASE_JWT_SECRET` del **mismo** proyecto Supabase.

## 7. Fase 3 (siguiente)

- Persistir plan en **Supabase** (`profiles`) y/o confiar solo en Lemon Squeezy vía webhooks ya existentes.
- Endurecer CORS en la API (orígenes permitidos explícitos) cuando tengas dominio fijo.
