import { el } from "../ui.js";
import { getProgress, listCards, listStates, getSetting, setSetting } from "../store.js";
import { categoryTiles } from "./category.js";
import { viewProgress, backupReminderDue } from "../progress.js";
import { dueList, newList } from "../sources.js";

function greeting(hour) {
  if (hour < 5) return "İyi geceler";
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

const actionLink = (href, label, primary, enabled) =>
  enabled
    ? el("a", { class: `btn ${primary ? "btn-primary" : ""}`, href }, label)
    : el("span", { class: `btn ${primary ? "btn-primary" : ""}`, "aria-disabled": "true" }, label);

const isStandalone = () => navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
const looksLikeIos = () => /iPad|iPhone|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;

/** Dismissible notices: backup due, and "add to home screen" on iPad Safari. */
function notices() {
  const out = [];
  const dismiss = (box, key, value) => { setSetting(key, value); box.remove(); };
  const reminder = { enabled: getSetting("backupReminder"), lastBackupAt: getSetting("lastBackupAt"), snoozedAt: getSetting("backupSnoozedAt"), firstRunAt: getSetting("firstRunAt") };
  if (backupReminderDue(reminder)) {
    const box = el("div", { class: "card notice", role: "note" }, el("p", {}, "💾 Son yedeğinin üzerinden 14 günden fazla geçti."),
      el("div", { class: "row" },
        el("a", { class: "btn btn-primary", href: "#/settings" }, "Yedek al"),
        el("button", { type: "button", onclick: () => dismiss(box, "backupSnoozedAt", new Date().toISOString()) }, "Daha sonra")));
    out.push(box);
  }
  if (looksLikeIos() && !isStandalone() && !getSetting("installHintDismissed")) {
    const box = el("div", { class: "card notice", role: "note" },
      el("p", {}, "📲 Verilerin silinmemesi ve çevrimdışı çalışması için Paylaş → Ana Ekrana Ekle ile kur."),
      el("button", { type: "button", onclick: () => dismiss(box, "installHintDismissed", true) }, "Tamam, kapat"));
    out.push(box);
  }
  return out;
}

export async function render(root) {
  const [saved, cards, states] = await Promise.all([getProgress(), listCards(), listStates()]);
  const now = new Date();
  const p = viewProgress(saved, now);
  const dueN = dueList(cards, states, now, getSetting("maxReviews")).length;
  const newN = newList(cards, states, Math.max(0, getSetting("newPerDay") - p.newToday)).length;
  const starredCount = [...states.values()].filter((s) => s.starred).length;
  const pct = Math.min(100, Math.round((p.dailyDone / p.dailyGoal) * 100));

  root.append(
    el("h1", {}, `${greeting(now.getHours())}!`),
    ...notices(),
    el("section", { class: "card row", "aria-label": "Günlük hedef" },
      el("div", { class: "ring", style: `--p:${pct}`, role: "img", "aria-label": `Günlük hedef yüzde ${pct}` },
        el("span", {}, `${p.dailyDone}/${p.dailyGoal}`)),
      el("div", {},
        el("p", {}, `🔥 Seri: ${p.streak} gün`),
        el("p", { class: "dim" }, `${p.xp} XP · ${cards.length} kart`))),
    el("div", { class: "row", style: "margin-top:1rem" },
      actionLink("#/session/flip/due", `Bugün tekrar edilecek: ${dueN} kart`, true, dueN > 0),
      actionLink("#/session/flip/new", `Yeni kart öğren (${newN})`, false, newN > 0),
      el("a", { class: "btn", href: "#/starred" }, `⭐ Tekrar listem (${starredCount})`)),
    el("h2", {}, "Kategoriler"),
    await categoryTiles());
}
