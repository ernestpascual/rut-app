// Service Worker for rut PWA - App shell caching only
// Never cache private Firestore data or AI responses
const CACHE_NAME = 'rut-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/assets/images/icon.png',
  '/assets/images/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('Cache pre-fetch failed:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache Firestore API, Cloud Functions, or external AI calls
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('cloudfunctions.net') ||
    url.pathname.includes('/api/')
  ) {
    return;
  }

  // Network first with cache fallback for HTML pages; Cache first for static assets
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/') || caches.match('/offline.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
