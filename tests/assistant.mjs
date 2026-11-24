// Browser test of the writing assistant with a MOCKED Anthropic API (no real key, no network).
// Run: npm run assistant   (needs Playwright; see smoke.mjs for BROWSER / BROWSER_PATH / PLAYWRIGHT_MODULE)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const TEST_KEY = "sk-ant-test-fake-0123456789abcdefgh";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };

const pw = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const server = http.createServer(async (req, res) => {
  const rel = new URL(req.url, "http://x").pathname.replace(/^\//, "") || "index.html";
  const file = join(ROOT, decodeURIComponent(rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await pw[process.env.BROWSER ?? "webkit"].launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {});
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: "block" });
const page = await context.newPage();

let mode = "check";   // what the mocked API answers
const seen = [];
await context.route("https://api.anthropic.com/**", async (route) => {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
  seen.push({ key: req.headers()["x-api-key"], body: JSON.parse(req.postData()) });
  if (mode === "network") return route.abort();
  if (mode === "401") return route.fulfill({ status: 401, headers: CORS, contentType: "application/json", body: JSON.stringify({ error: { message: "invalid x-api-key" } }) });
  const payloads = {
    check: { language: "de", correct: false, corrected: "Ich habe Hunger.", explanation_tr: "Almancada 'Hunger haben' denir.", translation_tr: "Acıktım.", confidence: "high" },
    translate: { language: "de", de: "Guten Morgen", en: "Good morning", tr: "Günaydın" },
    xss: { language: "de", correct: false, corrected: "<img src=x onerror=window.__pwned=1>", explanation_tr: "<b>kalın</b>", translation_tr: "x", confidence: "low" },
  };
  return route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(payloads[mode]) }] }) });
});

let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log(`✔ ${name}`); } catch (err) { failed += 1; console.error(`✘ ${name}\n    ${err.message}`); }
};
const must = (ok, msg) => { if (!ok) throw new Error(msg); };
const base = `http://127.0.0.1:${server.address().port}/`;
const note = () => page.locator(".note-input");
const result = () => page.locator(".ai-result");
const ask = async (button) => { await page.getByRole("button", { name: button }).click(); await page.waitForFunction(() => !document.querySelector(".ai-result")?.textContent.includes("düşünüyor")); };
const openCard = async (text) => {
  await page.goto(`${base}#/study/devops/0`);
  await page.waitForSelector(".note-input");
  await note().fill(text);
};

await page.goto(base);
await page.waitForSelector("#view h1");

await step("anahtar yokken asistan ayarlara yönlendiriyor", async () => {
  await openCard("Ich bin Hunger.");
  must(await page.locator(".ai-hint").isVisible(), "ipucu görünmüyor");
  await ask("Notumdaki cümleyi yapay zekâ ile kontrol et");
  must((await result().textContent()).includes("API anahtarını ekle"), "anahtar uyarısı yok");
  must(seen.length === 0, "anahtarsız istek gönderildi");
});

await step("ayarlardan anahtar kaydediliyor, tamamı ekranda görünmüyor", async () => {
  await page.goto(`${base}#/settings`);
  await page.getByLabel("Anthropic API anahtarı").fill("yanlis-anahtar");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  must(await page.getByText("sk-ant-… ile başlamalı").count() > 0, "yanlış anahtar reddedilmedi");
  await page.getByLabel("Anthropic API anahtarı").fill(TEST_KEY);
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  const text = await page.locator("#view").innerText();
  must(text.includes("…efgh") && !text.includes(TEST_KEY), "durum satırı yanlış");
  await page.getByText("Yapay zekâ asistanı").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(4500);
  await page.screenshot({ path: join(ROOT, "test-output", "assistant-settings.png") });
});

await step("anahtar yedek dosyasına girmiyor", async () => {
  const leaked = await page.evaluate(async (key) => {
    const { exportBackup } = await import("./js/backup.js");
    return JSON.stringify(await exportBackup()).includes(key);
  }, TEST_KEY);
  must(!leaked, "anahtar yedeğe sızdı");
});

