// Service Worker for Daily Productivity & Fitness PWA
const CACHE_NAME = 'daily-app-v16';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Img/logo.png',
  '/css/main.css',
  '/css/auth.css',
  '/css/admin-dashboard.css',
  '/css/admin.css',
  '/css/admin.css',
  '/css/English-Flashcards.css',
  '/css/mafia-manager.css',
  '/css/workout-tracker.css',
  '/HTML-Files/auth.html',
  '/HTML-Files/admin-dashboard.html',
  '/HTML-Files/English-Flashcards.html',
  '/HTML-Files/mafia-manager.html',
  '/HTML-Files/rubiks-timer.html',
  '/HTML-Files/workout-tracker.html',
  '/js/supabase.js',
  '/js/header-auth.js',
  '/js/auth-ui.js',
  '/js/admin-dashboard.js',
  '/js/English-Flashcards.js',
  '/js/flashcards.js',
  '/js/mafia-manager.js',
  '/js/workout-tracker.js',
  '/js/admin-dashboard.js',
  '/js/supabase.js',
  '/js/auth.js',
  '/js/admin.js',
  '/js/rubiks-timer.js',
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