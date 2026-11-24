// Browse a set of cards: deck id, "starred" or "all". Swipe or use the arrows to move.
import { el, toast } from "../ui.js";
import { listCards, listDecks, listStates, setStarred, setNote, getInk, saveInk, getSetting } from "../store.js";
import { speak } from "../tts.js";
import { renderCardFace } from "./card-face.js";
import { createInkLayer } from "../ink/ink-canvas.js";
import { createToolbar } from "../ink/ink-tools.js";

const SWIPE_PX = 60;
const NOTE_SAVE_DELAY_MS = 500;

/** Icon + label; the label hides on narrow phones (the button keeps its aria-label). */
const actionContent = (icon, label, keep = false) =>
  [el("span", { "aria-hidden": "true" }, icon), el("span", { class: keep ? "lbl keep" : "lbl" }, label)];
const starContent = (on) => actionContent(on ? "⭐" : "☆", on ? "İşaretli" : "İşaretle");

export async function render(root, { id, idx }) {
  const [all, decks, initialStates] = await Promise.all([listCards(), listDecks(), listStates()]);
  let states = initialStates;
  const cards = id === "starred" ? all.filter((c) => states.get(c.id)?.starred)
    : id === "all" ? all : all.filter((c) => c.deckId === id);
  const backHref = id === "starred" ? "#/starred" : id === "all" ? "#/decks" : `#/deck/${encodeURIComponent(id)}`;

  root.append(el("a", { href: backHref }, id === "starred" ? "← Tekrar listem" : "← Konuya dön"));
  if (!cards.length) {
    root.append(el("p", { class: "empty" }, id === "starred" ? "Henüz işaretli kelimen yok. Kartta ⭐'a dokun." : "Bu destede kart yok."));
    return;
  }

  let i = Math.min(Math.max(Number(idx) || 0, 0), cards.length - 1);
  const host = el("div");
  root.append(host);

  const say = (text, lang) => {
    const err = speak(text, lang);
    if (err) toast(err);
  };

  async function toggleStar(card, btn) {
    try {
      const next = await setStarred(card.id, !states.get(card.id)?.starred);
      states = new Map(states).set(card.id, next);
      btn.setAttribute("aria-pressed", String(next.starred));
      btn.replaceChildren(...starContent(next.starred));
    } catch {
      toast("İşaret kaydedilemedi.");
    }
  }

  /** Ink layer, its toolbar toggle and the typed note field for one card. */
  function buildNotes(card, face) {
    let toolbar = null;
    const layer = createInkLayer({
      penOnly: () => getSetting("penOnly"),
      onChange: (strokes) => {
        saveInk(card.id, strokes).catch(() => toast("El yazısı kaydedilemedi."));
        toolbar?.refresh();
      },
    });
    getInk(card.id).then((rec) => layer.load(rec?.strokes ?? [])).catch(() => toast("El yazısı notu yüklenemedi."));

    const toolbarHost = el("div");
    const inkBtn = el("button", { type: "button", "aria-pressed": "false", "aria-label": "El yazısı not al" }, ...actionContent("✍️", "Not"));
    const stop = () => {
      layer.setActive(false);
      toolbarHost.replaceChildren();
      inkBtn.setAttribute("aria-pressed", "false");
      toolbar = null;
    };
    inkBtn.addEventListener("click", () => {
      if (toolbar) { stop(); return; }
      toolbar = createToolbar({ layer, onDone: stop });
      toolbarHost.replaceChildren(toolbar.root);
      layer.setActive(true);
      inkBtn.setAttribute("aria-pressed", "true");
    });

    const noteBox = el("textarea", { class: "note-input", rows: 3, "aria-label": "Yazılı notlarım", placeholder: "Notlarım (iPad'de Scribble ile elle yazabilirsin)" });
    noteBox.value = states.get(card.id)?.note ?? "";
    let timer = null;
    const saveNote = async () => {
      clearTimeout(timer);
      try {
        const next = await setNote(card.id, noteBox.value);
        states = new Map(states).set(card.id, next);
      } catch {
        toast("Not kaydedilemedi.");
      }
    };
    noteBox.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(saveNote, NOTE_SAVE_DELAY_MS); });
    noteBox.addEventListener("blur", saveNote);

    return { wrap: el("div", { class: "face-wrap" }, face, layer.canvas), inkBtn, toolbarHost, noteBox };
  }

  function draw() {
    const card = cards[i];
    const deck = decks.find((d) => d.id === card.deckId);
    const starred = Boolean(states.get(card.id)?.starred);
    history.replaceState(null, "", `#/study/${encodeURIComponent(id)}/${i}`);

    const star = el("button", { type: "button", "aria-pressed": String(starred), "aria-label": "Tekrar listesine ekle/çıkar" }, ...starContent(starred));
    star.addEventListener("click", () => toggleStar(card, star));

    const face = renderCardFace(card);
    const { wrap, inkBtn, toolbarHost, noteBox } = buildNotes(card, face);
    let startX = null;
    face.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
    face.addEventListener("touchend", (e) => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
    });

    host.replaceChildren(
      el("div", { class: "study-top" },
        el("div", { class: "study-meta" },
          el("span", { class: "dim" }, deck?.name ?? ""),
          card.level ? el("span", { class: "level-chip" }, card.level) : null),
        el("div", { class: "study-progress" },
          el("progress", { max: cards.length, value: i + 1, "aria-label": "İlerleme" }),
          el("span", { class: "counter" }, `${i + 1}/${cards.length}`))),
      wrap,
      el("div", { class: "study-actions" },
        star,
        inkBtn,
        el("a", { class: "btn", href: `#/card/edit/${encodeURIComponent(card.id)}`, "aria-label": "Kartı düzenle" }, ...actionContent("✏️", "Düzenle")),
        el("button", { type: "button", "aria-label": "Almanca seslendir", onclick: () => say(card.de.article ? `${card.de.article} ${card.de.word}` : card.de.word, "de") }, ...actionContent("🔊", "DE", true)),
        el("button", { type: "button", "aria-label": "İngilizce seslendir", onclick: () => say(card.en.word, "en") }, ...actionContent("🔊", "EN", true))),
      toolbarHost,
      noteBox,
      el("div", { class: "study-nav" },
        el("button", { type: "button", "aria-label": "Önceki kart", disabled: i === 0, onclick: () => go(-1) }, "← Geri"),
        el("button", { type: "button", class: "btn-primary", "aria-label": "Sonraki kart", disabled: i === cards.length - 1, onclick: () => go(1) }, "İleri →")));
  }

  function go(delta) {
    const next = i + delta;
    if (next < 0 || next >= cards.length) return;
    i = next;
    draw();
  }

  // Keyboard: arrows move between cards. The listener removes itself once this view is gone.
  const onKey = (e) => {
    if (!host.isConnected) { removeEventListener("keydown", onKey); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
  };
  addEventListener("keydown", onKey);

  draw();
}
