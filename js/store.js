// Domain-level data access. Card content and user state live in separate stores.
import * as db from "./db.js";
import { DEFAULT_SRS } from "./srs.js";

export const DEFAULT_PROGRESS = Object.freeze({
  xp: 0, streak: 0, lastStudyDate: null, dailyGoal: 10, dailyDone: 0, history: [],
});

export const newCardState = (cardId) => ({
  cardId,
  starred: false,
  note: "",
  srs: { ...DEFAULT_SRS },
  stats: { seen: 0, correct: 0, wrong: 0 },
});

/**
 * Installs bundled starter content on first run or when a newer content version ships.
 * Starter decks and categories are refreshed; a starter card is replaced only if the user never
 * edited it (updatedAt === createdAt), so edits, own cards and progress are never lost.
 * Returns true if it wrote.
 */
export async function seedIfNeeded() {
  const seeded = await db.get("kv", "seeded");
  const res = await fetch("data/starter-decks.json");
  if (!res.ok) throw new Error("Başlangıç destesi yüklenemedi.");
  const data = await res.json();
  if (seeded && seeded.value >= data.version) return false;
  const existing = new Map((await db.getAll("cards")).map((c) => [c.id, c]));
  const now = new Date().toISOString();
  const cards = data.cards.flatMap((c) => {
    const cur = existing.get(c.id);
    if (!cur) return [{ ...c, createdAt: now, updatedAt: now }];
    return cur.updatedAt === cur.createdAt ? [{ ...c, createdAt: cur.createdAt, updatedAt: cur.updatedAt }] : [];
  });
  await db.putMany("decks", data.decks);
  await db.putMany("cards", cards);
  await db.put("kv", { key: "categories", value: data.categories });
  await db.put("kv", { key: "seeded", value: data.version });
  return true;
}

export async function listCategories() {
  return (await db.get("kv", "categories"))?.value ?? [];
}

export const getCard = (id) => db.get("cards", id);
// Starter decks carry `order` (builder order); own decks follow, by name.
export const listDecks = async () =>
  (await db.getAll("decks")).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name, "tr"));
export const getDeck = (id) => db.get("decks", id);
// Starter cards carry `order` (position in their topic: level, then alphabet); own cards follow by creation time.
const byOrder = (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
export const listCards = async (deckId) => (await (deckId ? db.getByIndex("cards", "deckId", deckId) : db.getAll("cards"))).sort(byOrder);

export async function listStates() {
  return new Map((await db.getAll("cardState")).map((s) => [s.cardId, s]));
}
export async function getCardState(cardId) {
  return (await db.get("cardState", cardId)) ?? newCardState(cardId);
}
export const saveCardState = (state) => db.put("cardState", state);
export async function setStarred(cardId, starred) {
  const next = { ...(await getCardState(cardId)), starred };
  await db.put("cardState", next);
  return next;
}

export async function setNote(cardId, note) {
  const next = { ...(await getCardState(cardId)), note };
  await db.put("cardState", next);
  return next;
}

export const getInk = (cardId) => db.get("ink", cardId);
/** An empty stroke list removes the record, so the ✍️ badge disappears. */
export async function saveInk(cardId, strokes) {
  if (!strokes.length) return db.del("ink", cardId);
  return db.put("ink", { cardId, strokes, updatedAt: new Date().toISOString() });
}
export async function listInkIds() {
  return new Set(await db.getAllKeys("ink"));
}

const SETTINGS_KEY = "settings";
export const DEFAULT_SETTINGS = Object.freeze({
  ttsRate: 1, voiceDe: null, voiceEn: null, penOnly: true,
  newPerDay: 10, maxReviews: 100, direction: "de-en", strictArticle: true, soundEffects: false,
  theme: "system", lastBackupAt: null, backupReminder: true, backupSnoozedAt: null, firstRunAt: null, installHintDismissed: false,
});

function readSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch { return {}; }
}
export const getSetting = (key) => readSettings()[key] ?? DEFAULT_SETTINGS[key];
/** Returns false when storage is unavailable so the caller can tell the user. */
export function setSetting(key, value) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...readSettings(), [key]: value }));
    return true;
  } catch { return false; }
}

export async function getProgress() {
  const rec = await db.get("kv", "progress");
  return { ...DEFAULT_PROGRESS, ...(rec?.value ?? {}) };
}
export const saveProgress = (value) => db.put("kv", { key: "progress", value });
