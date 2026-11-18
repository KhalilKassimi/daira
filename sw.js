/* Daira — service worker: offline shell for iPhone / Android PWA */
'use strict';

const CACHE = 'daira-v22';
const PRECACHE = [
  './',
  './index.html',
  './styles.css?v=22',
  './domain.js?v=22',
  './seed.js?v=22',
  './i18n.js?v=22',
  './app.js?v=22',
  './qrcode.min.js?v=22',
  './html2pdf.bundle.min.js?v=22',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './hero.jpg',
  './argan-nuts.jpg',
  './coop-women.jpg',
  './olive-oil.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.ok && (url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|svg|woff2?|webmanifest)$/) || url.search.includes('v=22'))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
