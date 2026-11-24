// Design screenshots of a long-word card on phone, tablet and desktop (light + dark).
// Run: npm run screens   → test-output/design-*.png
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = join(ROOT, "test-output");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const VIEWS = [
  ["phone", 375, 812], ["phone-small", 320, 640], ["ipad-portrait", 834, 1194], ["ipad-landscape", 1194, 834], ["desktop", 1440, 900],
];
const ROUTES = [["card", "#/study/finans/26"], ["choice", "#/session/choice/deck%3Afinans"]];

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

for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({ serviceWorkers: "allow", colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForSelector("#view h1");
  for (const [name, w, h] of VIEWS) {
    await page.setViewportSize({ width: w, height: h });
    for (const [what, hash] of ROUTES) {
      await page.evaluate((x) => { location.hash = x; }, hash);
      await page.waitForTimeout(500);
      if (what === "card") {
        await page.locator('[lang="de"] .tr-chip').click();
        await page.locator(".sentence-toggle").first().click();
      }
      await page.screenshot({ path: join(OUT, `design-${what}-${name}-${scheme}.png`) });
    }
  }
  await context.close();
}
await browser.close();
server.close();
console.log("Ekran görüntüleri: test-output/design-*.png");
