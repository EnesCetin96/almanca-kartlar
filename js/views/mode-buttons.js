import { el } from "../ui.js";

export const MODE_LABELS = [
  ["flip", "🃏 Kart çalış"],
  ["choice", "🔘 Çoktan seçmeli"],
  ["typing", "⌨️ Yazarak cevap"],
  ["cloze", "🧩 Boşluk doldurma"],
];

/** Row of links that start a practice session on a source ("deck:<id>", "starred", "all"). */
export function modeButtons(source) {
  return el("div", { class: "row", role: "group", "aria-label": "Alıştırma modları" },
    MODE_LABELS.map(([mode, label]) => el("a", { class: "btn", href: `#/session/${mode}/${encodeURIComponent(source)}` }, label)));
}
