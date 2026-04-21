# Cómo probar Single Word en tu PC

Hay **dos cosas distintas**: la **app** (lector en el navegador) y la **API** (backend en `server/`, opcional para pagos / pruebas).

## 1) Probar el lector (lo principal)

**Opción A — sin instalar nada más**  
Abre el archivo `app.html` con doble clic o arrástralo al navegador (Chrome/Edge).

**Opción B — con servidor local (recomendado)**  
En la carpeta del proyecto (`Single`):

```powershell
cd C:\Users\Claudio\Desktop\Single
npm.cmd install
npm.cmd run app
```

Luego en el navegador entra a: **http://localhost:5173/app.html**

*(Si PowerShell bloquea `npm`, usa `npm.cmd` como arriba.)*

## 2) Probar la API (backend SaaS)

Solo hace falta si quieres `/api/health`, entitlements de prueba, webhooks Lemon Squeezy, etc.

```powershell
cd C:\Users\Claudio\Desktop\Single
npm.cmd run dev
```

Abre **http://127.0.0.1:3847/api/health**

### Si sale “EADDRINUSE” / puerto 3847 ocupado

Ya hay otro proceso usando el puerto. **Cierra la otra terminal** donde dejaste `npm run dev` corriendo, o cambia en `server\.env` la línea `PORT=3847` por otro número (por ejemplo `PORT=3848`).

### Primera vez: dependencias

```powershell
cd C:\Users\Claudio\Desktop\Single
npm.cmd run setup
```

Eso instala lo de la raíz y lo de `server/`. Copia `server\.env.example` a `server\.env` y pon un `DEV_API_KEY` largo si vas a usar la API.

## Todo junto (lector + API)

En **una sola terminal**, desde la carpeta del proyecto:

```powershell
cd C:\Users\Claudio\Desktop\Single
npm.cmd run fullstack
```

- **Lector:** http://localhost:5173/app.html  
- **API:** http://127.0.0.1:3847/api/health  

Cierra con **Ctrl+C** (para ambos a la vez).

## Resumen rápido

| Qué quieres        | Comando / acción |
|--------------------|------------------|
| Lector + backend   | `npm.cmd run fullstack` |
| Solo leer textos   | Abre `app.html` o `npm.cmd run app` → http://localhost:5173/app.html |
| Solo API           | `npm.cmd run dev` → http://127.0.0.1:3847/api/health |

El lector **no necesita** que la API esté encendida para funcionar en modo actual (localStorage).
