const CACHE_NAME = "kaner-optik-v6";
const VENDOR_CACHE = "kaner-optik-vendor-v1";
const APP_SHELL = ["./", "./index.html", "./assets/enterprise.css", "./assets/mobile.js", "./assets/firebase-config.js", "./assets/firebase-sync.js", "./manifest.webmanifest"];
// The Firebase SDK is served cross-origin. Without a runtime cache the app cannot
// reach its own lock screen on a cold offline start.
const VENDOR_PREFIX = "https://www.gstatic.com/firebasejs/";

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME && key !== VENDOR_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  if (event.request.url.startsWith(VENDOR_PREFIX)) {
    // Stale-while-revalidate: serve the cached SDK instantly, refresh it in the background.
    event.respondWith(
      caches.open(VENDOR_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          const network = fetch(event.request)
            .then(response => {
              if (response && response.ok) cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
  );
});
