// Optional feedback beeps. Off by default (setting "soundEffects").
import { getSetting } from "./store.js";

let audio = null;

export function beep(ok) {
  if (!getSetting("soundEffects")) return;
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = ok ? 660 : 220;
    gain.gain.setValueAtTime(0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.2);
  } catch {
    // Sound is a nicety; a browser without Web Audio simply stays silent.
  }
}
