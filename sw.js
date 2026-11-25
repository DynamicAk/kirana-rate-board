// Service worker: caches the app files so the board opens offline.
// Prices themselves are cached by Firestore, not here.
const CACHE = "rateboard-v2.1";
const APP_FILES = [
  "./", "./index.html", "./app.js", "./firebase-config.js", "./data/synonyms.js", "./voice.js",
  "./smart-search.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"
];
// Third-party files the page needs (Tailwind, fonts, Firebase SDK). Cached after first load.
const CDN_HOSTS = ["cdn.tailwindcss.com", "fonts.googleapis.com", "fonts.gstatic.com", "www.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Our own files: try the network first (so updates show up), fall back to cache offline.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // CDN files: serve the cached copy at once, refresh it in the background.
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const fresh = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => cached);
        return cached || fresh;
      })
    );
  }
  // Everything else (Firestore, login) goes straight to the network.
});
