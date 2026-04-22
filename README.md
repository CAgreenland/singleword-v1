# Single word — v1

Lector minimalista **palabra a palabra** (HTML/CSS/JS estático) + API opcional en Node para pruebas de plan / Lemon Squeezy.

**Repositorio:** [github.com/CAgreenland/singleword-v1](https://github.com/CAgreenland/singleword-v1)

## Contenido principal

| Ruta | Descripción |
|------|-------------|
| `index.html` | Landing |
| `app.html` | Lector |
| `login.html` | Inicio de sesión / crear cuenta (preview local) |
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
| `npm run app` | Sirve archivos estáticos (puerto 5173 por defecto) |
| `npm run dev` | API en modo watch (puerto 3847) |
| `npm run fullstack` | `app` + `dev` en paralelo |

## Despliegue (notas)

- **Vercel:** en “New Project” deja **Framework Preset → Other**, **Root Directory → `./`**. Con el **`vercel.json`** del repo: **Build** vacío y **Output** en la raíz (sitio estático). No hace falta desplegar `server/` aquí; la API va en otro servicio si la usas.
- **Netlify / similar:** mismo criterio: publicar la raíz como estático, sin build.
- **Supabase / auth real:** integra después; el login actual es preview con `localStorage`.
- **Lemon Squeezy:** configura el webhook apuntando a tu API pública y `LEMONSQUEEZY_WEBHOOK_SECRET` en `.env` del servidor. Ver `server/README.md`.

## Seguridad

- No subas **`.env`** ni claves (ya están en `.gitignore`).
- No pongas **service role** de Supabase ni secretos de Lemon en el frontend.

## Licencia

Uso del proyecto según lo definas en el repositorio; añade un `LICENSE` si lo necesitas.
