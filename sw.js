const CACHE_NAME = 'lazy-panda-runtime-v5';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/style.css',
  './js/app.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(APP_SHELL);
      })
      .then(function() {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(
          keys
            .filter(function(key) { return key.startsWith('lazy-panda-') && key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isAppShellAsset(url) {
  return (
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp')
  );
}

function networkFirst(request) {
  return fetch(request)
    .then(function(response) {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(request, copy);
        });
      }
      return response;
    })
    .catch(function() {
      return caches.match(request).then(function(cached) {
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(function(cached) {
    const networkFetch = fetch(request)
      .then(function(response) {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, copy);
          });
        }
        return response;
      })
      .catch(function() {
        return cached;
      });

    return cached || networkFetch;
  });
}

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  if (!isSameOrigin(url)) {
    return;
  }

  if (e.request.mode === 'navigate') {
    e.respondWith(networkFirst(e.request));
    return;
  }

  if (isAppShellAsset(url)) {
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }

  e.respondWith(networkFirst(e.request));
});
