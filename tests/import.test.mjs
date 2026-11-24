import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, validateCard, importCsv, importJson, validateBackup, CSV_TEMPLATE } from "../js/importers.js";

let n = 0;
const newId = () => `id-${++n}`;
const ctx = (over = {}) => ({ decks: [], cards: [], newId, ...over });
const HEADER = "deck,de_article,de_word,de_plural,pos,en_word,tr,de_sentence,en_sentence,tr_sentence,level,tags";

test("parseCsv handles quotes, embedded commas/newlines, BOM and semicolons", () => {
  assert.deepEqual(parseCsv("﻿a,b\n\"x, y\",\"he said \"\"hi\"\"\"\n"), [["a", "b"], ["x, y", 'he said "hi"']]);
  assert.deepEqual(parseCsv("a;b\r\n1;2\r\n"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsv("a,b\n\"line1\nline2\",z"), [["a", "b"], ["line1\nline2", "z"]]);
  assert.deepEqual(parseCsv("a,b\n\n,\n1,2"), [["a", "b"], ["1", "2"]]);
});

test("template parses into one valid card", () => {
  const out = importCsv(CSV_TEMPLATE, ctx());
  assert.equal(out.cards.length, 1);
  assert.equal(out.decks.length, 1);
  assert.equal(out.cards[0].de.article, "der");
  assert.deepEqual(out.cards[0].tags, ["it", "isim"]);
});

test("importCsv skips bad rows with reasons and counts duplicates (file and existing)", () => {
  const csv = [HEADER,
    "D1,der,Server,,noun,server,sunucu,,,,,",
    "D1,der,server,,noun,server,sunucu,,,,,",
    "D1,xyz,Haus,,noun,house,ev,,,,,",
    ",das,Haus,,noun,house,ev,,,,,",
    "D1,die,Frist,,noun,deadline,süre,Die Frist läuft.,,,,",
    "D1,die,Lösung,,noun,solution,çözüm,,,,,"].join("\n");
  const existingDeck = { id: "d-exist", name: "d1", description: "", color: "#000" };
  const existing = [{ id: "c0", deckId: "d-exist", de: { word: "Lösung" } }];
  const out = importCsv(csv, ctx({ decks: [existingDeck], cards: existing }));
  assert.deepEqual(out.cards.map((c) => c.de.word), ["Server"]);
  assert.equal(out.decks.length, 0);
  assert.equal(out.duplicates, 2);
  assert.deepEqual(out.skipped.map((s) => s.row), [4, 5, 6]);
  assert.match(out.skipped[0].reason, /artikel/i);
  assert.match(out.skipped[2].reason, /de\/en\/tr/);
});

test("importCsv throws a clear error for missing columns or an empty file", () => {
  assert.throws(() => importCsv("deck,de_word\nA,B", ctx()), /eksik sütun: en_word, tr/);
  assert.throws(() => importCsv("", ctx()), /boş/);
});

test("validateCard trims, defaults and rejects malformed cards", () => {
  const ok = validateCard({ deckId: "d", de: { word: " Server ", article: "DER" }, en: { word: "server" }, tr: "sunucu" });
  assert.equal(ok.ok, true);
  assert.equal(ok.card.de.word, "Server");
  assert.equal(ok.card.de.article, "der");
  assert.equal(ok.card.level, "B1");
  assert.equal(validateCard(null).ok, false);
  assert.equal(validateCard({ de: { word: "x" }, en: { word: "y" } }).ok, false);
  assert.equal(validateCard({ de: { word: "x", article: "le" }, en: { word: "y" }, tr: "z" }).ok, false);
  const four = Array.from({ length: 4 }, () => ({ de: "a", en: "b", tr: "c" }));
  assert.equal(validateCard({ de: { word: "x" }, en: { word: "y" }, tr: "z", sentences: four }).ok, false);
  assert.equal(validateCard({ de: { word: "x".repeat(600) }, en: { word: "y" }, tr: "z" }).ok, false);
});

test("importJson accepts both shapes, keeps free ids, skips junk and duplicates", () => {
  const card = (word, id) => ({ id, deckId: "dk", de: { word }, en: { word: "w" }, tr: "t" });
  const json = JSON.stringify({ decks: [{ id: "dk", name: "Deste" }], cards: [card("A", "x1"), card("A", "x2"), card("B", "taken"), { nonsense: true }] });
  const out = importJson(json, ctx({ cards: [{ id: "taken", deckId: "other", de: { word: "Z" } }] }));
  assert.deepEqual(out.cards.map((c) => c.de.word), ["A", "B"]);
  assert.equal(out.cards[0].id, "x1");
  assert.notEqual(out.cards[1].id, "taken");
  assert.equal(out.duplicates, 1);
  assert.equal(out.skipped.length, 1);
  assert.equal(out.decks.length, 1);
  assert.equal(importJson(JSON.stringify([card("C", "c1")]), ctx()).decks[0].id, "dk");
  assert.throws(() => importJson("{oops", ctx()), /okunamadı/);
  assert.throws(() => importJson("{}", ctx()), /kart listesi/);
});

test("validateBackup rejects foreign files and drops malformed records", () => {
  assert.throws(() => validateBackup({ app: "other" }), /yedeği değil/);
  assert.throws(() => validateBackup({ app: "almanca-kartlar", decks: [] }), /eksik/);
  const good = { id: "c1", deckId: "d", de: { word: "A" }, en: { word: "a" }, tr: "t" };
  const out = validateBackup({
    app: "almanca-kartlar", version: 1, settings: { penOnly: false },
    decks: [{ id: "d", name: "D" }, { name: "no id" }],
    cards: [good, { id: "bad" }],
    cardState: [{ cardId: "c1", srs: {}, stats: {} }, { cardId: "c2" }],
    ink: [{ cardId: "c1", strokes: [] }, { cardId: "c9", strokes: "x" }],
    kv: [{ key: "progress", value: {} }, { value: 1 }],
  });
  assert.equal(out.skipped, 5);
  assert.deepEqual([out.data.decks.length, out.data.cards.length, out.data.cardState.length, out.data.ink.length, out.data.kv.length], [1, 1, 1, 1, 1]);
  assert.deepEqual(out.settings, { penOnly: false });
});
