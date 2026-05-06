# Single word — v1

Lector minimalista **palabra a palabra** (HTML/CSS/JS estático) + API opcional en Node para pruebas de plan / Lemon Squeezy.

**Repositorio:** [github.com/CAgreenland/singleword-v1](https://github.com/CAgreenland/singleword-v1)

## Contenido principal

| Ruta | Descripción |
|------|-------------|
| `index.html` | Landing |
| `app.html` | Lector |
| `login.html` | Inicio de sesión / crear cuenta (preview local o Supabase si configuras `.env` + build) |
| `server/` | API Express (SQLite): health, entitlement de prueba, webhook Lemon Squeezy |

## Puesta en marcha local

### Solo el lector (recomendado)

```bash
npm install
npm run app
```

Abre **http://localhost:5173/app.html** (o el puerto que indique la consola).

### Lector + API a la vez

```bash
npm run setup    # primera vez: dependencias raíz + server/
npm run fullstack
```

- Web: **http://localhost:5173/app.html**
- API: **http://127.0.0.1:3847/api/health**

Más detalle en **`LEEME-PROBAR.md`**.

### API solo (`server/`)

```bash
cd server
copy .env.example .env   # Windows: ajusta DEV_API_KEY
npm install
npm run dev
```

Documentación de endpoints: **`server/README.md`**.

## Scripts (raíz del repo)

| Script | Uso |
|--------|-----|
| `npm run setup` | `npm install` + `npm install` en `server/` |
| `npm run build` | Genera `supabase-config.js` desde `.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) |
| `npm run app` | Sirve archivos estáticos (puerto 5173 por defecto) |
| `npm run dev` | API en modo watch (puerto 3847) |
| `npm run fullstack` | `app` + `dev` en paralelo |

## Despliegue (notas)

- **Vercel:** **Framework Preset → Other**, **Root Directory → `./`**. El **`vercel.json`** ejecuta **`npm install`** y **`npm run build`** (genera `supabase-config.js` en el servidor de build). Variables: **`SUPABASE_URL`** y **`SUPABASE_ANON_KEY`**. La carpeta **`server/`** no se despliega en este flujo; si necesitas la API en producción, hazlo en Railway, Render, Fly.io, etc.
- **Netlify:** **Build command** `npm run build`, **Publish directory** `.` (raíz del repo), y las mismas variables en **Site configuration → Environment variables**.
- **Supabase Fase 1:** **`docs/SUPABASE-FASE1.md`** (SQL, RLS, URLs).
- **Supabase Fase 2:** **`docs/SUPABASE-FASE2.md`** (JWT en `server/`, entitlement por sesión, `SINGLEWORD_API_URL` en el build).
- **Supabase Fase 3:** **`docs/SUPABASE-FASE3.md`** (`profiles.plan` / `paid`, trigger anti-fraude, `service_role` en `server/`).
- **Lemon Squeezy:** webhook hacia tu API pública y `LEMONSQUEEZY_WEBHOOK_SECRET` en el servidor. Ver **`server/README.md`**.

### Producción: checklist para usuarios reales (Vercel + Supabase)

1. **Repositorio en GitHub** (u otro Git) con el código que quieres publicar.
2. **[vercel.com](https://vercel.com)** → **Add New… → Project** → importa el repo. Deja **Root** en la raíz; no cambies el `vercel.json` salvo que sepas por qué.
3. **Variables de entorno en Vercel** (Settings → Environment Variables), para **Production** (y Preview si quieres probar PRs):
   - `SUPABASE_URL` = URL del proyecto (Supabase → Project Settings → API).
   - `SUPABASE_ANON_KEY` = clave **anon public** (la misma pantalla). **No** uses la **service_role** aquí.
4. **Deploy.** Tras el primer deploy, copia la URL pública (ej. `https://tu-app.vercel.app`).
5. **Supabase** → **Authentication** → **URL configuration**:
   - **Site URL:** tu URL de Vercel (y opcionalmente `http://localhost:5173` para local).
   - **Redirect URLs:** incluye `https://tu-app.vercel.app/login.html` y, si usas recuperación de contraseña, la misma base; añade también las URLs de preview de Vercel si pruebas en ramas (`https://*.vercel.app` solo si Supabase lo permite en tu plan; si no, añade cada preview a mano).
6. En Supabase, ejecuta en **SQL Editor** las migraciones **`supabase/migrations/001_phase1_profiles.sql`** y, para plan/pago, **`002_phase3_profiles_plan.sql`** (Fase 3).
7. **Redeploy** en Vercel si cambiaste variables después del primer build (**Deployments → … → Redeploy**).

**Qué obtienen los usuarios:** el lector y el login con **Supabase** funcionan en esa URL pública. El flag de “pago” / cupos avanzados que aún dependan del **preview en `localStorage`** o de la **API de prueba en `server/`** no sustituyen a un backend de facturación hasta que conectes Lemon Squeezy + API en un host con URL pública y JWT de Supabase en servidor (fases siguientes).

## Seguridad

- No subas **`.env`** ni claves (ya están en `.gitignore`).
- No pongas **service role** de Supabase ni secretos de Lemon en el frontend.

## Licencia

Uso del proyecto según lo definas en el repositorio; añade un `LICENSE` si lo necesitas.
