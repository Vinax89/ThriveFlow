// Minimal app-shell cache with network-first for pages, cache-first for static.
const VERSION = 'v1';
const APP_SHELL = ['/', '/manifest.json'];
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGE_CACHE].includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only same-origin
  if (url.origin !== self.location.origin) return;

  // Static assets: cache-first
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/public/')) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const fresh = await fetch(e.request);
        cache.put(e.request, fresh.clone());
        return fresh;
      })
    );
    return;
  }

  // Pages: network-first with fallback
  e.respondWith(
    fetch(e.request)
      .then(async (res) => {
        const cache = await caches.open(PAGE_CACHE);
        cache.put(e.request, res.clone());
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
