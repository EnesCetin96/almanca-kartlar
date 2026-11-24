// Assistant panel under the note box: check / translate the user's own sentences.
// All text from the model is shown with textContent (never as HTML).
import { el } from "../ui.js";
import { AssistantError, applyCorrection, askAssistant, getAiKey } from "../ai.js";
import { getSetting } from "../store.js";

const LANGUAGE_NAMES = { de: "Almanca", en: "İngilizce", tr: "Türkçe", other: "" };
const BUSY_TEXT = "Asistan düşünüyor…";

const line = (label, text, lang) =>
  el("p", { class: "ai-line" }, el("strong", {}, label), " ", el("span", lang ? { lang } : {}, text));

/** The selected part of the note, or the whole note when nothing is selected. */
function targetText(noteBox) {
  const { selectionStart: start, selectionEnd: end, value } = noteBox;
  return start !== end ? value.slice(start, end) : value;
}

function checkView(out, noteBox) {
  const parts = [];
  if (out.language === "tr") parts.push(el("p", { class: "ai-verdict" }, "ℹ️ Bu metin Türkçe görünüyor. Kontrol için Almanca ya da İngilizce yaz; çeviri için Çevir'e bas."));
  else parts.push(el("p", { class: out.correct ? "ai-verdict ok" : "ai-verdict" }, out.correct ? "✅ Doğru görünüyor" : "✏️ Düzeltme önerisi"));
  if (out.confidence === "low") parts.push(el("p", { class: "ai-warn" }, "⚠️ Asistan emin değil. Başka bir kaynakla da kontrol et."));
  if (!out.correct && out.corrected) {
    parts.push(line("Önerilen:", out.corrected, out.language === "other" ? undefined : out.language));
    parts.push(el("button", {
      type: "button",
      onclick: (e) => {
        noteBox.value = applyCorrection(noteBox.value, out.input, out.corrected);
        noteBox.dispatchEvent(new Event("input"));
        e.currentTarget.disabled = true;
        e.currentTarget.textContent = "✓ Nota uygulandı";
      },
    }, "Düzeltmeyi nota uygula"));
  }
  if (out.explanation) parts.push(line("Açıklama:", out.explanation));
  if (out.translation && out.language !== "tr") parts.push(line("Türkçesi:", out.translation));
  return parts;
}

function translateView(out) {
  return ["de", "en", "tr"].filter((code) => out[code]).map((code) => {
    const name = `${code === "de" ? "Almanca" : code === "en" ? "İngilizce" : "Türkçe"}${out.language === code ? " (orijinal)" : ""}:`;
    return line(name, out[code], code);
  });
}

export function renderAssistant(noteBox) {
  const result = el("div", { class: "ai-result", "aria-live": "polite" });
  const checkBtn = el("button", { type: "button", "aria-label": "Notumdaki cümleyi yapay zekâ ile kontrol et" }, "✓ Kontrol et");
  const translateBtn = el("button", { type: "button", "aria-label": "Notumdaki metni çevir" }, "🌐 Çevir");
  const hint = el("p", { class: "dim ai-hint" }, "Asistanı kullanmak için ", el("a", { href: "#/settings" }, "Ayarlar'dan API anahtarını ekle"), ".");
  hint.hidden = Boolean(getAiKey());

  async function run(task) {
    hint.hidden = Boolean(getAiKey());
    checkBtn.disabled = translateBtn.disabled = true;
    result.replaceChildren(el("p", { class: "dim" }, BUSY_TEXT));
    try {
      const out = await askAssistant({ task, text: targetText(noteBox), modelKey: getSetting("aiModel") });
      const echo = el("p", { class: "ai-echo dim" }, `«${out.input.length > 80 ? `${out.input.slice(0, 80)}…` : out.input}»`);
      result.replaceChildren(echo, ...(task === "check" ? checkView(out, noteBox) : translateView(out)));
    } catch (err) {
      const message = err instanceof AssistantError ? err.message : "Beklenmeyen bir hata oldu. Tekrar dene.";
      result.replaceChildren(el("p", { class: "ai-error", role: "alert" }, message));
    } finally {
      checkBtn.disabled = translateBtn.disabled = false;
    }
  }

  checkBtn.addEventListener("click", () => run("check"));
  translateBtn.addEventListener("click", () => run("translate"));
  return el("section", { class: "ai-box", "aria-label": "Yapay zekâ asistanı" },
    el("div", { class: "ai-actions" }, checkBtn, translateBtn, el("small", { class: "dim" }, "Seçili kısım yoksa tüm not gönderilir")),
    hint, result);
}
