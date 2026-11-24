// Layout check: renders EVERY card face at phone, tablet and desktop widths and reports
// headwords that overflow their column or language blocks that overlap.
// Run: npm run layout   (same Playwright setup as tests/smoke.mjs)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
// Content widths of the card: phone 375 / 320, iPad portrait, iPad landscape (with sidebar), desktop.
const WIDTHS = [288, 343, 520, 770, 930, 1180];

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
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForSelector("#view h1");

const report = await page.evaluate(async (widths) => {
  const { renderCardFace } = await import("/js/views/card-face.js");
  const { cards } = await (await fetch("/data/starter-decks.json")).json();
  const host = document.createElement("div");
  document.body.append(host);
  const out = {};
  for (const w of widths) {
    host.style.cssText = `position:absolute;left:0;top:0;width:${w}px`;
    const bad = [];
    for (const card of cards) {
      host.replaceChildren(renderCardFace(card));
      const face = host.firstElementChild.getBoundingClientRect();
      const heads = [...host.querySelectorAll(".word-main")];
      for (const h of heads) {
        const r = h.getBoundingClientRect();
        if (h.scrollWidth > h.clientWidth + 1 || r.right > face.right + 1) bad.push(`${card.de.word}: taşma`);
      }
      const [a, b] = [...host.querySelectorAll("section")].map((s) => s.getBoundingClientRect());
      const sameRow = Math.abs(a.top - b.top) < 4;
      if (sameRow && a.right > b.left + 1) bad.push(`${card.de.word}: DE/EN üst üste`);
      const wide = [...host.querySelectorAll("*")].find((el) => el.getBoundingClientRect().right > face.right + 1);
      if (wide && !bad.length) bad.push(`${card.de.word}: ${wide.className || wide.tagName} karttan taşıyor`);
    }
    out[w] = bad;
  }
  host.remove();
  return out;
}, WIDTHS);

let failed = 0;
for (const [w, bad] of Object.entries(report)) {
  failed += bad.length;
  console.log(`${bad.length ? "✖" : "✔"} ${w}px: ${bad.length ? `${bad.length} sorun — ${[...new Set(bad)].slice(0, 6).join(" · ")}` : "sorun yok"}`);
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
