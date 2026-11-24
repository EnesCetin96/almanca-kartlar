// Touch-friendly toolbar for the ink layer. Calls back into the layer; owns no strokes.
import { el } from "../ui.js";

const TOOLS = [
  { id: "pen", label: "Kalem", icon: "✏️" },
  { id: "highlighter", label: "Fosforlu kalem", icon: "🖍️" },
  { id: "eraser", label: "Silgi", icon: "🧽" },
];
const COLORS = [
  { value: "#111827", label: "Siyah" },
  { value: "#f8fafc", label: "Beyaz" },
  { value: "#2563eb", label: "Mavi" },
  { value: "#dc2626", label: "Kırmızı" },
  { value: "#16a34a", label: "Yeşil" },
  { value: "#f59e0b", label: "Sarı" },
];
const WIDTHS = [{ value: 3, label: "İnce", dot: 4 }, { value: 6, label: "Orta", dot: 8 }, { value: 12, label: "Kalın", dot: 14 }];

export function createToolbar({ layer, onDone }) {
  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  let state = { tool: "pen", color: prefersDark ? "#f8fafc" : "#111827", width: 6 };
  const groups = { tool: [], color: [], width: [] };

  const pick = (key, value) => {
    state = { ...state, [key]: value };
    layer.setBrush(state);
    groups[key].forEach(([v, btn]) => btn.setAttribute("aria-pressed", String(v === value)));
    colorRow.hidden = state.tool === "eraser";
    widthRow.hidden = state.tool === "eraser";
  };
  const choice = (key, value, btn) => {
    groups[key].push([value, btn]);
    btn.setAttribute("aria-pressed", String(state[key] === value));
    btn.addEventListener("click", () => pick(key, value));
    return btn;
  };

  const toolRow = el("div", { class: "ink-row", role: "group", "aria-label": "Araçlar" },
    TOOLS.map((t) => choice("tool", t.id, el("button", { type: "button", "aria-label": t.label }, `${t.icon} ${t.label}`))));
  const colorRow = el("div", { class: "ink-row", role: "group", "aria-label": "Renkler" },
    COLORS.map((c) => choice("color", c.value, el("button", { type: "button", "aria-label": c.label, class: "swatch" },
      el("span", { style: `background:${c.value}` })))));
  const widthRow = el("div", { class: "ink-row", role: "group", "aria-label": "Kalınlık" },
    WIDTHS.map((w) => choice("width", w.value, el("button", { type: "button", "aria-label": w.label },
      el("span", { class: "dotw", style: `width:${w.dot}px;height:${w.dot}px` })))));

  const undo = el("button", { type: "button", "aria-label": "Geri al", onclick: () => layer.undo() }, "↶");
  const redo = el("button", { type: "button", "aria-label": "Yinele", onclick: () => layer.redo() }, "↷");
  const clear = el("button", { type: "button", "aria-label": "Tümünü temizle", onclick: () => {
    if (confirm("Bu karttaki tüm el yazısı notları silinsin mi?")) layer.clear();
  } }, "🗑️");
  const done = el("button", { type: "button", class: "btn-primary", onclick: onDone }, "Bitti");

  layer.setBrush(state);
  const root = el("div", { class: "ink-toolbar card" }, toolRow, colorRow, widthRow, el("div", { class: "ink-row" }, undo, redo, clear, done));

  function refresh() {
    const s = layer.status();
    undo.disabled = !s.canUndo;
    redo.disabled = !s.canRedo;
    clear.disabled = !s.hasStrokes;
  }
  refresh();
  return { root, refresh };
}
