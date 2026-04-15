// ═══════════════════════════════════════════
//  LEXENFITNESS — Service Worker
//  IMPORTANT: Bump CACHE_NAME with every deploy
// ═══════════════════════════════════════════
const CACHE_NAME = 'lexen-v1.6.0';
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

// Install — cache app shell, immediately take over
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Listen for skip waiting message from app
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Activate — clean ALL old caches, take control of all tabs
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — NETWORK FIRST for app files, cache as fallback (offline only)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip: let Firebase, APIs, CDNs go straight to network
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('openfoodfacts.org') ||
    url.hostname.includes('unpkg.com')
  ) {
    return;
  }

  // Everything else: try network first, fall back to cache if offline
  e.respondWith(
    fetch(e.request).then(response => {
      // Got a fresh response — update cache and serve it
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return response;
    }).catch(() => {
      // Network failed (offline) — serve from cache
      return caches.match(e.request);
    })
  );
});
