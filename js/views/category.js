// Category level of the library: categories -> topics (decks) -> words. Route: #/category/<id>
import { el } from "../ui.js";
import { listCategories, listDecks, listCards, listStates } from "../store.js";

const OWN = { id: "own", name: "Kendi kartlarım", icon: "✏️", description: "Kendi eklediğin kartlar" };
const link = (href, ...kids) => el("a", { class: "card tile", href }, ...kids);

async function load() {
  const [cats, decks, cards, states] = await Promise.all([listCategories(), listDecks(), listCards(), listStates()]);
  const known = new Set(cats.map((c) => c.id));
  const categoryOf = (d) => (known.has(d.category) ? d.category : OWN.id);
  const withOwn = decks.some((d) => categoryOf(d) === OWN.id) ? [...cats, OWN] : cats;
  const stats = (deckList) => {
    const ids = new Set(deckList.map((d) => d.id));
    const mine = cards.filter((c) => ids.has(c.deckId));
    const learned = mine.filter((c) => (states.get(c.id)?.srs.reps ?? 0) > 0).length;
    return { cards: mine.length, pct: mine.length ? Math.round((learned / mine.length) * 100) : 0 };
  };
  return { cats: withOwn, decks, categoryOf, stats };
}

/** One tile per category; used on the home screen and the Desteler screen. */
export async function categoryTiles() {
  const { cats, decks, categoryOf, stats } = await load();
  return el("div", { class: "grid" }, cats.map((c) => {
    const topics = decks.filter((d) => categoryOf(d) === c.id);
    const s = stats(topics);
    return link(`#/category/${encodeURIComponent(c.id)}`,
      el("div", { class: "tile-icon", "aria-hidden": "true" }, c.icon),
      el("h2", { style: "margin:.25rem 0" }, c.name),
      el("p", { class: "dim" }, c.description),
      el("p", {}, `${topics.length} konu · ${s.cards} kart`),
      el("progress", { max: 100, value: s.pct, "aria-label": "Öğrenilen yüzdesi" }));
  }));
}

export async function render(root, { id }) {
  const { cats, decks, categoryOf, stats } = await load();
  const cat = cats.find((c) => c.id === id);
  root.append(el("a", { href: "#/decks" }, "← Kategoriler"));
  if (!cat) {
    root.append(el("p", { class: "empty" }, "Kategori bulunamadı."));
    return;
  }
  const topics = decks.filter((d) => categoryOf(d) === cat.id);
  root.append(
    el("h1", {}, `${cat.icon} ${cat.name}`),
    el("p", { class: "dim" }, `${cat.description} · ${topics.length} konu`),
    el("p", {}, el("a", { class: "btn", href: "#/card/new" }, "＋ Yeni kart")),
    topics.length ? null : el("p", { class: "empty" }, "Bu kategoride henüz konu yok."),
    el("div", { class: "grid" }, topics.map((d) => {
      const s = stats([d]);
      return link(`#/deck/${encodeURIComponent(d.id)}`,
        el("h2", { style: `margin:0 0 .25rem;border-left:6px solid ${d.color};padding-left:.5rem` }, d.name),
        el("p", { class: "dim" }, d.description),
        el("p", {}, `${s.cards} kart · %${s.pct} öğrenildi`),
        el("progress", { max: 100, value: s.pct, "aria-label": "Öğrenilen yüzdesi" }));
    })));
}
