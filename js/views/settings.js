import { el, toast, applyTheme } from "../ui.js";
import { getSetting, setSetting, getProgress, saveProgress } from "../store.js";
import { wipeAll } from "../backup.js";
import { speak, voicesFor } from "../tts.js";
import { renderDataTools } from "./data-tools.js";

const SAVE_FAIL = "Ayar kaydedilemedi (tarayıcı depolaması kapalı olabilir).";
const save = (key, value) => { if (!setSetting(key, value)) toast(SAVE_FAIL); };

function row(label, control, hint) {
  return el("label", { class: "setting" }, el("span", {}, label, hint ? el("small", { class: "dim" }, ` ${hint}`) : null), control);
}

function numberRow(label, key, min, max) {
  const i = el("input", { type: "number", min, max, inputmode: "numeric" });
  i.value = getSetting(key);
  i.addEventListener("change", () => {
    const n = Math.min(max, Math.max(min, Math.round(Number(i.value)) || min));
    i.value = n;
    save(key, n);
  });
  return row(label, i);
}

function selectRow(label, key, options, after) {
  const s = el("select", {}, options.map(([v, l]) => el("option", { value: v }, l)));
  s.value = getSetting(key);
  s.addEventListener("change", () => { save(key, s.value); after?.(s.value); });
  return row(label, s);
}

function checkRow(label, key, hint) {
  const c = el("input", { type: "checkbox" });
  c.checked = Boolean(getSetting(key));
  c.addEventListener("change", () => save(key, c.checked));
  return row(label, c, hint);
}

function voiceRow(label, key, lang) {
  const s = el("select", {});
  const fill = () => {
    s.replaceChildren(el("option", { value: "" }, "Otomatik"), ...voicesFor(lang).map((v) => el("option", { value: v.voiceURI }, `${v.name} (${v.lang})`)));
    s.value = getSetting(key) ?? "";
  };
  fill();
  window.speechSynthesis?.addEventListener?.("voiceschanged", () => { if (s.isConnected) fill(); }, { once: true });
  s.addEventListener("change", () => save(key, s.value || null));
  return row(label, s);
}

const isStandalone = () => navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;

async function appVersion() {
  const names = await caches.keys();
  return names.find((n) => n.startsWith("kartlar-"))?.replace("kartlar-", "") ?? "geliştirme";
}

async function wipe() {
  if (!confirm("Tüm kartlar, ilerleme ve el yazısı notları silinecek. Emin misin?")) return;
  if (!confirm("Son uyarı: Bu işlem geri alınamaz. Önce yedek aldığından emin misin?")) return;
  try {
    await wipeAll();
    location.hash = "#/";
    location.reload();
  } catch {
    toast("Veriler silinemedi.");
  }
}

export async function render(root) {
  const progress = await getProgress();
  const goal = el("input", { type: "number", min: 1, max: 200, inputmode: "numeric" });
  goal.value = progress.dailyGoal;
  goal.addEventListener("change", async () => {
    const n = Math.min(200, Math.max(1, Math.round(Number(goal.value)) || 1));
    goal.value = n;
    try { await saveProgress({ ...(await getProgress()), dailyGoal: n }); } catch { toast("Günlük hedef kaydedilemedi."); }
  });
  const rate = el("input", { type: "range", min: 0.5, max: 1.5, step: 0.1, "aria-label": "Konuşma hızı" });
  rate.value = getSetting("ttsRate");
  rate.addEventListener("change", () => save("ttsRate", Number(rate.value)));
  const version = el("span", {}, "…");
  appVersion().then((v) => { version.textContent = v; });

  root.append(
    el("h1", {}, "Ayarlar"),
    el("section", { class: "card" },
      el("h2", { style: "margin-top:0" }, "Çalışma"),
      row("Günlük hedef (kart)", goal),
      numberRow("Günde yeni kart", "newPerDay", 0, 100),
      numberRow("Günde en fazla tekrar", "maxReviews", 1, 500),
      selectRow("Kart yönü", "direction", [["de-en", "Almanca → İngilizce"], ["en-de", "İngilizce → Almanca"], ["mixed", "Karışık"]]),
      checkRow("Yazarken artikel de doğru olmalı", "strictArticle"),
      checkRow("Ses efektleri", "soundEffects", "(varsayılan kapalı)")),
    el("section", { class: "card" },
      el("h2", { style: "margin-top:0" }, "Seslendirme"),
      row("Hız", rate),
      voiceRow("Almanca ses", "voiceDe", "de"),
      voiceRow("İngilizce ses", "voiceEn", "en"),
      el("button", { type: "button", onclick: () => { const e = speak("Guten Tag. Hello.", "de"); if (e) toast(e); } }, "🔊 Dene")),
    el("section", { class: "card" },
      el("h2", { style: "margin-top:0" }, "Görünüm ve el yazısı"),
      selectRow("Tema", "theme", [["system", "Sistem"], ["light", "Açık"], ["dark", "Koyu"]], applyTheme),
      checkRow("Sadece Apple Pencil ile çiz", "penOnly", "(parmak çizmez)")),
    el("section", { class: "card" }, (() => { const box = el("div"); renderDataTools(box); return box; })(),
      checkRow("14 günde bir yedek hatırlat", "backupReminder")),
    el("section", { class: "card" },
      el("h2", { style: "margin-top:0" }, "iPad'e kurulum ve veri güvenliği"),
      el("p", {}, isStandalone() ? "✅ Uygulama ana ekran modunda çalışıyor." : "Safari'de Paylaş → Ana Ekrana Ekle ile kur."),
      el("p", { class: "dim" }, "Veriler yalnızca bu cihazda saklanır. Safari, uzun süre kullanılmayan ve ana ekrana eklenmemiş sitelerin verisini silebilir. Bu yüzden uygulamayı ana ekrana ekle ve düzenli yedek al.")),
    el("section", { class: "card" },
      el("h2", { style: "margin-top:0" }, "Tehlikeli bölge"),
      el("button", { type: "button", class: "danger", onclick: wipe }, "Tüm veriyi sil")),
    el("p", { class: "dim" }, "Sürüm: ", version));
}
