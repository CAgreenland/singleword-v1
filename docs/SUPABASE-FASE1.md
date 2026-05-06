# Fase 1 — Supabase (proyecto, Auth y perfiles)

Sigue estos pasos en el **dashboard de Supabase** (no requieren cambios de código adicionales salvo variables y `npm run build`).

## 1. Crear el proyecto

1. Entra en [supabase.com](https://supabase.com) → **New project**.
2. Elige región cercana a tus usuarios y una contraseña fuerte para la base (guárdala en un gestor).

## 2. Autenticación por email + contraseña

1. **Authentication** → **Providers** → **Email**.
2. Activa **Email provider** (Sign in with email).
3. Para desarrollo, en **Authentication** → **Providers** → **Email** puedes desactivar **Confirm email** (más cómodo al probar). En producción conviene **activar** confirmación por email.

## 3. URLs del sitio

1. **Authentication** → **URL configuration**.
2. **Site URL:** tu URL de Vercel (ej. `https://tu-proyecto.vercel.app`) y para local `http://localhost:5173` (o el puerto que uses).
3. **Redirect URLs:** añade las mismas bases y, si hace falta, `http://localhost:5173/login.html` y `https://tu-proyecto.vercel.app/login.html` (Supabase a veces redirige tras magic link / recovery).

## 4. Claves para el front (solo anon)

1. **Project Settings** → **API**.
2. Copia:
   - **Project URL** → variable `SUPABASE_URL` en tu `.env` local y en **Vercel → Settings → Environment Variables**.
   - **anon public** → `SUPABASE_ANON_KEY` (misma ruta).

**No** uses la clave **service_role** en el navegador ni en Vercel como variable expuesta al cliente.

## 5. SQL: tabla `profiles` y RLS

1. En Supabase → **SQL Editor** → **New query**.
2. Pega el contenido de **`supabase/migrations/001_phase1_profiles.sql`** del repo y ejecútalo (**Run**).
3. Comprueba en **Table Editor** que existe **`profiles`** y que **RLS** está activo.

Esto crea un perfil por cada usuario nuevo en **Auth** (trigger sobre `auth.users`).

## 6. Variables en tu máquina y en Vercel

En la raíz del repo:

1. Copia `.env.example` → `.env`.
2. Rellena `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
3. Ejecuta:

```bash
npm run build
```

Eso genera **`supabase-config.js`** (gitignored) con esas variables para el HTML estático.

En **Vercel**: añade las mismas variables al proyecto y redeploy (el `build` de Vercel ejecuta `npm run build` y regenera `supabase-config.js` en el build).

## 7. Probar login en la app

1. `npm run app` (o tu servidor local).
2. Abre **`/login.html`** → **Create account** (o Sign up) con email y contraseña.
3. Si tienes confirmación por email activada, revisa la bandeja y el enlace de Supabase.
4. Tras entrar, deberías llegar al **reader** con sesión persistida (Supabase guarda sesión en `localStorage`).

## 8. Siguientes fases

- **`docs/SUPABASE-FASE2.md`** — JWT en el servidor y `GET /api/me/entitlement`.
- **`docs/SUPABASE-FASE3.md`** — `plan` / `paid` en `profiles` y sync desde la API.

Si el SQL del trigger falla por la versión de Postgres (p. ej. `execute procedure` vs `execute function`), en el mensaje de error de Supabase suele indicarse la sintaxis correcta; cambia esa línea del trigger según indique la documentación de tu proyecto.
