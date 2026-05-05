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
  const isHTML = e.request.destination === 'document' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/') ||
                 url.pathname === '/';

  if (isHTML) {
    // Always fetch fresh HTML from network (so GitHub updates load immediately)
    // Fall back to cache only when offline
    e.respondWith(
      fetch(e.request).then(function(res) {
        var clone = res.clone();
        return caches.open(CACHE_VERSION).then(function(cache) { 
          cache.put(e.request, clone);
          return res;
        });
      }).catch(function() {
        return caches.match(e.request).then(function(c) {
          return c || caches.match('./index.html');
        });
      })
    );
  } else {
    // Cache-first for static assets
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(res) {
          caches.open(CACHE_VERSION).then(function(cache) { cache.put(e.request, res.clone()); });
          return res;
        });
      })
    );
  }
});
