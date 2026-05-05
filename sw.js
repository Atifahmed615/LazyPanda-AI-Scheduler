// Bump this version ONLY when you want to force-refresh all cached files
const CACHE_VERSION = 'lazy-panda-v4';

// ── INSTALL: cache app shell ─────────────────────────────────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return cache.addAll(['./index.html', './manifest.json', './icon.svg', './css/style.css', './js/app.js']);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: remove old caches only — localStorage is NEVER touched ─────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_VERSION; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH: Network-first for HTML, cache-first for assets ────────────────────
self.addEventListener('fetch', function(e) {
  const url = new URL(e.request.url);

  // Skip non-GET requests
  if (e.request.method !== 'GET') return;

  const isHTML = e.request.destination === 'document' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname === '/' ||
                 url.pathname.endsWith('/');

  // ── HTML → Network First ─────────────────────────────
  if (isHTML) {
    e.respondWith(
      fetch(e.request)
        .then(function(response) {
          const copy = response.clone(); // clone immediately

          caches.open(CACHE_VERSION).then(function(cache) {
            cache.put(e.request, copy);
          });

          return response;
        })
        .catch(function() {
          return caches.match(e.request).then(function(cached) {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // ── ASSETS → Cache First ─────────────────────────────
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;

      return fetch(e.request).then(function(response) {
        // 🚨 IMPORTANT: clone BEFORE anything else touches it
        const copy = response.clone();

        caches.open(CACHE_VERSION).then(function(cache) {
          cache.put(e.request, copy);
        });

        return response;
      });
    })
  );
});
