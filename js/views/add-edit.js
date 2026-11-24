// Add / edit / delete a card. Routes: #/card/new[/<deckId>]  and  #/card/edit/<cardId>
import { el, toast } from "../ui.js";
import { listDecks, listCards, getCard } from "../store.js";
import { saveCard, deleteCard } from "../backup.js";
import { validateCard } from "../importers.js";

const NEW_DECK = "__new__";
const SENTENCE_SLOTS = 3;
const POS = [["noun", "isim"], ["verb", "fiil"], ["adj", "sıfat"], ["adv", "zarf"], ["phrase", "kalıp"], ["other", "diğer"]];
const LEVELS = ["A2", "B1", "B2", "C1"];
const NEW_DECK_COLOR = "#4f46e5";

const select = (name, options, value) => {
  const s = el("select", { name }, options.map(([v, label]) => el("option", { value: v }, label)));
  s.value = value;
  return s;
};
const input = (name, value = "", attrs = {}) => {
  const i = el("input", { type: "text", name, autocomplete: "off", maxlength: 500, ...attrs });
  i.value = value;
  return i;
};
const field = (label, control) => el("label", { class: "field" }, el("span", {}, label), control);

export async function render(root, { mode, args }) {
  const decks = await listDecks();
  const existing = mode === "edit" ? await getCard(args[0]) : null;
  if (mode === "edit" && !existing) {
    root.append(el("p", { class: "empty" }, "Kart bulunamadı."));
    return;
  }
  const c = existing;
  const defaultDeck = c?.deckId ?? args[0] ?? decks[0]?.id ?? NEW_DECK;

  const deckSel = select("deck", [...decks.map((d) => [d.id, d.name]), [NEW_DECK, "＋ Yeni deste…"]], defaultDeck);
  const newDeckName = input("newDeck", "", { placeholder: "Yeni deste adı" });
  const newDeckField = field("Yeni deste adı", newDeckName);
  const syncDeck = () => { newDeckField.hidden = deckSel.value !== NEW_DECK; };
  deckSel.addEventListener("change", syncDeck);
  syncDeck();

  const article = select("article", [["", "(yok)"], ["der", "der"], ["die", "die"], ["das", "das"]], c?.de.article ?? "");
  const word = input("deWord", c?.de.word);
  const plural = input("plural", c?.de.plural ?? "");
  const pos = select("pos", POS, c?.de.pos ?? "noun");
  const note = input("note", c?.de.note ?? "");
  const en = input("enWord", c?.en.word);
  const tr = input("tr", c?.tr);
  const level = select("level", LEVELS.map((l) => [l, l]), c?.level ?? "B1");
  const tags = input("tags", (c?.tags ?? []).join(", "));
  const slots = Array.from({ length: SENTENCE_SLOTS }, (_, i) => ({
    de: input(`sde${i}`, c?.sentences[i]?.de ?? ""), en: input(`sen${i}`, c?.sentences[i]?.en ?? ""), tr: input(`str${i}`, c?.sentences[i]?.tr ?? ""),
  }));
  const error = el("p", { class: "form-error", role: "alert", hidden: true });
  const fail = (msg) => { error.textContent = msg; error.hidden = false; error.scrollIntoView({ block: "nearest" }); };

  async function submit(e) {
    e.preventDefault();
    error.hidden = true;
    const sentences = slots
      .map((s) => ({ de: s.de.value, en: s.en.value, tr: s.tr.value }))
      .filter((s) => s.de.trim() || s.en.trim() || s.tr.trim());
    const makingDeck = deckSel.value === NEW_DECK;
    if (makingDeck && !newDeckName.value.trim()) { fail("Yeni deste için bir ad yaz."); return; }
    const newDeck = makingDeck ? { id: crypto.randomUUID(), name: newDeckName.value.trim(), description: "", color: NEW_DECK_COLOR, category: "own" } : null;
    const deckId = newDeck?.id ?? deckSel.value;
    const check = validateCard({
      id: c?.id ?? crypto.randomUUID(), deckId, level: level.value,
      tags: tags.value.split(",").map((t) => t.trim()).filter(Boolean),
      de: { word: word.value, article: article.value || null, plural: plural.value, pos: pos.value, note: note.value },
      en: { word: en.value, pos: pos.value }, tr: tr.value, sentences, glosses: c?.glosses ?? {},
    });
    if (!check.ok) { fail(check.reason); return; }
    const all = await listCards(deckId);
    if (all.some((x) => x.id !== check.card.id && x.de.word.toLowerCase() === check.card.de.word.toLowerCase())) {
      fail("Bu destede bu Almanca kelime zaten var."); return;
    }
    try {
      await saveCard(check.card, c, newDeck);
    } catch {
      fail("Kart kaydedilemedi. Tekrar dene."); return;
    }
    toast("Kart kaydedildi.");
    location.hash = `#/deck/${encodeURIComponent(deckId)}`;
  }

  async function remove() {
    if (!confirm("Bu kart, ilerlemesi ve el yazısı notları silinsin mi? Bu işlem geri alınamaz.")) return;
    try {
      await deleteCard(c.id);
    } catch {
      fail("Kart silinemedi. Tekrar dene."); return;
    }
    toast("Kart silindi.");
    location.hash = `#/deck/${encodeURIComponent(c.deckId)}`;
  }

  root.append(
    el("a", { href: c ? `#/deck/${encodeURIComponent(c.deckId)}` : "#/decks" }, "← Geri"),
    el("h1", {}, c ? "Kartı düzenle" : "Yeni kart"),
    el("form", { class: "form card", onsubmit: submit, novalidate: true },
      field("Deste", deckSel), newDeckField,
      el("div", { class: "form-grid" }, field("Artikel", article), field("Almanca kelime *", word), field("Çoğul", plural)),
      el("div", { class: "form-grid" }, field("Tür", pos), field("Almanca not", note)),
      el("div", { class: "form-grid" }, field("İngilizce kelime *", en), field("Türkçe anlam *", tr)),
      slots.map((s, i) => el("fieldset", {}, el("legend", {}, `Örnek cümle ${i + 1}`),
        field("Almanca", s.de), field("İngilizce", s.en), field("Türkçe", s.tr))),
      el("div", { class: "form-grid" }, field("Seviye", level), field("Etiketler (virgülle)", tags)),
      error,
      el("div", { class: "row" },
        el("button", { type: "submit", class: "btn-primary" }, "Kaydet"),
        c ? el("button", { type: "button", class: "danger", onclick: remove }, "🗑️ Sil") : null)));
}
