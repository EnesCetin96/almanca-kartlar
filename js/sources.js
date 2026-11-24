// Chooses which cards go into a session. Pure: states is a Map<cardId, cardState>.
import { isDue, isNew } from "./srs.js";
import { shuffle } from "./practice.js";

const srsOf = (states, id) => states.get(id)?.srs;

export function dueList(cards, states, now, max) {
  return cards
    .filter((c) => { const s = srsOf(states, c.id); return s && !isNew(s) && isDue(s, now); })
    .sort((a, b) => new Date(srsOf(states, a.id).due) - new Date(srsOf(states, b.id).due))
    .slice(0, max);
}

export function newList(cards, states, limit) {
  return cards.filter((c) => { const s = srsOf(states, c.id); return !s || isNew(s); }).slice(0, limit);
}

/** source: "due" | "new" | "starred" | "deck:<id>" | "all". */
export function pickCards({ source, cards, states, now, newLeft, maxReviews, size, rng = Math.random }) {
  if (source === "due") return dueList(cards, states, now, maxReviews);
  if (source === "new") return newList(cards, states, newLeft);
  let pool = cards;
  if (source === "starred") pool = cards.filter((c) => states.get(c.id)?.starred);
  else if (source.startsWith("deck:")) pool = cards.filter((c) => c.deckId === source.slice(5));
  const mixed = shuffle(pool, rng);
  return source === "starred" ? mixed : mixed.slice(0, size);
}
