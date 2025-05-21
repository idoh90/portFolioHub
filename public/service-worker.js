// This is the service worker with the Cache-first network strategy

const CACHE = "stockhub-v1";
const precacheFiles = [
  '/',
  '/index.html',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/static/js/vendors~main.chunk.js',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Install event
self.addEventListener("install", function (event) {
  console.log("[StockHub Service Worker] Install Event");
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      console.log("[StockHub Service Worker] Caching app shell and content");
      return cache.addAll(precacheFiles);
    })
  );
});

// Activate event
self.addEventListener("activate", function (event) {
  console.log("[StockHub Service Worker] Activate Event");
  event.waitUntil(
    caches.keys().then(function(keyList) {
      return Promise.all(keyList.map(function(key) {
        if (key !== CACHE) {
          console.log("[StockHub Service Worker] Removing old cache", key);
          return caches.delete(key);
        }
      }));
    })
  );
  // Claim the client to enable updates without refresh
  return self.clients.claim();
});

// Fetch event
self.addEventListener("fetch", function (event) {
  console.log("[StockHub Service Worker] Fetch event", event.request.url);
  
  // Cache first strategy
  event.respondWith(
    caches.match(event.request).then(function (response) {
      if (response) {
        console.log("[StockHub Service Worker] Found in cache", event.request.url);
        return response;
      }
      
      // Not in cache, fetch from network
      return fetch(event.request)
        .then(function (networkResponse) {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          
          // Cache the fetched resource
          let responseToCache = networkResponse.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, responseToCache);
          });
          
          return networkResponse;
        })
        .catch(function (error) {
          console.log("[StockHub Service Worker] Fetch failed:", error);
          // Can return a custom offline page here
          return caches.match('/index.html');
        });
    })
  );
}); 