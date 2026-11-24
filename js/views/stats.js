import { el } from "../ui.js";
import { listCards, listStates, getProgress } from "../store.js";
import { cardStatus, DEFAULT_SRS } from "../srs.js";
import { viewProgress, dayKey } from "../progress.js";

const TOP_HARD = 10;
const WEEK = 7;

function lastDays(history, now) {
  return Array.from({ length: WEEK }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (WEEK - 1 - i));
    return { label: d.toLocaleDateString("tr-TR", { weekday: "short" }), cards: history.find((h) => h.date === dayKey(d))?.cards ?? 0 };
  });
}

export async function render(root) {
  const [cards, states, saved] = await Promise.all([listCards(), listStates(), getProgress()]);
  const now = new Date();
  const p = viewProgress(saved, now);
  const counts = { new: 0, learning: 0, mature: 0 };
  for (const c of cards) counts[cardStatus(states.get(c.id)?.srs ?? DEFAULT_SRS)] += 1;
  const week = lastDays(saved.history, now);
  const top = Math.max(1, ...week.map((d) => d.cards));
  const hardest = cards
    .map((c) => ({ c, wrong: states.get(c.id)?.stats.wrong ?? 0 }))
    .filter((x) => x.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, TOP_HARD);

  root.append(
    el("h1", {}, "İstatistik"),
    el("div", { class: "grid" },
      el("div", { class: "card" }, el("h2", {}, "🔥 Seri"), el("p", { class: "big" }, `${p.streak} gün`)),
      el("div", { class: "card" }, el("h2", {}, "Toplam XP"), el("p", { class: "big" }, String(p.xp))),
      el("div", { class: "card" }, el("h2", {}, "Bugünkü hedef"), el("p", { class: "big" }, `${p.dailyDone}/${p.dailyGoal}`))),
    el("h2", {}, "Son 7 gün (çalışılan kart)"),
    el("div", { class: "card bars", role: "img", "aria-label": week.map((d) => `${d.label}: ${d.cards}`).join(", ") },
      week.map((d) => el("div", { class: "bar-col" },
        el("span", {}, String(d.cards)),
        el("div", { class: "bar", style: `height:${Math.round((d.cards / top) * 100)}px` }),
        el("span", { class: "dim" }, d.label)))),
    el("h2", {}, "Kart durumları"),
    el("div", { class: "card" }, el("p", {}, `Yeni: ${counts.new} · Öğreniliyor: ${counts.learning} · Olgunlaşmış: ${counts.mature}`)),
    el("h2", {}, "En çok zorlandığın kartlar"),
    hardest.length
      ? el("div", { class: "card" }, hardest.map(({ c, wrong }) =>
          el("div", { class: "list-row" }, el("strong", { lang: "de" }, c.de.article ? `${c.de.article} ${c.de.word}` : c.de.word), el("span", { class: "dim" }, `${c.en.word} · ${wrong} yanlış`))))
      : el("p", { class: "empty" }, "Henüz yanlış yaptığın kart yok."));
}
