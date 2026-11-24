// Palette check: screenshots of every palette (light + dark) and WCAG contrast of the text/background pairs.
// Run: npm run palettes   → test-output/palette-*.png ; exits 1 when a pair is below 4.5:1.
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = join(ROOT, "test-output");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const PALETTES = ["kahve", "bordo", "lacivert", "klasik"];
const PAIRS = [
  ["text", "bg"], ["text", "surface"], ["text-dim", "bg"], ["text-dim", "surface"], ["text", "surface-2"],
  ["primary-text", "primary"], ["primary", "primary-soft"], ["primary", "surface"],
  ["der", "surface"], ["die", "surface"], ["das", "surface"], ["ok", "ok-bg"], ["bad", "bad-bg"],
];
const MIN_RATIO = 4.5;

const pw = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const server = http.createServer(async (req, res) => {
  const rel = new URL(req.url, "http://x").pathname.replace(/^\//, "") || "index.html";
  const file = join(ROOT, decodeURIComponent(rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
await mkdir(OUT, { recursive: true });
const browser = await pw[process.env.BROWSER ?? "webkit"].launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {});

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

let failures = 0;
for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1194, height: 834 } });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForSelector("#view h1");
  for (const palette of PALETTES) {
    await page.evaluate((p) => { const d = document.documentElement; if (p === "kahve") delete d.dataset.palette; else d.dataset.palette = p; }, palette);
    const vars = await page.evaluate((names) => {
      const css = getComputedStyle(document.documentElement);
      return Object.fromEntries(names.map((n) => [n, css.getPropertyValue(`--${n}`).trim()]));
    }, [...new Set(PAIRS.flat())]);
    for (const [fg, bg] of PAIRS) {
      const r = ratio(vars[fg], vars[bg]);
      if (r < MIN_RATIO) { failures += 1; console.error(`✘ ${palette}/${scheme}: --${fg} on --${bg} = ${r.toFixed(2)}:1`); }
    }
    for (const [name, hash] of [["home", "#/"], ["card", "#/study/devops/0"], ["decks", "#/decks"]]) {
      await page.evaluate((x) => { location.hash = x; }, hash);
      await page.waitForTimeout(200);
      await page.waitForFunction(() => document.querySelector("#view")?.children.length > 0 && !document.querySelector("#view .empty"));
      await page.waitForTimeout(300);
      if (name === "card") {
        await page.locator('[lang="de"] .tr-chip').click();
        await page.locator(".sentence-toggle").first().click();
      }
      await page.screenshot({ path: join(OUT, `palette-${palette}-${name}-${scheme}.png`) });
    }
  }
  await context.close();
}
await browser.close();
server.close();
if (failures) { console.error(`${failures} kontrast sorunu`); process.exit(1); }
console.log(`✔ ${PALETTES.length} palet × 2 tema: tüm yazı/zemin çiftleri ≥ ${MIN_RATIO}:1. Ekran görüntüleri: test-output/palette-*.png`);
