// Settings card for the writing assistant: the user's own API key and the model choice.
import { el, toast } from "../ui.js";
import { MODELS, clearAiKey, getAiKey, isValidKey, saveAiKey } from "../ai.js";
import { getSetting, setSetting } from "../store.js";

const statusText = () => {
  const key = getAiKey();
  return key ? `✅ Anahtar bu cihazda kayıtlı (…${key.slice(-4)})` : "Henüz anahtar eklenmedi.";
};

export function renderAiSettings() {
  const status = el("p", { class: "dim", "aria-live": "polite" }, statusText());
  const input = el("input", { type: "password", autocomplete: "off", autocapitalize: "none", spellcheck: "false", placeholder: "sk-ant-…", "aria-label": "Anthropic API anahtarı" });
  const save = el("button", { type: "button", class: "btn-primary" }, "Kaydet");
  const remove = el("button", { type: "button" }, "Anahtarı sil");
  const model = el("select", { "aria-label": "Asistan modeli" }, Object.entries(MODELS).map(([value, { label }]) => el("option", { value }, label)));
  model.value = getSetting("aiModel");

  save.addEventListener("click", () => {
    if (!isValidKey(input.value)) { toast("Bu bir Anthropic anahtarına benzemiyor (sk-ant-… ile başlamalı)."); return; }
    if (!saveAiKey(input.value)) { toast("Anahtar kaydedilemedi (tarayıcı depolaması kapalı olabilir)."); return; }
    input.value = "";
    status.textContent = statusText();
    toast("Anahtar kaydedildi.");
  });
  remove.addEventListener("click", () => { clearAiKey(); input.value = ""; status.textContent = statusText(); toast("Anahtar silindi."); });
  model.addEventListener("change", () => { if (!setSetting("aiModel", model.value)) toast("Ayar kaydedilemedi."); });

  return el("section", { class: "card" },
    el("h2", { style: "margin-top:0" }, "Yapay zekâ asistanı"),
    el("p", { class: "dim" },
      "Nota yazdığın cümleyi kontrol eder ve çevirir. Yalnızca “Kontrol et” ya da “Çevir” dediğin metin internet üzerinden Anthropic'e gider; ",
      "kartların, notların ve ilerlemen gönderilmez. Kullanım ücretini kendi Anthropic hesabın öder (cümle başına çok küçük)."),
    el("p", { class: "dim" },
      "Anahtar yalnızca bu cihazda, bu sitenin adresinde saklanır ve yedek dosyasına girmez. Anthropic konsolunda aylık harcama limiti koymanı öneririm. ",
      "Aynı adreste (enescetin96.github.io) başka bir sayfa yayınlarsan o sayfa da anahtarı okuyabilir; yayınlama."),
    status,
    el("label", { class: "setting" }, el("span", {}, "API anahtarı"), input),
    el("div", { class: "ai-actions" }, save, remove),
    el("label", { class: "setting" }, el("span", {}, "Model"), model));
}
