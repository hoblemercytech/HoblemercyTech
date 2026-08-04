const CACHE_NAME = "hoblemercy-shell-v1";
const SHELL_ASSETS = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
  // Never cache/interfere with Supabase API calls or any cross-origin
  // request (Resend, Edge Functions, fonts CDN, icon CDN) — those must
  // always hit the network fresh.
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // App-shell: cache-first, falling back to network, so the page still
  // opens (and can show a friendly offline state) without a connection.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() => caches.match("./index.html"))
      );
    })
  );
});