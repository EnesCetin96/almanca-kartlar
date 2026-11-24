// Browser security checks: CSP is enforced, the app refuses to run in a foreign frame,
// and a hostile deck colour cannot make the page load anything from another site.
// Run: npm run security   (needs Playwright; see smoke.mjs for BROWSER / BROWSER_PATH / PLAYWRIGHT_MODULE)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const EVIL_HOST = "evil.example";
const EVIL_COLOR = `red;background:url(https://${EVIL_HOST}/track.png)`;

const serve = (handler) => new Promise((resolve) => { const s = http.createServer(handler); s.listen(0, "127.0.0.1", () => resolve(s)); });
const appServer = await serve(async (req, res) => {
  const rel = new URL(req.url, "http://x").pathname.replace(/^\//, "") || "index.html";
  const file = join(ROOT, decodeURIComponent(rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
const appUrl = `http://127.0.0.1:${appServer.address().port}/`;
// "Another site" on a different origin that tries to frame the app.
const attacker = await serve((_req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(`<iframe id="f" src="${appUrl}" width="800" height="600"></iframe>`); });

const pw = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await pw[process.env.BROWSER ?? "webkit"].launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {});
const context = await browser.newContext({ serviceWorkers: "block" });
const page = await context.newPage();

const evilRequests = [];
await context.route(`**://${EVIL_HOST}/**`, (route) => { evilRequests.push(route.request().url()); route.abort(); });
const violations = [];
await page.addInitScript(() => { addEventListener("securitypolicyviolation", (e) => { (window.__csp ??= []).push(`${e.violatedDirective} ${e.blockedURI}`); }); });

let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log(`✔ ${name}`); } catch (err) { failed += 1; console.error(`✘ ${name}\n    ${err.message}`); }
};
const must = (ok, msg) => { if (!ok) throw new Error(msg); };

await page.goto(appUrl);
await page.waitForSelector("#view h1");

await step("CSP etkin: eval ve satır içi betik engelleniyor", async () => {
  // page.evaluate runs outside the page's CSP, so inject a real inline script and see whether the page lets it run.
  const out = await page.evaluate(async () => {
    const s = document.createElement("script");
    s.textContent = "window.__inline = 'ran'";
    document.head.append(s);
    await new Promise((r) => setTimeout(r, 200));
    return { inline: window.__inline, violations: window.__csp ?? [] };
  });
  must(out.inline !== "ran", "satır içi betik çalıştı");
  must(out.violations.some((v) => v.startsWith("script-src")), `CSP ihlali kaydedilmedi: ${out.violations.join("; ")}`);
  await page.evaluate(() => { window.__csp = []; });
});

await step("ana ekranlarda CSP ihlali yok", async () => {
  for (const hash of ["#/", "#/decks", "#/category/is", "#/deck/devops", "#/study/devops/0", "#/settings", "#/stats", "#/starred"]) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(350);
  }
  const bad = (await page.evaluate(() => window.__csp ?? [])).filter((v) => !v.startsWith("script-src") && !v.startsWith("script-src-elem"));
  must(bad.length === 0, `beklenmeyen CSP ihlali: ${bad.join("; ")}`);
});

await step("kötü niyetli deste rengi dışarıya istek attırmıyor (veritabanında kayıtlıysa bile)", async () => {
  await page.evaluate(async (color) => {
    const db = await import("./js/db.js");
    await db.put("decks", { id: "evil", name: "Kötü", description: "", color, category: "own", order: 999 });
  }, EVIL_COLOR);
  await page.evaluate(() => { location.hash = "#/category/own"; });
  await page.waitForSelector("#view h2");
  await page.waitForTimeout(500);
  const style = await page.locator("#view h2").first().getAttribute("style");
  must(!/url\(/i.test(style ?? ""), `style içinde url( var: ${style}`);
  must(evilRequests.length === 0, `dışarıya istek gitti: ${evilRequests.join(", ")}`);
});

await step("yedekten gelen kötü renk temizleniyor", async () => {
  const color = await page.evaluate(async (evil) => {
    const { validateBackup } = await import("./js/importers.js");
    const card = { id: "c", deckId: "d", de: { word: "Haus", article: "das" }, en: { word: "house" }, tr: "ev" };
    return validateBackup({ app: "almanca-kartlar", decks: [{ id: "d", name: "D", color: evil }], cards: [card], cardState: [], ink: [], kv: [] }).data.decks[0].color;
  }, EVIL_COLOR);
  must(color === "#4f46e5", `renk temizlenmedi: ${color}`);
});

await step("başka bir sitenin çerçevesi içinde uygulama çalışmıyor", async () => {
  const framed = await context.newPage();
  await framed.goto(`http://127.0.0.1:${attacker.address().port}/`);
  const frame = framed.frameLocator("#f");
  await frame.getByText("başka bir sayfanın içinde çalışmaz").waitFor({ timeout: 5000 });
  must(await frame.locator("#nav a").count() === 0, "uygulama çerçevede çalıştı");
  await framed.close();
});

await step("gönderilen sayfada üçüncü taraf betik ya da dış kaynak yok", async () => {
  const hosts = new Set();
  const probe = await context.newPage();
  probe.on("request", (r) => { const u = new URL(r.url()); if (u.protocol.startsWith("http") && u.host !== new URL(appUrl).host) hosts.add(u.host); });
  await probe.goto(appUrl);
  await probe.waitForSelector("#view h1");
  for (const hash of ["#/decks", "#/study/devops/0", "#/settings"]) { await probe.evaluate((h) => { location.hash = h; }, hash); await probe.waitForTimeout(300); }
  must(hosts.size === 0, `dış adrese istek: ${[...hosts].join(", ")}`);
  await probe.close();
});

await browser.close();
appServer.close();
attacker.close();
if (failed) { console.error(`${failed} adım başarısız`); process.exit(1); }
console.log("Güvenlik testi: tüm adımlar geçti.");
