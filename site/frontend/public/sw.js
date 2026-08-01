/* Service worker FitGather — Web Push + auth strictement network-only */
const SW_CACHE_VERSION = 'fitgather-v3-auth-network-only';
const AUTH_NETWORK_ONLY_PREFIX = '/api/auth/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('fitgather-') && key !== SW_CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith(AUTH_NETWORK_ONLY_PREFIX)) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'FitGather';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    tag: data.tag || 'FitGather',
    renotify: Boolean(data.tag),
    data: {
      url: data.url || '/app',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/app';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          if (client.navigate) {
            return client.navigate(targetUrl);
          }
          return clients.openWindow(targetUrl);
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
