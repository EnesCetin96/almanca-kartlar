// End-to-end smoke test in an iPad Pro 11 profile. Run: npm run smoke
//   BROWSER=webkit (default) | chromium     PLAYWRIGHT_MODULE=<file URL of playwright/index.mjs> (optional)
//   BROWSER_PATH=<browser executable> (optional, e.g. an already installed Chromium)
// Needs Playwright:  npm i -D playwright  &&  npx playwright install webkit
// Screenshots (landscape, portrait, dark) go to test-output/.
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SHOTS = join(ROOT, "test-output");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };

const pw = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browserName = process.env.BROWSER ?? "webkit";
const { defaultBrowserType, ...ipad } = pw.devices["iPad Pro 11 landscape"];

const server = http.createServer(async (req, res) => {
  const rel = new URL(req.url, "http://x").pathname.replace(/^\//, "") || "index.html";
  const file = join(ROOT, decodeURIComponent(rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

await mkdir(SHOTS, { recursive: true });
const browser = await pw[browserName].launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {});
const context = await browser.newContext({ ...ipad, serviceWorkers: "allow" });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const results = [];
async function step(name, fn) {
  try { await fn(); results.push([true, name]); console.log(`✔ ${name}`); }
  catch (e) { results.push([false, name]); console.log(`✖ ${name}\n    ${e.message.split("\n")[0]}`); }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(500); };
const idb = (store) => page.evaluate((s) => new Promise((res, rej) => {
  const o = indexedDB.open("almanca-kartlar");
  o.onerror = () => rej(o.error);
  o.onsuccess = () => { const g = o.result.transaction(s).objectStore(s).getAll(); g.onsuccess = () => res(g.result); };
}), store);
const shot = (name) => page.screenshot({ path: join(SHOTS, `${name}.png`) });

await step("uygulama açılıyor, 3 kategori ve konular görünüyor", async () => {
  await page.goto(base);
  await page.waitForSelector("#view h1");
  must((await page.title()) === "Almanca Kartlar", "başlık yanlış");
  await go("#/decks");
  must((await page.locator("#view .tile").count()) === 3, "3 kategori bekleniyordu");
  await go("#/category/is");
  must((await page.locator("#view .tile").first().innerText()).includes("IT, DevOps"), "İş kategorisinde ilk konu IT olmalı");
  await go("#/category/gunluk");
  must((await page.locator("#view .tile").count()) >= 3, "Günlük hayat kategorisinde konular yok");
  await go("#/deck/yemek");
  must((await page.locator("#view .grid a").count()) === 37, "Kafe/restoran konusunda 37 kart bekleniyordu");
});

await step("kart: DE+EN kelime ve cümleler; kelimeye dokununca Türkçe açılıp kapanıyor", async () => {
  await go("#/study/devops/0");
  const de = page.locator('[lang="de"] .word-main');
  must((await de.innerText()).includes("Server"), "Almanca kelime yok");
  must((await page.locator('[lang="en"] .word-main').innerText()).includes("server"), "İngilizce kelime yok");
  must((await page.locator('[lang="de"] .sentence').first().innerText()).includes("Server"), "Almanca cümle yok");
  must((await page.locator('[lang="en"] .sentence').first().innerText()).includes("server"), "İngilizce cümle yok");
  const chip = page.locator('[lang="de"] .tr-chip');
  must(!(await chip.innerText()).includes("sunucu"), "Türkçe başta gizli olmalı");
  await de.tap();
  must((await chip.innerText()).includes("sunucu") && (await chip.getAttribute("aria-expanded")) === "true", "Türkçe anlam açılmadı");
  await de.tap();
  must(!(await chip.innerText()).includes("sunucu"), "Türkçe anlam kapanmadı");
  await chip.tap();
  must((await chip.innerText()).includes("sunucu"), "Türkçesi düğmesi anlamı açmadı");
  await chip.tap();
});

await step("⭐ işaretleyince Tekrar listem'de görünüyor", async () => {
  await page.getByRole("button", { name: "Tekrar listesine ekle/çıkar" }).tap();
  await page.waitForTimeout(300);
  await go("#/starred");
  must((await page.locator("#view .list-row").first().innerText()).includes("Server"), "işaretli kart listede yok");
  must((await page.locator("#view h1").innerText()).includes("1"), "sayaç 1 olmalı");
});

await step("kalem (pointerType: pen) çizgisi IndexedDB'ye yazılıyor, yenileyince geri geliyor", async () => {
  await go("#/study/devops/0");
  await page.getByRole("button", { name: "El yazısı not al" }).tap();
  await page.evaluate(async () => {
    const c = document.querySelector(".ink-canvas");
    const r = c.getBoundingClientRect();
    const fire = (type, x, y, pressure) => c.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: "pen", pressure, clientX: r.left + x, clientY: r.top + y, bubbles: true, isPrimary: true, buttons: 1 }));
    fire("pointerdown", 40, 40, 0.2);
    for (let i = 1; i <= 8; i++) fire("pointermove", 40 + i * 40, 40 + Math.sin(i) * 25, 0.2 + i * 0.08);
    fire("pointerup", 360, 50, 0.7);
  });
  await page.waitForTimeout(400);
  const ink = await idb("ink");
  must(ink.length === 1 && ink[0].strokes[0].points.length >= 8, "çizgi IndexedDB'ye yazılmadı");
  await page.reload();
  await page.waitForSelector(".ink-canvas");
  await page.waitForTimeout(600);
  const painted = await page.evaluate(() => {
    const c = document.querySelector(".ink-canvas");
    return c.getContext("2d").getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
  });
  must(painted, "yenilemeden sonra çizgi görünmüyor");
  await go("#/deck/devops");
  must((await page.locator('#view [aria-label="notu var"]').count()) >= 1, "✍️ rozeti yok");
});

await step("kart çalışma oturumu: puan, seri ve günlük sayaç güncelleniyor", async () => {
  await go("#/session/flip/new");
  await page.getByRole("button", { name: "Göster" }).tap();
  await page.locator(".grade-good").tap();
  await page.waitForTimeout(500);
  const kv = await idb("kv");
  const p = kv.find((e) => e.key === "progress").value;
  must(p.xp >= 10 && p.streak === 1 && p.dailyDone >= 1, `ilerleme yazılmadı: ${JSON.stringify(p)}`);
});

await step("yazarak cevap: yanlış cevap kırmızı panel gösteriyor", async () => {
  await go("#/session/typing/deck%3Adevops");
  await page.locator(".answer-input").fill("xyz");
  await page.locator(".answer-box .btn-primary").tap();
  await page.waitForSelector(".feedback.bad");
});

await step("yeni kart ekleniyor", async () => {
  const before = (await idb("cards")).length;
  await go("#/card/new/jobs");
  await page.fill('[name="deWord"]', "Gehaltserhöhung");
  await page.selectOption('[name="article"]', "die");
  await page.fill('[name="enWord"]', "pay rise");
  await page.fill('[name="tr"]', "maaş zammı");
  await page.locator('form button[type="submit"]').tap();
  await page.waitForTimeout(500);
  must((await idb("cards")).length === before + 1, "kart eklenmedi");
});

await step("çevrimdışı: internet kapalıyken uygulama açılıyor", async () => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => (await caches.keys()).length > 0 && (await (await caches.open((await caches.keys())[0])).keys()).length > 10);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector("#view h1");
  await go("#/study/devops/0");
  must((await page.locator('[lang="de"] .word-main').innerText()).includes("Server"), "çevrimdışı kart açılmadı");
  await context.setOffline(false);
});

