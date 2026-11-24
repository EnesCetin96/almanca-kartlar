// Pure card content: DE + EN words, own-language sentences, tap-to-reveal Turkish.
// Layout: the card is a size container. Narrow cards stack DE above EN, wide cards (≥640px)
// show them side by side. Headwords size themselves to their column (see .word-main in card.css).
import { el } from "../ui.js";

const ART = { der: "art-der", die: "art-die", das: "art-das" };
const LANG_NAME = { de: "Deutsch", en: "English" };
const TR_HINT = "Türkçesi";

function glossWord(word, gloss) {
  let bubble = null;
  const btn = el("button", { class: "gloss", type: "button", "aria-expanded": "false" }, word);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (bubble) {
      bubble.remove();
      bubble = null;
    } else {
      bubble = el("small", { class: "bubble", role: "note" }, gloss);
      btn.after(bubble);
    }
    btn.setAttribute("aria-expanded", String(Boolean(bubble)));
  });
  return btn;
}

function glossify(text, glosses) {
  const lookup = new Map(Object.entries(glosses ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return text.split(/(\p{L}+)/u).map((part) => (lookup.has(part.toLowerCase()) ? glossWord(part, lookup.get(part.toLowerCase())) : part));
}

/** Sentence nodes with the headword highlighted and glossed words tappable. */
function sentenceNodes(text, word, glosses) {
  const i = word ? text.toLowerCase().indexOf(word.toLowerCase()) : -1;
  if (i < 0) return glossify(text, glosses);
  return [
    ...glossify(text.slice(0, i), glosses),
    el("mark", {}, text.slice(i, i + word.length)),
    ...glossify(text.slice(i + word.length), glosses),
  ];
}

function sentence(text, tr, word, glosses) {
  const trLine = el("p", { class: "sentence-tr", lang: "tr", hidden: true }, tr);
  const btn = el("button", { type: "button", class: "sentence-toggle", "aria-expanded": "false", "aria-label": "Cümlenin Türkçesini aç/kapat" }, "TR");
  const toggle = () => {
    trLine.hidden = !trLine.hidden;
    btn.setAttribute("aria-expanded", String(!trLine.hidden));
  };
  btn.addEventListener("click", toggle);
  const p = el("p", { class: "sentence", onclick: toggle }, sentenceNodes(text, word, glosses));
  return el("div", { class: "sentence-box" }, el("div", { class: "sentence-row" }, p, btn), trLine);
}

function wordBlock({ lang, article, word, plural, tr, note, sentences, glosses, chars }) {
  const label = LANG_NAME[lang];
  const full = article ? `${article} ${word}` : word;
  const chip = el("button", { type: "button", class: "tr-chip", lang: "tr", "aria-expanded": "false", "aria-label": "Türkçe anlamı aç/kapat" }, TR_HINT);
  const toggle = () => {
    const open = chip.getAttribute("aria-expanded") !== "true";
    chip.setAttribute("aria-expanded", String(open));
    chip.textContent = open ? tr : TR_HINT;
  };
  chip.addEventListener("click", toggle);
  // --chars lets CSS shrink long words so they fit their column instead of spilling over.
  // Both headwords get the same value, so DE and EN stay the same size side by side.
  const head = el("button", {
    class: "word-main", type: "button", style: `--chars:${chars}`,
    "aria-label": `${label}: ${full}. Türkçe anlamı aç/kapat`, onclick: toggle,
  }, article ? el("span", { class: `art ${ART[article] ?? ""}` }, article) : null, article ? " " : null, word);
  return el("section", { class: "lang-block", lang, "aria-label": label },
    el("div", { class: "lang-label" }, el("span", { class: "lang-code" }, lang.toUpperCase()), label),
    head,
    plural ? el("div", { class: "word-meta" }, `Çoğul: ${plural}`) : null,
    chip,
    note ? el("p", { class: "note", lang: "tr" }, note) : null,
    sentences.map((s) => sentence(s.text, s.tr, word, glosses)));
}

export function renderCardFace(card) {
  const { de, en, tr, sentences, glosses } = card;
  const chars = Math.max((de.article ? de.article.length + 1 : 0) + de.word.length, en.word.length);
  return el("article", { class: "card flashcard" },
    el("div", { class: "face-grid" },
      wordBlock({ lang: "de", article: de.article, word: de.word, plural: de.plural, tr, note: de.note,
        sentences: sentences.map((s) => ({ text: s.de, tr: s.tr })), glosses, chars }),
      wordBlock({ lang: "en", article: null, word: en.word, plural: null, tr, note: null,
        sentences: sentences.map((s) => ({ text: s.en, tr: s.tr })), glosses: {}, chars })));
}
