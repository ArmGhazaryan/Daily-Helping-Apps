// Service Worker for Daily Productivity & Fitness PWA
const CACHE_NAME = 'daily-app-v11';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Img/logo.png',
  '/CSS-Files/main.css',
  '/CSS-Files/auth.css',
  '/CSS-Files/admin-dashboard.css',
  '/CSS-Files/English-Flashcards.css',
  '/CSS-Files/mafia-manager.css',
  '/CSS-Files/workout-tracker.css',
  '/HTML-Files/auth.html',
  '/HTML-Files/admin-dashboard.html',
  '/HTML-Files/English-Flashcards.html',
  '/HTML-Files/mafia-manager.html',
  '/HTML-Files/workout-tracker.html',
  '/Javascript-Files/supabase.js',
  '/Javascript-Files/header-auth.js',
  '/Javascript-Files/auth.js',
  '/Javascript-Files/admin-dashboard.js',
  '/Javascript-Files/English-Flashcards.js',
  '/Javascript-Files/mafia-manager.js',
  '/Javascript-Files/workout-tracker.js',
  '/JS-Files/admin-dashboard.js',
  '/JS-Files/supabase.js'
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch((err) => console.error('SW install failed:', err))
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const networkFetch = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || networkFetch;
      });
    })
  );
});