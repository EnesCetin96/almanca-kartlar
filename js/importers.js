// Pure parsing and validation for card import (CSV / JSON) and backup files.
// Nothing here touches the DOM or IndexedDB; bad rows are skipped and reported, never trusted.
export const CSV_COLUMNS = ["deck", "de_article", "de_word", "de_plural", "pos", "en_word", "tr", "de_sentence", "en_sentence", "tr_sentence", "level", "tags"];
export const CSV_TEMPLATE = `${CSV_COLUMNS.join(",")}\nDevOps & Cloud,der,Server,Server,noun,server,sunucu,Der Server ist nicht erreichbar.,The server is unreachable.,Sunucuya ulaşılamıyor.,B1,it|isim\n`;

const REQUIRED_COLUMNS = ["deck", "de_word", "en_word", "tr"];
const ARTICLES = ["der", "die", "das"];
const MAX_TEXT = 500;
const MAX_SENTENCES = 3;
const DECK_COLORS = ["#4f46e5", "#0d9488", "#d97706", "#db2777", "#2563eb", "#16a34a"];

const str = (v) => (typeof v === "string" ? v.trim() : "");
/** Deck colours end up in a style attribute, so only plain hex colours are allowed (blocks CSS injection from files). */
export const safeColor = (v, fallback = DECK_COLORS[0]) => (typeof v === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : fallback);
const cleanDeck = (d) => ({ ...d, id: str(d.id), name: str(d.name).slice(0, MAX_TEXT), description: str(d.description).slice(0, MAX_TEXT), color: safeColor(d.color) });
const isText = (v) => typeof v === "string" && v.length <= MAX_TEXT;
const keyOf = (deckId, word) => `${deckId}|${word.trim().toLowerCase()}`;

export function parseCsv(text) {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0];
  const delim = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Validates one card-shaped object. Returns { ok: true, card } with trimmed, defaulted fields or { ok: false, reason }. */
export function validateCard(raw) {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Kart nesnesi değil" };
  const de = raw.de ?? {};
  const en = raw.en ?? {};
  if (!str(de.word) || !isText(de.word)) return { ok: false, reason: "Almanca kelime eksik" };
  if (!str(en.word) || !isText(en.word)) return { ok: false, reason: "İngilizce kelime eksik" };
  if (!str(raw.tr) || !isText(raw.tr)) return { ok: false, reason: "Türkçe anlam eksik" };
  const article = de.article ? str(de.article).toLowerCase() : null;
  if (article !== null && !ARTICLES.includes(article)) return { ok: false, reason: `Geçersiz artikel: ${de.article}` };
  const sentences = Array.isArray(raw.sentences) ? raw.sentences : [];
  if (sentences.length > MAX_SENTENCES) return { ok: false, reason: `En fazla ${MAX_SENTENCES} cümle olabilir` };
  for (const s of sentences) {
    if (!s || !isText(s.de) || !isText(s.en) || !isText(s.tr) || !str(s.de) || !str(s.en) || !str(s.tr)) {
      return { ok: false, reason: "Cümleler için de, en ve tr birlikte gerekli" };
    }
  }
  const glosses = raw.glosses && typeof raw.glosses === "object" && !Array.isArray(raw.glosses) ? raw.glosses : {};
  const cleanGlosses = Object.fromEntries(Object.entries(glosses).filter(([k, v]) => isText(k) && isText(v)));
  return {
    ok: true,
    card: {
      id: str(raw.id),
      deckId: str(raw.deckId),
      level: str(raw.level) || "B1",
      tags: Array.isArray(raw.tags) ? raw.tags.filter(isText).map((t) => t.trim()).filter(Boolean) : [],
      de: { word: str(de.word), article, plural: str(de.plural) || null, pos: str(de.pos) || (article ? "noun" : "other"), note: str(de.note) },
      en: { word: str(en.word), pos: str(en.pos) || str(de.pos) || "other" },
      tr: str(raw.tr),
      sentences: sentences.map((s) => ({ de: str(s.de), en: str(s.en), tr: str(s.tr) })),
      glosses: cleanGlosses,
      ...(raw.review === true ? { review: true } : {}),
    },
  };
}

function deckResolver(existingDecks, newId) {
  const byName = new Map(existingDecks.map((d) => [d.name.trim().toLowerCase(), d]));
  const created = [];
  return {
    created,
    byName(name) {
      const hit = byName.get(name.trim().toLowerCase());
      if (hit) return hit;
      const deck = { id: newId(), name: name.trim(), description: "", color: DECK_COLORS[(existingDecks.length + created.length) % DECK_COLORS.length] };
      byName.set(deck.name.toLowerCase(), deck);
      created.push(deck);
      return deck;
    },
  };
}

