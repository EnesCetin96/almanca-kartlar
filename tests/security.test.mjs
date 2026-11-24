// Security guards: untrusted import/backup files must not smuggle CSS, and the page ships a strict CSP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importJson, safeColor, validateBackup } from "../js/importers.js";

const EVIL = "red;background:url(https://evil.example/track.png)";
const GOOD = "#0d9488";
const card = { id: "c1", deckId: "d1", de: { word: "Server", article: "der" }, en: { word: "server" }, tr: "sunucu" };

test("safeColor accepts hex colours only", () => {
  assert.equal(safeColor("#0d9488"), "#0d9488");
  assert.equal(safeColor("#ABC"), "#ABC");
  for (const bad of [EVIL, "red", "#12", "#12345g", "url(x)", "#0d9488;x", "", null, undefined, 7, {}]) {
    assert.equal(safeColor(bad), "#4f46e5", `reddedilmedi: ${String(bad)}`);
  }
  assert.equal(safeColor("nope", "#111111"), "#111111");
});

test("importJson does not keep a CSS-injecting deck colour", () => {
  const out = importJson(JSON.stringify({ decks: [{ id: "d1", name: "Test", color: EVIL }, { id: "d2", name: "Ok", color: GOOD }], cards: [card] }), { decks: [], cards: [], newId: () => "n" });
  const colors = Object.fromEntries(out.decks.map((d) => [d.id, d.color]));
  assert.equal(colors.d1, "#4f46e5");
  assert.equal(colors.d2, GOOD);
});

test("validateBackup cleans deck colours and text fields of decks", () => {
  const raw = {
    app: "almanca-kartlar", decks: [{ id: "d1", name: "Test", description: 5, color: EVIL, order: 3, category: "is" }],
    cards: [card], cardState: [], ink: [], kv: [],
  };
  const [deck] = validateBackup(raw).data.decks;
  assert.equal(deck.color, "#4f46e5");
  assert.equal(deck.description, "");
  assert.equal(deck.order, 3);
  assert.equal(deck.category, "is");
});

test("index.html ships a strict Content-Security-Policy", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];
  assert.ok(csp, "CSP meta etiketi yok");
  const dir = Object.fromEntries(csp.split(";").map((d) => d.trim()).filter(Boolean).map((d) => { const [k, ...v] = d.split(/\s+/); return [k, v]; }));
  assert.deepEqual(dir["script-src"], ["'self'"], "script-src yalnızca 'self' olmalı");
  assert.deepEqual(dir["object-src"], ["'none'"]);
  assert.deepEqual(dir["base-uri"], ["'none'"]);
  assert.deepEqual(dir["form-action"], ["'none'"]);
  assert.deepEqual([...dir["connect-src"]].sort(), ["'self'", "https://api.anthropic.com"]);
  assert.ok(!csp.includes("unsafe-eval"), "unsafe-eval olmamalı");
  assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), "script-src'de unsafe-inline olmamalı");
  assert.ok(!/https?:\/\/(?!api\.anthropic\.com)/.test(csp), "beklenmeyen dış kaynak izni");
});
