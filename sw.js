// Bump VERSION on every release; keep ASSETS in sync with files the app loads.
const VERSION = "v17";
const CACHE = `kartlar-${VERSION}`;
const ASSETS = [
  "./", "index.html", "manifest.webmanifest",
  "css/tokens.css", "css/palettes.css", "css/base.css", "css/layout.css", "css/card.css", "css/session.css", "css/assistant.css",
  "js/app.js", "js/ai.js", "js/db.js", "js/store.js", "js/ui.js", "js/router.js", "js/tts.js",
  "js/srs.js", "js/practice.js", "js/progress.js", "js/sources.js", "js/sfx.js", "js/importers.js", "js/backup.js",
  "js/views/category.js", "js/views/add-edit.js", "js/views/settings.js", "js/views/ai-settings.js", "js/views/assistant.js", "js/views/data-tools.js",
  "js/views/session.js", "js/views/modes.js", "js/views/mode-buttons.js", "js/views/stats.js",
  "js/views/home.js", "js/views/decks.js", "js/views/deck.js", "js/views/soon.js",
  "js/views/study.js", "js/views/card-face.js", "js/views/starred.js",
  "js/ink/strokes.js", "js/ink/ink-canvas.js", "js/ink/ink-tools.js",
  "data/starter-decks.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) => hit || fetch(req).catch(() => (req.mode === "navigate" ? caches.match("index.html") : Response.error()))
    )
  );
});
