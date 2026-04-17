# Creator Analytics dashboard

Vite + React + TypeScript + **Tailwind CSS v3**. UI follows the design tokens and principles in `public/design.json` (HoomenX-inspired: black field, white type, pill controls, serif + sans pairing).

## Run locally

**Windows:** double-click `start-dashboard.cmd` in this folder (or follow below).

```bash
cd creator-dashboard
npm install
npm run dev
```

In your browser open **http://localhost:5173** (Vite prints the exact URL in the terminal).

Optional: auto-open browser — `npm run dev:open` (after `npm install`).

### If it still fails

1. **Install Node.js LTS** from [nodejs.org](https://nodejs.org), then **restart the terminal** and run `node -v` / `npm -v`.
2. You must run **`npm install`** once so a `node_modules` folder appears.
3. **`npm run dev`** must stay running; open **http://localhost:5173** in the browser.
4. If `'npm' is not recognized` → Node isn’t installed or not on PATH.
5. If the port is busy → use `npx vite --port 5174` and open `http://localhost:5174`.

## Build

```bash
npm run build
npm run preview
```