/** ctx: { decks, cards (existing), newId }. Returns { decks (new), cards (new), skipped: [{row, reason}], duplicates }. */
export function importCsv(text, { decks, cards, newId }) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV dosyası boş.");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`CSV başlığında eksik sütun: ${missing.join(", ")}`);
  const col = (r, name) => str(r[header.indexOf(name)]);

  const resolver = deckResolver(decks, newId);
  const seen = new Set(cards.map((c) => keyOf(c.deckId, c.de.word)));
  const out = [];
  const skipped = [];
  let duplicates = 0;

  rows.slice(1).forEach((r, i) => {
    const rowNo = i + 2;
    const deckName = col(r, "deck");
    if (!deckName) { skipped.push({ row: rowNo, reason: "Deste adı eksik" }); return; }
    const parts = [col(r, "de_sentence"), col(r, "en_sentence"), col(r, "tr_sentence")];
    if (parts.some(Boolean) && !parts.every(Boolean)) { skipped.push({ row: rowNo, reason: "Cümle için de/en/tr üçü birlikte gerekli" }); return; }
    const pos = col(r, "pos");
    const check = validateCard({
      de: { word: col(r, "de_word"), article: col(r, "de_article") || null, plural: col(r, "de_plural"), pos: pos || undefined },
      en: { word: col(r, "en_word"), pos: pos || undefined },
      tr: col(r, "tr"),
      sentences: parts.every(Boolean) ? [{ de: parts[0], en: parts[1], tr: parts[2] }] : [],
      level: col(r, "level"),
      tags: col(r, "tags").split(/[|;]/).map((t) => t.trim()).filter(Boolean),
    });
    if (!check.ok) { skipped.push({ row: rowNo, reason: check.reason }); return; }
    const deck = resolver.byName(deckName);
    const key = keyOf(deck.id, check.card.de.word);
    if (seen.has(key)) { duplicates += 1; return; }
    seen.add(key);
    out.push({ ...check.card, id: newId(), deckId: deck.id });
  });
  return { decks: resolver.created, cards: out, skipped, duplicates };
}

/** Accepts an array of cards or { decks, cards } in the app's own card shape. */
export function importJson(text, { decks, cards, newId }) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("JSON dosyası okunamadı (biçim hatalı)."); }
  const list = Array.isArray(data) ? data : data?.cards;
  if (!Array.isArray(list)) throw new Error("JSON içinde kart listesi bulunamadı.");
  const known = new Map(decks.map((d) => [d.id, d]));
  const created = [];
  for (const d of Array.isArray(data?.decks) ? data.decks : []) {
    if (d && str(d.id) && str(d.name) && !known.has(str(d.id))) {
      const deck = { id: str(d.id), name: str(d.name), description: str(d.description), color: safeColor(d.color) };
      known.set(deck.id, deck);
      created.push(deck);
    }
  }
  const takenIds = new Set(cards.map((c) => c.id));
  const seen = new Set(cards.map((c) => keyOf(c.deckId, c.de.word)));
  const out = [];
  const skipped = [];
  let duplicates = 0;
  list.forEach((raw, i) => {
    const check = validateCard(raw);
    if (!check.ok) { skipped.push({ row: i + 1, reason: check.reason }); return; }
    const card = check.card;
    if (!card.deckId) { skipped.push({ row: i + 1, reason: "Deste (deckId) eksik" }); return; }
    if (!known.has(card.deckId)) {
      const deck = { id: card.deckId, name: card.deckId, description: "", color: DECK_COLORS[0] };
      known.set(deck.id, deck);
      created.push(deck);
    }
    const key = keyOf(card.deckId, card.de.word);
    if (seen.has(key)) { duplicates += 1; return; }
    seen.add(key);
    const id = card.id && !takenIds.has(card.id) ? card.id : newId();
    takenIds.add(id);
    out.push({ ...card, id });
  });
  return { decks: created, cards: out, skipped, duplicates };
}

/** Validates a backup file. Returns { data, skipped } with only well-formed records, or throws a Turkish Error. */
export function validateBackup(raw) {
  if (!raw || typeof raw !== "object" || raw.app !== "almanca-kartlar") throw new Error("Bu dosya bir Almanca Kartlar yedeği değil.");
  const arrays = ["decks", "cards", "cardState", "ink", "kv"];
  for (const k of arrays) if (!Array.isArray(raw[k])) throw new Error(`Yedekte "${k}" bölümü eksik.`);
  let skipped = 0;
  const keep = (list, ok) => list.filter((x) => { const good = ok(x); if (!good) skipped += 1; return good; });
  const cards = keep(raw.cards, (c) => {
    const check = validateCard(c);
    return check.ok && str(c.id) && str(c.deckId);
  }).map((c) => ({ ...c, ...validateCard(c).card, createdAt: c.createdAt, updatedAt: c.updatedAt }));
  const data = {
    decks: keep(raw.decks, (d) => d && str(d.id) && str(d.name)).map(cleanDeck),
    cards,
    cardState: keep(raw.cardState, (s) => s && str(s.cardId) && s.srs && typeof s.srs === "object" && s.stats && typeof s.stats === "object"),
    ink: keep(raw.ink, (n) => n && str(n.cardId) && Array.isArray(n.strokes)),
    kv: keep(raw.kv, (e) => e && str(e.key)),
  };
  const settings = raw.settings && typeof raw.settings === "object" && !Array.isArray(raw.settings) ? raw.settings : {};
  return { data, settings, skipped };
}
