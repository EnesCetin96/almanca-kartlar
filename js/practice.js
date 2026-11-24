// Pure helpers for the exercise modes: answer checking, cloze, choices, shuffling.
const ARTICLES = ["der", "die", "das"];

export const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
const fold = (s) => s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");

/**
 * "correct" | "almost" (ae/oe/ue/ss spelling) | "article" (word right, article missing/wrong) | "wrong".
 * Case is ignored. The article is only required when expected.article is set and strictArticle is on.
 */
export function checkTyped(input, { article = null, word }, { strictArticle = true } = {}) {
  const tokens = norm(input).split(" ").filter(Boolean);
  const given = tokens.length > 1 && ARTICLES.includes(tokens[0]) ? tokens.shift() : null;
  const typed = tokens.join(" ");
  const expected = norm(word);
  if (!typed || fold(typed) !== fold(expected)) return "wrong";
  if (article && strictArticle && given !== article) return "article";
  return typed === expected ? "correct" : "almost";
}

/** Splits a sentence around the headword; null when the word does not occur verbatim. */
export function makeCloze(sentence, word) {
  const i = word ? sentence.toLowerCase().indexOf(word.toLowerCase()) : -1;
  if (i < 0) return null;
  return { before: sentence.slice(0, i), answer: sentence.slice(i, i + word.length), after: sentence.slice(i + word.length) };
}

export function shuffle(items, rng = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The card plus up to count-1 distractors (same deck and part of speech first), shuffled. */
export function buildChoices(card, pool, count = 4, rng = Math.random) {
  const others = pool.filter((c) => c.id !== card.id);
  const similar = others.filter((c) => c.deckId === card.deckId && c.de.pos === card.de.pos);
  const rest = others.filter((c) => !similar.includes(c));
  const picks = [...shuffle(similar, rng), ...shuffle(rest, rng)].slice(0, count - 1);
  return shuffle([card, ...picks], rng);
}
