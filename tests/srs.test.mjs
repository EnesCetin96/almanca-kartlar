import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SRS, gradeSrs, plan, previewLabels, isNew, isDue, cardStatus, applyAnswer, MIN_EASE } from "../js/srs.js";

const NOW = new Date(2026, 5, 10, 12, 0, 0);
const DAY = 86_400_000;
const review = (over) => ({ ...DEFAULT_SRS, reps: 2, intervalDays: 6, due: NOW.toISOString(), lastReviewed: NOW.toISOString(), ...over });

test("new card: again waits 10 minutes, hard/good/easy give 1/2/4 days", () => {
  assert.equal(new Date(gradeSrs(DEFAULT_SRS, "again", NOW).due) - NOW, 10 * 60_000);
  assert.deepEqual(["hard", "good", "easy"].map((r) => gradeSrs(DEFAULT_SRS, r, NOW).intervalDays), [1, 2, 4]);
  assert.equal(gradeSrs(DEFAULT_SRS, "good", NOW).reps, 1);
});

test("review card: hard < good < easy and due moves by the interval", () => {
  const s = review({});
  const [h, g, e] = ["hard", "good", "easy"].map((r) => gradeSrs(s, r, NOW));
  assert.ok(h.intervalDays < g.intervalDays && g.intervalDays < e.intervalDays);
  assert.equal(new Date(g.due) - NOW, g.intervalDays * DAY);
});

test("even a 1-day card keeps good < easy", () => {
  const s = review({ reps: 1, intervalDays: 1 });
  assert.ok(plan(s, "good").intervalDays < plan(s, "easy").intervalDays);
});

test("again on a review card is a lapse: reps reset, lapses+1, ease drops but never below the floor", () => {
  const lapsed = gradeSrs(review({}), "again", NOW);
  assert.equal(lapsed.reps, 0);
  assert.equal(lapsed.lapses, 1);
  assert.ok(lapsed.ease < DEFAULT_SRS.ease);
  assert.equal(plan(review({ ease: MIN_EASE }), "again").ease, MIN_EASE);
  assert.equal(gradeSrs(DEFAULT_SRS, "again", NOW).lapses, 0);
});

test("button labels preview the next interval", () => {
  assert.deepEqual(previewLabels(DEFAULT_SRS), { again: "10 dk", hard: "1 gün", good: "2 gün", easy: "4 gün" });
});

test("isNew / isDue / cardStatus", () => {
  assert.equal(isNew(DEFAULT_SRS), true);
  assert.equal(isDue(DEFAULT_SRS, NOW), false);
  const laterToday = review({ due: new Date(2026, 5, 10, 23, 0).toISOString() });
  const tomorrow = review({ due: new Date(2026, 5, 11, 8, 0).toISOString() });
  assert.equal(isDue(laterToday, NOW), true);
  assert.equal(isDue(tomorrow, NOW), false);
  assert.equal(cardStatus(DEFAULT_SRS), "new");
  assert.equal(cardStatus(review({})), "learning");
  assert.equal(cardStatus(review({ intervalDays: 30 })), "mature");
});

test("applyAnswer returns a new state and counts stats without mutating the input", () => {
  const state = { cardId: "x", starred: false, srs: DEFAULT_SRS, stats: { seen: 0, correct: 0, wrong: 0 } };
  const good = applyAnswer(state, "good", NOW);
  const bad = applyAnswer(state, "again", NOW);
  assert.deepEqual(good.stats, { seen: 1, correct: 1, wrong: 0 });
  assert.deepEqual(bad.stats, { seen: 1, correct: 0, wrong: 1 });
  assert.equal(state.stats.seen, 0);
  assert.equal(state.srs, DEFAULT_SRS);
});
