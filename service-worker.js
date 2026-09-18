// Service worker: cache the app shell so the app opens instantly / offline.
// S3 (amazonaws.com) requests always go to the network — never cached.
const CACHE = "s3mgr-v3";
const SHELL = [
  "index.html",
  "styles.css",
  "app.js",
  "aws-s3.js",
  "config.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Only handle our own app files; let S3/API calls pass straight through.
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached ||
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
