/* Minimal service worker — required for "Install app" (PWA).
   Pure pass-through: every request goes to the network, nothing is cached,
   so the shop data is always live (no stale pages after deploy). */

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
