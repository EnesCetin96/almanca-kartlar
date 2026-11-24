// A topic (deck): its words as a grid. Tapping a word opens the study view at that word,
// where "İleri" moves on to the next word of the topic.
import { el } from "../ui.js";
import { getDeck, listCards, listStates, listInkIds, listCategories } from "../store.js";
import { modeButtons } from "./mode-buttons.js";

const ARTICLE_CLASS = { der: "art-der", die: "art-die", das: "art-das" };

export async function render(root, { id }) {
  const deck = await getDeck(id);
  if (!deck) {
    root.append(el("p", { class: "empty" }, "Konu bulunamadı."));
    return;
  }
  const [cards, states, inkIds, cats] = await Promise.all([listCards(id), listStates(), listInkIds(), listCategories()]);
  const cat = cats.find((c) => c.id === deck.category);
  const back = cat ? [`#/category/${encodeURIComponent(cat.id)}`, `← ${cat.icon} ${cat.name}`] : ["#/decks", "← Kategoriler"];
  root.append(
    el("a", { href: back[0] }, back[1]),
    el("h1", {}, deck.name),
    el("p", { class: "dim" }, `${cards.length} kart`),
    modeButtons(`deck:${id}`),
    el("p", { class: "row" },
      cards.length ? el("a", { class: "btn btn-primary", href: `#/study/${encodeURIComponent(id)}/0` }, "📖 Baştan başla") : null,
      el("a", { class: "btn", href: `#/card/new/${encodeURIComponent(id)}` }, "＋ Kart ekle")),
    cards.length ? null : el("p", { class: "empty" }, "Bu konuda henüz kart yok. Yukarıdan ＋ Kart ekle'ye dokun."),
    el("div", { class: "grid" }, cards.map((c, i) =>
      el("a", { class: "card", href: `#/study/${encodeURIComponent(id)}/${i}`, style: "text-decoration:none;color:inherit" },
        el("strong", { lang: "de" }, c.de.article ? el("span", { class: ARTICLE_CLASS[c.de.article] }, `${c.de.article} `) : null, c.de.word,
          states.get(c.id)?.starred ? el("span", { class: "star-badge", "aria-label": "işaretli" }, " ⭐") : null,
          inkIds.has(c.id) || states.get(c.id)?.note ? el("span", { "aria-label": "notu var" }, " ✍️") : null),
        el("div", {}, c.en.word),
        el("div", { class: "dim" }, `${c.tr}${c.level ? ` · ${c.level}` : ""}`)))));
}
