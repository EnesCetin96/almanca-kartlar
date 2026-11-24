// Hash router. Views are loaded lazily; each exports render(root, params).
import { el } from "./ui.js";

export const NAV = [
  { path: "", label: "Ana sayfa", icon: "🏠" },
  { path: "decks", label: "Konular", icon: "📚" },
  { path: "starred", label: "Tekrar listem", icon: "⭐" },
  { path: "stats", label: "İstatistik", icon: "📊" },
  { path: "settings", label: "Ayarlar", icon: "⚙️" },
];

// [pattern, view module, extra params]. Views not built yet use soon.js.
const ROUTES = [
  [/^$/, "home"],
  [/^decks$/, "decks"],
  [/^category\/([^/]+)$/, "category"],
  [/^deck\/([^/]+)$/, "deck"],
  [/^study\/([^/]+)(?:\/(\d+))?$/, "study"],
  [/^starred$/, "starred"],
  [/^session\/([^/]+)\/([^/]+)$/, "session"],
  [/^stats$/, "stats"],
  [/^card\/new(?:\/([^/]+))?$/, "add-edit", { mode: "new" }],
  [/^card\/edit\/([^/]+)$/, "add-edit", { mode: "edit" }],
  [/^settings$/, "settings"],
];

export function buildNav(nav) {
  nav.replaceChildren(
    ...NAV.map((n) => el("a", { href: `#/${n.path}`, "data-path": n.path }, el("span", { class: "ico", "aria-hidden": "true" }, n.icon), n.label))
  );
}

function markActive(path) {
  const top = path.split("/")[0];
  const active = ["card", "category"].includes(top) ? "decks" : top === "deck" ? "decks" : ["study", "session"].includes(top) ? (path.includes("/starred") ? "starred" : top === "session" ? "" : "decks") : top;
  document.querySelectorAll("#nav a").forEach((a) => {
    if (a.dataset.path === active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

async function render(root) {
  const path = location.hash.replace(/^#\/?/, "");
  markActive(path);
  for (const [re, name, extra] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    try {
      const view = await import(`./views/${name}.js`);
      root.replaceChildren();
      await view.render(root, { id: m[1] ? decodeURIComponent(m[1]) : undefined, idx: m[2], args: m.slice(1), ...extra });
    } catch (err) {
      root.replaceChildren(el("p", { class: "empty" }, "Bu ekran açılamadı. Sayfayı yenilemeyi dene."));
      throw err;
    }
    root.scrollTop = 0;
    root.focus({ preventScroll: true }); // moves screen-reader focus to the new screen
    return;
  }
  root.replaceChildren(el("p", { class: "empty" }, "Sayfa bulunamadı."));
}

export function startRouter(root, onError) {
  const run = () => render(root).catch(onError);
  addEventListener("hashchange", run);
  run();
}
