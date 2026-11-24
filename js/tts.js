// Text-to-speech via speechSynthesis. Voices load late on iOS, so listen for voiceschanged.
import { getSetting } from "./store.js";

const LANG = { de: "de-DE", en: "en-GB" };
const supported = "speechSynthesis" in window;
let voices = [];

const loadVoices = () => { voices = speechSynthesis.getVoices(); };

export function initTts() {
  if (!supported) return;
  loadVoices();
  speechSynthesis.addEventListener("voiceschanged", loadVoices);
}

export const voicesFor = (lang) =>
  voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(lang));

/** Must be called from a user tap (iOS). Returns an error message in Turkish, or null on success. */
export function speak(text, lang) {
  if (!supported) return "Bu tarayıcı seslendirmeyi desteklemiyor.";
  if (voices.length && !voicesFor(lang).length) {
    return lang === "de" ? "Bu cihazda Almanca ses bulunamadı." : "Bu cihazda İngilizce ses bulunamadı.";
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANG[lang];
  u.rate = getSetting("ttsRate");
  const uri = getSetting(lang === "de" ? "voiceDe" : "voiceEn");
  const voice = uri && voices.find((v) => v.voiceURI === uri);
  if (voice) u.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return null;
}
