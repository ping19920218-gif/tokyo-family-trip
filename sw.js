// Service Worker v2 - network-first for HTML, cache-first for static assets
const CACHE = 'tokyo-trip-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' }))))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);
  const isHTML = request.mode === 'navigate'
               || request.destination === 'document'
               || url.pathname === '/'
               || url.pathname.endsWith('/')
               || url.pathname.endsWith('.html');

  if (isHTML) {
    // Network-first: always try fresh HTML; fall back to cache when offline
    e.respondWith(
      fetch(request, { cache: 'no-store' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(request).then(r => r || new Response('offline', { status: 503 })))
    );
  } else {
    // Cache-first for static assets (icons, manifest, etc.)
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
          return res;
        }).catch(() => cached || new Response('offline', { status: 503 }));
      })
    );
  }
});

// Allow page to ask SW to skip waiting
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
