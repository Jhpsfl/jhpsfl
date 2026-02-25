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

// Handle push notifications
self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'JHPS', {
      body: data.body || '',
      icon: '/favicon-192.png',
      badge: '/favicon-32.png',
      data: { url: data.url || '/admin' },
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
