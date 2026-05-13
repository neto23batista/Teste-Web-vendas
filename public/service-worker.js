const CACHE = 'farmavida-v1';
const ASSETS = ['/', '/assets/css/app.css', '/assets/js/app.js', '/assets/icons/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

