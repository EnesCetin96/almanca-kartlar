// Guards offline mode: every file the app ships must be in the service worker's precache list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sw = readFileSync(join(root, "sw.js"), "utf8");
const listed = [...sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [relative(root, p).replaceAll("\\", "/")];
  });
}

test("every listed asset exists", () => {
  for (const a of listed) if (a !== "./") assert.ok(existsSync(join(root, a)), `sw.js listesinde var ama dosya yok: ${a}`);
});

test("every shipped file is precached", () => {
  const shipped = ["css", "js", "data", "icons"].flatMap((d) => walk(join(root, d)));
  const missing = shipped.filter((f) => !listed.includes(f));
  assert.deepEqual(missing, [], `sw.js ASSETS listesine eklenmemiş: ${missing.join(", ")}`);
});

test("manifest and index are precached", () => {
  assert.ok(listed.includes("index.html") && listed.includes("manifest.webmanifest"));
});
