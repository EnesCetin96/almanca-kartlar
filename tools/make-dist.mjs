// Copies only the files the app needs into dist/ (drag that folder to Netlify Drop).
// Run: node tools/make-dist.mjs
import { cpSync, rmSync, mkdirSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("dist/", ROOT);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const f of ["index.html", "manifest.webmanifest", "sw.js", "css", "js", "data", "icons"]) {
  cpSync(new URL(f, ROOT), new URL(f, OUT), { recursive: true });
}
console.log("dist/ hazır. Netlify Drop'a bu klasörü sürükle.");
