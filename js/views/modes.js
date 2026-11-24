// The four exercise modes. Each render() builds the question UI and calls
// onAnswer({ rating, correct, feedback? }) once; feedback shows the green/red panel.
import { el } from "../ui.js";
import { previewLabels } from "../srs.js";
import { buildChoices, checkTyped, makeCloze } from "../practice.js";
import { speak } from "../tts.js";
import { renderCardFace } from "./card-face.js";

const ART = { der: "art-der", die: "art-die", das: "art-das" };
const SPECIALS = ["ä", "ö", "ü", "ß"];
const GRADE_LABELS = { again: "Tekrar", hard: "Zor", good: "İyi", easy: "Kolay" };

const deWithArticle = (c) => (c.de.article ? `${c.de.article} ${c.de.word}` : c.de.word);

function deWord(card) {
  return el("span", {}, card.de.article ? el("span", { class: `art ${ART[card.de.article] ?? ""}` }, `${card.de.article} `) : null, card.de.word);
}

/** Big prompt word; --chars lets CSS fit long words to the card width (see .q-word). */
const qWord = (content, text, lang) => el("div", { class: "q-word", lang, style: `--chars:${text.length}` }, content);

const frontLang =(direction) => (direction === "mixed" ? (Math.random() < 0.5 ? "de" : "en") : direction.slice(0, 2));

const verdict = (correct, title, detail) => ({
  rating: correct ? "good" : "again", correct,
  feedback: { kind: correct ? "ok" : "bad", title, detail },
});

/** Text input with ä ö ü ß buttons and a check button. */
function answerBox({ specials, onSubmit }) {
  const input = el("input", {
    type: "text", class: "answer-input", autocapitalize: "off", autocorrect: "off", spellcheck: "false",
    enterkeyhint: "done", "aria-label": "Cevabın", autocomplete: "off",
  });
  const check = el("button", { type: "button", class: "btn-primary" }, "Kontrol et");
  const submit = () => {
    if (!input.value.trim() || input.disabled) return;
    input.disabled = true;
    check.disabled = true;
    onSubmit(input.value);
  };
  check.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  const insert = (ch) => {
    const at = input.selectionStart ?? input.value.length;
    input.setRangeText(ch, at, input.selectionEnd ?? at, "end");
    input.focus();
  };
  const special = specials ? el("div", { class: "row" }, SPECIALS.map((ch) => el("button", { type: "button", "aria-label": `${ch} ekle`, onclick: () => insert(ch) }, ch))) : null;
  return el("div", { class: "answer-box" }, input, special, check);
}

function flip({ card, state, settings, onAnswer }) {
  const lang = frontLang(settings.direction);
  const front = lang === "de" ? deWord(card) : card.en.word;
  const root = el("div", { class: "q-card card" });
  const reveal = el("button", { type: "button", class: "btn-primary" }, "Göster");
  const speakBtn = el("button", { type: "button", "aria-label": "Seslendir",
    onclick: () => speak(lang === "de" ? deWithArticle(card) : card.en.word, lang) }, "🔊");
  root.append(
    el("div", { class: "lang-label" }, lang === "de" ? "Deutsch" : "English"),
    qWord(front, lang === "de" ? deWithArticle(card) : card.en.word, lang),
    el("div", { class: "row" }, speakBtn, reveal));
  reveal.addEventListener("click", () => {
    const labels = previewLabels(state.srs);
    root.replaceChildren(
      renderCardFace(card),
      el("div", { class: "grade-row", role: "group", "aria-label": "Kendini notla" },
        Object.keys(GRADE_LABELS).map((r) => el("button", { type: "button", class: `grade grade-${r}`, onclick: () => onAnswer({ rating: r, correct: r !== "again" }) },
          el("strong", {}, GRADE_LABELS[r]), el("small", {}, labels[r])))));
  });
  return root;
}

function choice({ card, pool, onAnswer }) {
  const promptIsTr = Math.random() < 0.5;
  const options = buildChoices(card, pool);
  const buttons = options.map((opt) => {
    const b = el("button", { type: "button", class: "choice", lang: "de" }, deWord(opt));
    b.addEventListener("click", () => {
      const ok = opt.id === card.id;
      buttons.forEach((x) => { x.disabled = true; });
      b.classList.add(ok ? "right" : "wrong");
      if (!ok) buttons[options.findIndex((o) => o.id === card.id)].classList.add("right");
      onAnswer(verdict(ok, ok ? "Doğru!" : "Yanlış", ok ? "" : `Doğru cevap: ${deWithArticle(card)}`));
    });
    return b;
  });
  return el("div", { class: "q-card card" },
    el("div", { class: "lang-label" }, promptIsTr ? "Türkçe" : "English"),
    qWord(promptIsTr ? card.tr : card.en.word, promptIsTr ? card.tr : card.en.word, promptIsTr ? "tr" : "en"),
    el("p", { class: "dim" }, "Almanca karşılığını seç"),
    el("div", { class: "choices" }, buttons));
}

function typing({ card, settings, onAnswer }) {
  const from = frontLang(settings.direction);
  const to = from === "de" ? "en" : "de";
  const expected = to === "de" ? { article: card.de.article, word: card.de.word } : { word: card.en.word };
  const answerText = to === "de" ? deWithArticle(card) : card.en.word;
  const box = answerBox({
    specials: to === "de",
    onSubmit: (value) => {
      const res = checkTyped(value, expected, { strictArticle: settings.strictArticle });
      if (res === "correct") onAnswer(verdict(true, "Doğru!", ""));
      else if (res === "almost") onAnswer(verdict(true, "Neredeyse doğru", `Doğrusu: ${answerText}`));
      else if (res === "article") onAnswer(verdict(false, "Artikel'e dikkat", `Doğrusu: ${answerText}`));
      else onAnswer(verdict(false, "Yanlış", `Doğru cevap: ${answerText}`));
    },
  });
  return el("div", { class: "q-card card" },
    el("div", { class: "lang-label" }, from === "de" ? "Deutsch" : "English"),
    qWord(from === "de" ? deWord(card) : card.en.word, from === "de" ? deWithArticle(card) : card.en.word, from),
    el("p", { class: "dim" }, `Türkçe: ${card.tr}`),
    el("p", {}, to === "de" ? "Almancasını yaz (artikel ile)" : "İngilizcesini yaz"),
    box);
}

const clozeSentence = (card) => card.sentences.find((s) => makeCloze(s.de, card.de.word));

function cloze({ card, onAnswer }) {
  const sentence = clozeSentence(card);
  const parts = makeCloze(sentence.de, card.de.word);
  const box = answerBox({
    specials: true,
    onSubmit: (value) => {
      const res = checkTyped(value, { word: parts.answer });
      if (res === "correct") onAnswer(verdict(true, "Doğru!", ""));
      else if (res === "almost") onAnswer(verdict(true, "Neredeyse doğru", `Doğrusu: ${parts.answer}`));
      else onAnswer(verdict(false, "Yanlış", `Doğru cevap: ${parts.answer}`));
    },
  });
  return el("div", { class: "q-card card" },
    el("div", { class: "lang-label" }, "Boşluğu doldur"),
    el("p", { class: "q-sentence" }, parts.before, el("span", { class: "blank" }, "_____"), parts.after),
    el("p", { class: "dim" }, sentence.tr),
    box);
}

export const MODES = {
  flip: { render: flip },
  choice: { render: choice },
  typing: { render: typing },
  cloze: { render: cloze, filter: (card) => Boolean(clozeSentence(card)) },
};
