// Backup / restore and CSV+JSON import controls (used by the settings screen).
import { el, toast } from "../ui.js";
import { listCards, listDecks, setSetting } from "../store.js";
import { exportBackup, restoreBackup, saveImported } from "../backup.js";
import { importCsv, importJson, CSV_TEMPLATE } from "../importers.js";

const MAX_SHOWN_REASONS = 10;
const RELOAD_DELAY_MS = 1500;

/** Shares as a file where the OS supports it (iPad: Save to Files), otherwise downloads it. */
async function saveFile(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (err) {
      if (err.name === "AbortError") return false; // user closed the share sheet
      // any other share failure: fall back to a normal download below
    }
  }
  const url = URL.createObjectURL(file);
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

const filePicker = (label, accept, onFile) => {
  const input = el("input", { type: "file", accept, class: "file-input", "aria-label": label });
  input.addEventListener("change", async () => {
    const file = input.files[0];
    input.value = "";
    if (file) await onFile(file);
  });
  return el("label", { class: "btn" }, label, input);
};

function report(host, lines) {
  host.replaceChildren(...lines.map((l) => el("p", {}, l)));
}

export function renderDataTools(host) {
  const status = el("div", { class: "report", role: "status" });

  async function doExport() {
    try {
      const backup = await exportBackup();
      const stamp = new Date().toISOString().slice(0, 10);
      if (await saveFile(`almanca-kartlar-yedek-${stamp}.json`, JSON.stringify(backup), "application/json")) {
        setSetting("lastBackupAt", new Date().toISOString());
        report(status, [`Yedek hazır: ${backup.cards.length} kart, ${backup.ink.length} el yazısı notu.`]);
      }
    } catch {
      toast("Yedek oluşturulamadı.");
    }
  }

  async function doRestore(file) {
    let raw;
    try { raw = JSON.parse(await file.text()); } catch { toast("Yedek dosyası okunamadı."); return; }
    if (!confirm("Yedekteki veriler mevcut tüm verinin yerine geçecek. Devam edilsin mi?")) return;
    try {
      const { cards, skipped } = await restoreBackup(raw);
      report(status, [`Geri yüklendi: ${cards} kart.`, skipped ? `${skipped} hatalı kayıt atlandı.` : "Atlanan kayıt yok.", "Uygulama yeniden açılıyor…"]);
      setTimeout(() => location.reload(), RELOAD_DELAY_MS);
    } catch (err) {
      toast(err.message || "Geri yükleme başarısız.");
    }
  }

  async function doImport(file) {
    try {
      const text = await file.text();
      const [decks, cards] = await Promise.all([listDecks(), listCards()]);
      const ctx = { decks, cards, newId: () => crypto.randomUUID() };
      const isJson = /\.json$/i.test(file.name) || /^\s*[[{]/.test(text);
      const result = isJson ? importJson(text, ctx) : importCsv(text, ctx);
      await saveImported(result);
      const shown = result.skipped.slice(0, MAX_SHOWN_REASONS).map((s) => `Satır ${s.row}: ${s.reason}`);
      report(status, [
        `${result.cards.length} kart eklendi, ${result.duplicates} mükerrer atlandı, ${result.skipped.length} hatalı satır atlandı.`,
        ...shown,
        result.skipped.length > MAX_SHOWN_REASONS ? `…ve ${result.skipped.length - MAX_SHOWN_REASONS} satır daha.` : "",
      ].filter(Boolean));
    } catch (err) {
      toast(err.message || "İçe aktarma başarısız.");
    }
  }

  host.append(
    el("h2", {}, "Yedekleme"),
    el("p", { class: "dim" }, "Yedek; kartları, ilerlemeyi, işaretleri, el yazısı notlarını ve ayarları tek bir JSON dosyasında toplar."),
    el("div", { class: "row" },
      el("button", { type: "button", onclick: doExport }, "⬇️ Yedeği dışa aktar"),
      filePicker("⬆️ Yedekten geri yükle", "application/json,.json", doRestore)),
    el("h2", {}, "Kart içe aktarma"),
    el("p", { class: "dim" }, "CSV (virgül veya noktalı virgül) ya da JSON dosyası. Aynı deste ve aynı Almanca kelime tekrar eklenmez."),
    el("div", { class: "row" },
      filePicker("📥 CSV / JSON seç", ".csv,.json,.txt,text/csv,application/json", doImport),
      el("button", { type: "button", onclick: () => saveFile("kart-sablonu.csv", CSV_TEMPLATE, "text/csv") }, "Şablon CSV indir")),
    status);
}
