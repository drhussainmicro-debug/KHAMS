/* KHAMS service worker — auto-updating.
   HOW TO SHIP AN UPDATE: change your files, then bump the number in VERSION
   below (e.g. v16 -> v17) and push. Devices pick up the new version automatically:
   immediately if the app is idle, or as soon as the user leaves the app / taps
   "Update" if they are in the middle of entering data (so nothing they typed is lost). */
const VERSION = "khams-v18";
const CORE = [
  "./", "./index.html", "./manifest.json",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"
];

// Install: pre-cache the core files. The new version then WAITS until the page
// tells it to take over (see "message" below), so an open screen is never
// reloaded underneath the user. On a first-ever install there is nothing to
// wait for, so it activates straight away.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(CORE.map((url) => cache.add(url).catch(() => {})))
    )
  );
});

// The page sends "SKIP_WAITING" when it is safe to switch to the new version.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Activate: delete old version caches, then take control of open pages.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
//  - Page loads (navigations): network-first, always revalidated with the server
//    (bypasses the ~10-minute browser cache on GitHub Pages) so the newest app shows
//    when online; falls back to the cached copy when offline.
//  - Everything else: cache-first, refreshed in the background.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(new Request(req, { cache: "no-cache" }))
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