await step("Kontrol et: sonuç gösteriliyor, istek doğru gidiyor", async () => {
  mode = "check";
  await openCard("Ich bin Hunger.");
  await ask("Notumdaki cümleyi yapay zekâ ile kontrol et");
  const text = await result().innerText();
  must(text.includes("Düzeltme önerisi") && text.includes("Ich habe Hunger.") && text.includes("Acıktım."), `sonuç eksik: ${text}`);
  const last = seen.at(-1);
  must(last.key === TEST_KEY, "anahtar başlıkta gitmedi");
  must(last.body.messages[0].content === "Ich bin Hunger.", "gönderilen metin yanlış");
  must(JSON.stringify(last.body).includes("devops") === false, "kart bilgisi sızdı");
  await page.waitForTimeout(4500);
  await page.locator(".ai-box").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(ROOT, "test-output", "assistant-result.png") });
});

await step("düzeltme nota uygulanıyor ve kaydediliyor", async () => {
  await page.getByRole("button", { name: "Düzeltmeyi nota uygula" }).click();
  must(await note().inputValue() === "Ich habe Hunger.", "not güncellenmedi");
  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForSelector(".note-input");
  must(await note().inputValue() === "Ich habe Hunger.", "not kaydedilmedi");
});

await step("seçili kısım gönderiliyor, tüm not değil", async () => {
  mode = "translate";
  await note().fill("Eine Notiz. Guten Morgen. Noch eine.");
  await note().evaluate((t) => t.setSelectionRange(12, 24));
  await ask("Notumdaki metni çevir");
  must(seen.at(-1).body.messages[0].content === "Guten Morgen", `yanlış metin: ${seen.at(-1).body.messages[0].content}`);
  const text = await result().innerText();
  must(text.includes("Good morning") && text.includes("Günaydın") && text.includes("(orijinal)"), `çeviri eksik: ${text}`);
});

await step("model metni HTML olarak çalıştırılmıyor", async () => {
  mode = "xss";
  await note().fill("Test");
  await ask("Notumdaki cümleyi yapay zekâ ile kontrol et");
  must(await result().locator("img, b").count() === 0, "HTML öğesi oluştu");
  must(await page.evaluate(() => window.__pwned === undefined), "model çıktısı kod çalıştırdı");
  must((await result().innerText()).includes("Asistan emin değil"), "düşük güven uyarısı yok");
});

await step("hatalar anlaşılır Türkçe mesaj veriyor", async () => {
  mode = "401";
  await ask("Notumdaki cümleyi yapay zekâ ile kontrol et");
  must((await result().innerText()).includes("API anahtarı geçersiz"), "401 mesajı yok");
  mode = "network";
  await ask("Notumdaki cümleyi yapay zekâ ile kontrol et");
  must((await result().innerText()).includes("İnternet bağlantısı yok"), "ağ hatası mesajı yok");
  await note().fill("");
  await ask("Notumdaki cümleyi yapay zekâ ile kontrol et");
  must((await result().innerText()).includes("bir cümle yaz"), "boş not mesajı yok");
});

await step("telefon genişliğinde yatay taşma yok", async () => {
  mode = "check";
  await note().fill("Ich bin Hunger und Durst und ein sehr langes Wort Donaudampfschifffahrtsgesellschaft.");
  await ask("Notumdaki cümleyi yapay zekâ ile kontrol et");
  must(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "yatay taşma var");
  await page.goto(`${base}#/settings`);
  must(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "ayarlarda yatay taşma var");
});

await step("anahtarı sil çalışıyor", async () => {
  await page.getByRole("button", { name: "Anahtarı sil" }).click();
  must(await page.getByText("Henüz anahtar eklenmedi").count() > 0, "anahtar silinmedi");
  must(await page.evaluate(() => localStorage.getItem("ai-key")) === null, "depoda anahtar kaldı");
});

await browser.close();
server.close();
if (failed) { console.error(`${failed} adım başarısız`); process.exit(1); }
console.log("Asistan testi: tüm adımlar geçti (sahte API).");
