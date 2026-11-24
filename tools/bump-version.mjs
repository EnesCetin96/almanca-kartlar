// Increments the service worker cache version (v6 -> v7) so installed apps fetch the new files.
// Run: node tools/bump-version.mjs
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../sw.js", import.meta.url);
const src = readFileSync(file, "utf8");
const m = src.match(/const VERSION = "v(\d+)";/);
if (!m) throw new Error('sw.js içinde `const VERSION = "vN";` bulunamadı.');
const next = `v${Number(m[1]) + 1}`;
writeFileSync(file, src.replace(m[0], `const VERSION = "${next}";`));
console.log(`Önbellek sürümü: v${m[1]} -> ${next}`);
