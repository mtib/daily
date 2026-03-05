// CACHE_VERSION is replaced at build time with a timestamp.
// In dev it stays as the literal string, which is fine.
const CACHE_NAME = "daily-__CACHE_VERSION__";

self.addEventListener("install", (event) => {
  // Don't pre-cache anything — let fetch handlers populate the cache lazily.
  // skipWaiting ensures this SW activates immediately instead of waiting for
  // all existing tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Delete every cache whose name differs from the current version.
  // This runs synchronously after skipWaiting(), before any fetch events.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Pass API and WebSocket straight through — never cache.
  if (url.pathname.startsWith("/api/") || url.pathname === "/ws") {
    event.respondWith(fetch(event.request));
    return;
  }

  // Content-hashed assets (/assets/…) → cache-first.
  // These filenames change whenever the content changes, so a cache hit is
  // always fresh. If not cached yet, fetch and store.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Everything else (HTML, manifest, icons) → network-first.
  // Try the network; on failure serve a cached copy (offline fallback).
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
