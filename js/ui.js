// DOM helpers. Strings are always appended as text nodes (never parsed as HTML).
export function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid);
  return node;
}

/** theme: "system" | "light" | "dark" (system leaves the choice to prefers-color-scheme). */
export function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

/** [value, label, address-bar colour]. "kahve" is the default and needs no data-palette attribute. */
export const PALETTES = Object.freeze([
  ["kahve", "Kahve & Turkuaz", "#0b7075"],
  ["bordo", "Bordo & Altın", "#86203c"],
  ["lacivert", "Lacivert & Turkuaz", "#1f3d66"],
  ["klasik", "Klasik (indigo)", "#4f46e5"],
]);

export function applyPalette(palette) {
  const known = PALETTES.find(([value]) => value === palette) ?? PALETTES[0];
  if (known[0] === PALETTES[0][0]) delete document.documentElement.dataset.palette;
  else document.documentElement.dataset.palette = known[0];
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", known[2]);
}

export function toast(message, action) {
  const host = document.getElementById("toast");
  const item = el("div", { class: "toast-item" }, el("span", {}, message));
  const close = () => item.remove();
  if (action) item.append(el("button", { onclick: () => { action.onClick(); close(); } }, action.label));
  else setTimeout(close, 4000);
  host.append(item);
}

export function showError(message) {
  toast(message);
}
