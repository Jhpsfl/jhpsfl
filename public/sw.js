// JHPS Admin Service Worker
const CACHE = 'jhps-admin-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  // Only intercept same-origin navigation requests
  if (e.request.mode === 'navigate' && e.request.url.includes('/admin')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }
});
