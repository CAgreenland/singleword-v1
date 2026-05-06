/**
 * After clone: create empty supabase-config.js if missing (so /supabase-config.js loads).
 * Real values come from `npm run build` + .env or from Vercel env at build time.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "supabase-config.js");

if (!fs.existsSync(target)) {
  fs.writeFileSync(
    target,
    "/* Placeholder — run: npm run build (with .env) or paste URL/anon key here for local dev */\n" +
      'window.__SUPABASE_URL="";\n' +
      'window.__SUPABASE_ANON_KEY="";\n' +
      'window.__SINGLEWORD_API_URL="";\n',
    "utf8"
  );
  console.log("[ensure-supabase-config] created", path.relative(root, target));
}
