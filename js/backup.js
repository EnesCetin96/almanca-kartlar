// Backup, restore, wipe and card mutations (anything that rewrites whole stores).
import * as db from "./db.js";
import { validateBackup } from "./importers.js";
import { DEFAULT_SETTINGS } from "./store.js";
import { clearAiKey } from "./ai.js";

const SETTINGS_KEY = "settings";
const STORES = ["decks", "cards", "cardState", "ink", "kv"];

const readSettings = () => {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch { return {}; }
};

export async function exportBackup() {
  const [decks, cards, cardState, ink, kv] = await Promise.all(STORES.map((s) => db.getAll(s)));
  return { app: "almanca-kartlar", version: 1, exportedAt: new Date().toISOString(), decks, cards, cardState, ink, kv, settings: readSettings() };
}

/** Validates, then replaces all data. Returns { cards, skipped } for the report. */
export async function restoreBackup(raw) {
  const { data, settings, skipped } = validateBackup(raw);
  await db.replaceStores(data);
  const known = Object.fromEntries(Object.entries(settings).filter(([k]) => k in DEFAULT_SETTINGS));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(known));
  return { cards: data.cards.length, skipped };
}

export async function wipeAll() {
  await db.replaceStores(Object.fromEntries(STORES.map((s) => [s, []])));
  localStorage.removeItem(SETTINGS_KEY);
  clearAiKey();
}

export async function saveImported({ decks, cards }) {
  const now = new Date().toISOString();
  await db.putMany("decks", decks);
  await db.putMany("cards", cards.map((c) => ({ ...c, createdAt: now, updatedAt: now })));
}

/** Creates or updates one card (and its new deck, if any). Keeps fields the form does not edit. */
export async function saveCard(card, existing, newDeck) {
  const now = new Date().toISOString();
  if (newDeck) await db.put("decks", newDeck);
  await db.put("cards", { ...existing, ...card, createdAt: existing?.createdAt ?? now, updatedAt: now });
}

export async function deleteCard(id) {
  await Promise.all([db.del("cards", id), db.del("cardState", id), db.del("ink", id)]);
}
