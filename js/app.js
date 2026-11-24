import { openDb } from "./db.js";
import { seedIfNeeded, getSetting, setSetting } from "./store.js";
import { buildNav, startRouter } from "./router.js";
import { toast, applyTheme, applyPalette } from "./ui.js";
import { initTts } from "./tts.js";

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").then((reg) => {
    const offerUpdate = (worker) =>
      toast("Yeni sürüm var.", { label: "Yenile", onClick: () => worker.postMessage("SKIP_WAITING") });
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) offerUpdate(w);
      });
    });
  }).catch(() => toast("Çevrimdışı mod başlatılamadı."));
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloaded) { reloaded = true; location.reload(); }
  });
}

async function main() {
  applyTheme(getSetting("theme"));
  applyPalette(getSetting("palette"));
  if (!getSetting("firstRunAt")) setSetting("firstRunAt", new Date().toISOString());
  buildNav(document.getElementById("nav"));
  initTts();
  try {
    await openDb();
    await seedIfNeeded();
    navigator.storage?.persist?.();
  } catch (err) {
    toast("Veri deposu açılamadı. Safari'de özel gezinme kapalı olmalı.");
    throw err;
  }
  startRouter(document.getElementById("view"), () => toast("Beklenmeyen bir hata oldu."));
  registerServiceWorker();
}

main();
