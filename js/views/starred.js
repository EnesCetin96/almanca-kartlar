import { el, toast } from "../ui.js";
import { modeButtons } from "./mode-buttons.js";
import { listCards, listDecks, listStates, setStarred, listInkIds } from "../store.js";

export async function render(root) {
  const [cards, decks, states, inkIds] = await Promise.all([listCards(), listDecks(), listStates(), listInkIds()]);
  let starred = cards.filter((c) => states.get(c.id)?.starred);
  const selected = new Set();

  const search = el("input", { type: "search", placeholder: "Ara…", "aria-label": "Kelime ara" });
  const deckSel = el("select", { "aria-label": "Deste" }, el("option", { value: "" }, "Tüm desteler"), decks.map((d) => el("option", { value: d.id }, d.name)));
  const langSel = el("select", { "aria-label": "Arama dili" },
    el("option", { value: "all" }, "Tüm diller"), el("option", { value: "de" }, "Almanca"), el("option", { value: "en" }, "İngilizce"));
  const list = el("div");
  const studyBtn = el("a", { class: "btn btn-primary", href: "#/session/flip/starred" }, "Tekrar listesini çalış");
  const browseBtn = el("a", { class: "btn", href: "#/study/starred" }, "📖 Kartlara göz at");
  const removeBtn = el("button", { type: "button", disabled: true }, "Seçilenleri listeden çıkar");

  function visible() {
    const q = search.value.trim().toLowerCase();
    return starred.filter((c) => {
      if (deckSel.value && c.deckId !== deckSel.value) return false;
      if (!q) return true;
      const hay = langSel.value === "de" ? c.de.word : langSel.value === "en" ? c.en.word : `${c.de.word} ${c.en.word} ${c.tr}`;
      return hay.toLowerCase().includes(q);
    });
  }

  const heading = el("h1", {});

  function draw() {
    const rows = visible();
    heading.textContent = `Tekrar listem (⭐ ${starred.length})`;
    removeBtn.disabled = selected.size === 0;
    studyBtn.setAttribute("aria-disabled", String(starred.length === 0));
    if (!rows.length) {
      list.replaceChildren(el("p", { class: "empty" }, starred.length ? "Eşleşen kelime yok." : "Henüz işaretli kelimen yok. Kartta ⭐'a dokun."));
      return;
    }
    list.replaceChildren(...rows.map((c) => {
      const box = el("input", { type: "checkbox", "aria-label": `${c.de.word} seç` });
      box.checked = selected.has(c.id);
      box.addEventListener("change", () => {
        if (box.checked) selected.add(c.id); else selected.delete(c.id);
        removeBtn.disabled = selected.size === 0;
      });
      return el("div", { class: "list-row" },
        el("label", {}, box, el("span", {}, el("strong", { lang: "de" }, c.de.article ? `${c.de.article} ${c.de.word}` : c.de.word), " · ", c.en.word, inkIds.has(c.id) || states.get(c.id)?.note ? el("span", { "aria-label": "notu var" }, " ✍️") : null)),
        el("span", { class: "dim" }, c.tr));
    }));
  }

  removeBtn.addEventListener("click", async () => {
    try {
      await Promise.all([...selected].map((id) => setStarred(id, false)));
    } catch {
      toast("Kelimeler listeden çıkarılamadı.");
      return;
    }
    starred = starred.filter((c) => !selected.has(c.id));
    selected.clear();
    draw();
  });
  [search, deckSel, langSel].forEach((n) => n.addEventListener("input", draw));

  root.append(
    heading,
    el("div", { class: "row" }, studyBtn, browseBtn),
    modeButtons("starred"),
    el("div", { class: "filters" }, search, deckSel, langSel, removeBtn),
    list);
  draw();
}
