import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTyped, makeCloze, buildChoices, shuffle } from "../js/practice.js";
import { viewProgress, recordStudy, dayKey, backupReminderDue } from "../js/progress.js";
import { pickCards, dueList, newList } from "../js/sources.js";
import { DEFAULT_SRS } from "../js/srs.js";

const server = { article: "der", word: "Server" };
const umlaut = { article: "die", word: "Störung" };

test("checkTyped: case-insensitive, ae/oe/ue/ss are 'almost', article rules", () => {
  assert.equal(checkTyped("der server", server), "correct");
  assert.equal(checkTyped("Server", server), "article");
  assert.equal(checkTyped("Server", server, { strictArticle: false }), "correct");
  assert.equal(checkTyped("die Server", server), "article");
  assert.equal(checkTyped("die Stoerung", umlaut), "almost");
  assert.equal(checkTyped("die Störung", umlaut), "correct");
  assert.equal(checkTyped("die Strasse", { article: "die", word: "Straße" }), "almost");
  assert.equal(checkTyped("das Haus", server), "wrong");
  assert.equal(checkTyped("   ", server), "wrong");
  assert.equal(checkTyped("Fix", { word: "fix" }), "correct");
});

test("makeCloze splits around the headword or returns null", () => {
  assert.deepEqual(makeCloze("Der Server ist weg.", "Server"), { before: "Der ", answer: "Server", after: " ist weg." });
  assert.equal(makeCloze("Wir testen heute.", "Server"), null);
});

const card = (id, deckId, pos = "noun") => ({ id, deckId, de: { pos } });

test("buildChoices includes the card, no duplicates, prefers same deck and pos", () => {
  const pool = [card("a", "d1"), card("b", "d1"), card("c", "d1"), card("d", "d1"), card("e", "d2", "verb"), card("f", "d2")];
  const out = buildChoices(pool[0], pool, 4, () => 0.3);
  assert.equal(out.length, 4);
  assert.ok(out.some((c) => c.id === "a"));
  assert.equal(new Set(out.map((c) => c.id)).size, 4);
  assert.ok(out.every((c) => c.deckId === "d1"));
});

test("buildChoices copes with tiny pools; shuffle keeps the input untouched", () => {
  assert.equal(buildChoices(card("a", "d"), [card("a", "d")], 4).length, 1);
  const src = [1, 2, 3, 4];
  assert.deepEqual([...shuffle(src)].sort(), [1, 2, 3, 4]);
  assert.deepEqual(src, [1, 2, 3, 4]);
});

const emptyProgress = { xp: 0, streak: 0, lastStudyDate: null, dailyGoal: 10, dailyDone: 0, history: [] };

test("recordStudy: first study starts a streak, same day keeps it, next day extends it, gap resets it", () => {
  const d1 = new Date(2026, 5, 10, 9);
  const a = recordStudy(emptyProgress, { xp: 10, cards: 1, newCards: 1 }, d1);
  assert.equal(a.streak, 1);
  const b = recordStudy(a, { xp: 5, cards: 1 }, new Date(2026, 5, 10, 21));
  assert.equal(b.streak, 1);
  assert.deepEqual(b.history, [{ date: "2026-06-10", cards: 2, xp: 15, newCards: 1 }]);
  const c = recordStudy(b, { xp: 10, cards: 1 }, new Date(2026, 5, 11, 8));
  assert.equal(c.streak, 2);
  assert.equal(viewProgress(c, new Date(2026, 5, 11, 20)).dailyDone, 1);
  assert.equal(viewProgress(c, new Date(2026, 5, 13)).streak, 0);
  const d = recordStudy(c, { xp: 10, cards: 1 }, new Date(2026, 5, 14));
  assert.equal(d.streak, 1);
  assert.equal(emptyProgress.history.length, 0);
});

test("backupReminderDue: 14-day window, snooze and opt-out", () => {
  const now = new Date(2026, 5, 30);
  const day = (d) => new Date(2026, 5, d).toISOString();
  const base = { enabled: true, lastBackupAt: null, snoozedAt: null, firstRunAt: day(1) };
  assert.equal(backupReminderDue(base, now), true);
  assert.equal(backupReminderDue({ ...base, lastBackupAt: day(25) }, now), false);
  assert.equal(backupReminderDue({ ...base, snoozedAt: day(20) }, now), false);
  assert.equal(backupReminderDue({ ...base, enabled: false }, now), false);
  assert.equal(backupReminderDue({ ...base, firstRunAt: null }, now), false);
});

test("dayKey uses local calendar day", () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

const NOW = new Date(2026, 5, 10, 12);
const mk = (id, over = {}) => ({ id, deckId: "d1", ...over });
const st = (srs, extra = {}) => ({ cardId: "x", starred: false, srs: { ...DEFAULT_SRS, ...srs }, stats: { seen: 0, correct: 0, wrong: 0 }, ...extra });

test("sources: due is sorted and capped, new respects the limit, new = no state", () => {
  const cards = [mk("a"), mk("b"), mk("c"), mk("d")];
  const states = new Map([
    ["a", st({ reps: 1, intervalDays: 1, due: new Date(2026, 5, 10, 9).toISOString() })],
    ["b", st({ reps: 1, intervalDays: 1, due: new Date(2026, 5, 9, 9).toISOString() })],
    ["c", st({ reps: 1, intervalDays: 1, due: new Date(2026, 5, 20).toISOString() })],
  ]);
  assert.deepEqual(dueList(cards, states, NOW, 100).map((c) => c.id), ["b", "a"]);
  assert.deepEqual(dueList(cards, states, NOW, 1).map((c) => c.id), ["b"]);
  assert.deepEqual(newList(cards, states, 5).map((c) => c.id), ["d"]);
  assert.deepEqual(newList(cards, states, 0), []);
});

test("sources: starred and deck pools", () => {
  const cards = [mk("a"), mk("b", { deckId: "d2" }), mk("c")];
  const states = new Map([["b", st({}, { starred: true })]]);
  const base = { cards, states, now: NOW, newLeft: 10, maxReviews: 100, size: 10, rng: () => 0.5 };
  assert.deepEqual(pickCards({ ...base, source: "starred" }).map((c) => c.id), ["b"]);
  assert.deepEqual(pickCards({ ...base, source: "deck:d1" }).map((c) => c.id).sort(), ["a", "c"]);
  assert.equal(pickCards({ ...base, source: "all", size: 2 }).length, 2);
});
