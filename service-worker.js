const CACHE_NAME = 'nexus-tilt-poc-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css/tilt.css',
  './js/app.js',
  './js/tilt_protocol.js',
  './js/tilt_ble_bridge.js',
  './js/tilt_engine.js',
  './js/tilt_record_adapter.js',
  './js/tilt_simulator.js',
  './js/tilt_store.js',
  './js/tilt_templates.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (response && response.ok && new URL(event.request.url).origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          throw new Error('Offline resource unavailable');
        });
    })
  );
});
