// Practice session shell: queue, scoring, feedback panel and summary.
// Route: #/session/<mode>/<source>   (mode: flip|choice|typing|cloze)
import { el, toast } from "../ui.js";
import { listCards, listStates, saveCardState, setStarred, getProgress, saveProgress, getSetting, newCardState } from "../store.js";
import { applyAnswer, isNew } from "../srs.js";
import { pickCards } from "../sources.js";
import { recordStudy, viewProgress } from "../progress.js";
import { beep } from "../sfx.js";
import { MODES } from "./modes.js";

const QUIZ_SIZE = 10;
const XP = { again: 0, hard: 5, good: 10, easy: 12 };
const WRONG_BEFORE_SUGGESTION = 2;

const EMPTY = {
  due: "Bugün tekrar edilecek kart kalmadı. 🎉",
  new: "Bugünkü yeni kart hakkın doldu ya da yeni kart kalmadı.",
  starred: "Henüz işaretli kelimen yok. Kartta ⭐'a dokun.",
};

export async function render(root, { args }) {
  const [mode, rawSource] = args;
  const source = decodeURIComponent(rawSource);
  const def = MODES[mode];
  if (!def) {
    root.append(el("p", { class: "empty" }, "Bilinmeyen alıştırma modu."));
    return;
  }
  const [cards, initialStates, saved] = await Promise.all([listCards(), listStates(), getProgress()]);
  const now = new Date();
  const settings = { direction: getSetting("direction"), strictArticle: getSetting("strictArticle") };
  let states = initialStates;
  let progress = saved;

  const newLeft = Math.max(0, getSetting("newPerDay") - viewProgress(saved, now).newToday);
  let selected = pickCards({ source, cards, states, now, newLeft, maxReviews: getSetting("maxReviews"), size: QUIZ_SIZE });
  if (def.filter) selected = selected.filter(def.filter);
  if (!selected.length) {
    root.append(el("a", { href: "#/" }, "← Ana sayfa"),
      el("p", { class: "empty" }, def.filter ? "Bu kaynakta boşluk doldurulacak cümle yok." : EMPTY[source] ?? "Bu kaynakta kart yok."));
    return;
  }

  let queue = selected;
  let completed = 0;
  let xpTotal = 0;
  let correctAttempts = 0;
  let totalAttempts = 0;
  const attempts = new Map();
  const earned = new Map();
  const learned = [];
  const wasNew = new Set(selected.filter((c) => isNew((states.get(c.id) ?? newCardState(c.id)).srs)).map((c) => c.id));

  const bar = el("progress", { "aria-label": "Oturum ilerlemesi", value: 0, max: selected.length });
  const qHost = el("div");
  const panel = el("div", { "aria-live": "polite" });
  root.append(
    el("div", { class: "session-top" }, el("a", { href: "#/", "aria-label": "Oturumdan çık" }, "✕ Çık"), bar),
    el("div", { class: "session" }, qHost, panel));

  const persist = async (action, message) => {
    try { await action(); } catch { toast(message); }
  };

  function showFeedback(card, nextState, result) {
    const fb = result.feedback;
    const suggest = !result.correct && nextState.stats.wrong >= WRONG_BEFORE_SUGGESTION && !nextState.starred;
    const cont = el("button", { type: "button", class: "btn-primary", onclick: next }, "Devam");
    const starBtn = suggest ? el("button", { type: "button" }, "⭐ Tekrar listesine ekle") : null;
    starBtn?.addEventListener("click", async () => {
      await persist(async () => {
        const s = await setStarred(card.id, true);
        states = new Map(states).set(card.id, s);
        starBtn.textContent = "⭐ Eklendi";
        starBtn.disabled = true;
      }, "Tekrar listesine eklenemedi.");
    });
    panel.className = `feedback ${fb.kind}`;
    panel.replaceChildren(
      el("div", {}, el("strong", {}, fb.title), fb.detail ? el("p", {}, fb.detail) : null),
      el("div", { class: "row" }, starBtn, cont));
    cont.focus();
  }

  async function handle(card, state, result) {
    const first = !attempts.has(card.id);
    attempts.set(card.id, (attempts.get(card.id) ?? 0) + 1);
    totalAttempts += 1;
    if (result.correct) correctAttempts += 1;
    const xp = first ? XP[result.rating] : 0;
    xpTotal += xp;
    earned.set(card.id, (earned.get(card.id) ?? 0) + xp);
    if (first && result.correct) learned.push(card);

    const nextState = applyAnswer(state, result.rating);
    states = new Map(states).set(card.id, nextState);
    await persist(() => saveCardState(nextState), "İlerleme kaydedilemedi.");
    beep(result.correct);

    if (result.rating === "again") {
      queue = [...queue.slice(1), card];
    } else {
      queue = queue.slice(1);
      completed += 1;
      progress = recordStudy(progress, { xp: earned.get(card.id), cards: 1, newCards: wasNew.has(card.id) ? 1 : 0 });
      await persist(() => saveProgress(progress), "Günlük ilerleme kaydedilemedi.");
    }
    if (result.feedback) showFeedback(card, nextState, result); else next();
  }

  function next() {
    panel.className = "";
    panel.replaceChildren();
    if (!queue.length) { finish(); return; }
    const card = queue[0];
    const state = states.get(card.id) ?? newCardState(card.id);
    bar.max = completed + queue.length;
    bar.value = completed;
    let answered = false;
    qHost.replaceChildren(def.render({
      card, state, pool: cards, settings,
      onAnswer: (result) => { if (!answered) { answered = true; handle(card, state, result); } },
    }));
  }

  function finish() {
    bar.value = bar.max;
    const view = viewProgress(progress);
    const firstTryRight = learned.length;
    const pct = Math.round((firstTryRight / attempts.size) * 100);
    qHost.replaceChildren(el("div", { class: "card summary" },
      el("div", { class: "pop", "aria-hidden": "true" }, "🎉"),
      el("h1", {}, "Oturum bitti!"),
      el("p", {}, `+${xpTotal} XP · İlk denemede doğru: %${pct}`),
      el("p", {}, `Bugünkü hedef: ${view.dailyDone}/${view.dailyGoal} · 🔥 ${view.streak} gün`),
      learned.length
        ? el("div", {}, el("h2", {}, "İlk denemede bildiklerin"), el("p", {}, learned.map((c) => c.de.word).join(", ")))
        : el("p", { class: "dim" }, "Bu sefer hepsi tekrar edilecek, sorun değil."),
      el("div", { class: "row" },
        el("a", { class: "btn btn-primary", href: "#/" }, "Ana sayfa"),
        el("button", { type: "button", onclick: () => { root.replaceChildren(); render(root, { args }); } }, "Yeniden başla"))));
    panel.replaceChildren();
  }

  next();
}
