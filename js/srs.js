// Spaced repetition: a small SM-2-like scheduler. All functions are pure.
export const MIN_EASE = 1.3;
export const DEFAULT_SRS = Object.freeze({ ease: 2.5, intervalDays: 0, due: null, reps: 0, lapses: 0, lastReviewed: null });
export const RATINGS = Object.freeze(["again", "hard", "good", "easy"]);

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const LEARN_STEP_MINUTES = 10;
const FIRST_INTERVAL_DAYS = Object.freeze({ hard: 1, good: 2, easy: 4 });
const EASE_DELTA = Object.freeze({ again: -0.2, hard: -0.15, good: 0, easy: 0.15 });
const MATURE_DAYS = 21;

function nextDays(srs, rating) {
  if (srs.reps === 0) return FIRST_INTERVAL_DAYS[rating];
  const i = srs.intervalDays;
  const hard = Math.max(1, Math.round(i * 1.2));
  const good = Math.max(hard + 1, i + 1, Math.round(i * srs.ease));
  if (rating === "hard") return hard;
  if (rating === "good") return good;
  return Math.max(good + 1, Math.round(i * srs.ease * 1.3));
}

/** What a rating would do to this card, without applying it. */
export function plan(srs, rating) {
  const isReview = srs.reps > 0;
  if (rating === "again") {
    return {
      minutes: LEARN_STEP_MINUTES, intervalDays: 0, reps: 0,
      lapses: srs.lapses + (isReview ? 1 : 0),
      ease: Math.max(MIN_EASE, srs.ease + (isReview ? EASE_DELTA.again : 0)),
    };
  }
  return {
    minutes: 0, intervalDays: nextDays(srs, rating), reps: srs.reps + 1, lapses: srs.lapses,
    ease: Math.max(MIN_EASE, srs.ease + EASE_DELTA[rating]),
  };
}

export function gradeSrs(srs, rating, now = new Date()) {
  const p = plan(srs, rating);
  const wait = p.minutes ? p.minutes * MINUTE_MS : p.intervalDays * DAY_MS;
  return {
    ease: p.ease, intervalDays: p.intervalDays, reps: p.reps, lapses: p.lapses,
    due: new Date(now.getTime() + wait).toISOString(),
    lastReviewed: now.toISOString(),
  };
}

export function formatInterval(p) {
  if (p.minutes) return `${p.minutes} dk`;
  if (p.intervalDays < 30) return `${p.intervalDays} gün`;
  return `${Math.round(p.intervalDays / 30)} ay`;
}

export const previewLabels = (srs) => Object.fromEntries(RATINGS.map((r) => [r, formatInterval(plan(srs, r))]));

export const isNew = (srs) => srs.reps === 0 && srs.due === null;

/** Due if scheduled before the start of tomorrow (local time). */
export function isDue(srs, now = new Date()) {
  if (srs.due === null) return false;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return new Date(srs.due) < tomorrow;
}

export function cardStatus(srs) {
  if (isNew(srs)) return "new";
  return srs.reps > 0 && srs.intervalDays >= MATURE_DAYS ? "mature" : "learning";
}

/** Returns a new cardState with the rating applied to its schedule and stats. */
export function applyAnswer(state, rating, now = new Date()) {
  const wrong = rating === "again";
  return {
    ...state,
    srs: gradeSrs(state.srs, rating, now),
    stats: {
      seen: state.stats.seen + 1,
      correct: state.stats.correct + (wrong ? 0 : 1),
      wrong: state.stats.wrong + (wrong ? 1 : 0),
    },
  };
}
