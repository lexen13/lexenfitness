// ═══════════════════════════════════════════
//  LEXENFITNESS — Service Worker
// ═══════════════════════════════════════════
const CACHE_NAME = 'lexen-v1.5.0';
const STATIC_ASSETS = [
  '/lexenfitness/',
  '/lexenfitness/index.html',
  '/lexenfitness/style.css',
  '/lexenfitness/data.js',
  '/lexenfitness/app.js',
  '/lexenfitness/nutrition.js',
  '/lexenfitness/chat.js',
  '/lexenfitness/manifest.json',
  '/lexenfitness/icons/icon-192x192.png',
  '/lexenfitness/icons/icon-192x192-maskable.png',
  '/lexenfitness/icons/icon-512x512.png',
  '/lexenfitness/icons/icon-512x512-maskable.png'
];

// Install — cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first for API/Firebase, cache first for static assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go network for Firebase, APIs, auth
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('openfoodfacts.org') ||
    url.hostname.includes('unpkg.com')
  ) {
    return; // Let browser handle normally
  }

  // Static assets — cache first, fallback to network
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(response => {
        // Update cache with fresh copy
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached); // Offline fallback to cache

      return cached || fetched;
    })
  );
});
