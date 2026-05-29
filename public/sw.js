const CACHE_NAME = 'sira-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Basic strategy: just network for now to ensure app works
  event.respondWith(fetch(event.request));
});