await step("en uzun 8 Almanca kelime kartta sütundan taşmıyor (yatay ve dikey)", async () => {
  const cards = await idb("cards");
  const longest = [...cards].sort((a, b) => b.de.word.length - a.de.word.length).slice(0, 8);
  for (const size of [{ width: 1194, height: 834 }, { width: 834, height: 1194 }]) {
    await page.setViewportSize(size);
    for (const c of longest) {
      const idx = cards.filter((x) => x.deckId === c.deckId).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9)).findIndex((x) => x.id === c.id);
      await go(`#/study/${c.deckId}/${idx}`);
      const bad = await page.evaluate(() => [...document.querySelectorAll(".word-main")].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.innerText));
      must(bad.length === 0, `${c.de.word} ${size.width}px: taşıyor (${bad})`);
    }
  }
  await page.setViewportSize({ width: 1194, height: 834 });
});

await step("ekran görüntüleri: yatay, dikey, koyu tema", async () => {
  for (const [name, hash] of [["home", "#/"], ["card", "#/study/devops/1"], ["choice", "#/session/choice/deck%3Adevops"], ["settings", "#/settings"]]) {
    await go(hash);
    await shot(`landscape-${name}`);
  }
  await page.setViewportSize({ width: 834, height: 1194 });
  for (const [name, hash] of [["home", "#/"], ["card", "#/study/devops/1"], ["settings", "#/settings"]]) {
    await go(hash);
    await shot(`portrait-${name}`);
    must(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${name}: yatay taşma var`);
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await go("#/study/devops/1");
  await shot("portrait-card-dark");
  must(await page.evaluate(() => getComputedStyle(document.body).backgroundColor === "rgb(27, 21, 16)"), "koyu tema uygulanmadı");
});

await step("konsolda hata yok", async () => {
  must(consoleErrors.length === 0, consoleErrors.join(" | "));
});

await browser.close();
server.close();
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} adım geçti (${browserName}, iPad Pro 11). Ekran görüntüleri: test-output/`);
process.exit(failed ? 1 : 0);
