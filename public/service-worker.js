// This is the service worker with the Cache-first network strategy

const CACHE = "stockhub-v2";
const precacheFiles = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo.png',
  '/logo192.png',
  '/logo512.png',
  '/static/css/',
  '/static/js/',
  '/static/media/'
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

// Push event handler
self.addEventListener('push', function(event) {
  console.log('[StockHub Service Worker] Push Received:', event);
  console.log('[StockHub Service Worker] Push Data:', event.data ? event.data.text() : 'no data');
  
  let notificationData = {};
  
  try {
    // Parse the data sent from server
    if (event.data) {
      notificationData = event.data.json();
      console.log('[StockHub Service Worker] Push data parsed:', JSON.stringify(notificationData));
    }
  } catch (error) {
    console.error('[StockHub Service Worker] Error parsing push data:', error);
    // Default data if parsing fails
    notificationData = {
      title: 'StockHub Update',
      body: 'You have a new notification',
      icon: '/logo192.png',
      data: {
        url: '/'
      }
    };
  }
  
  // Set defaults for notification properties
  const title = notificationData.title || 'StockHub Update';
  
  // Check for iOS-specific format
  let options = {};
  
  if (notificationData.aps) {
    console.log('[StockHub Service Worker] Using iOS format');
    // Extract iOS format
    const aps = notificationData.aps;
    
    if (aps.alert) {
      options = {
        body: aps.alert.body || 'You have a new notification',
        icon: notificationData.icon || '/logo192.png',
        badge: aps.badge ? `/favicon.ico` : '/favicon.ico',
        data: notificationData.data || { url: '/' },
        // Add vibration pattern for mobile
        vibrate: [100, 50, 100],
        // Make sure notification stays visible on iOS
        requireInteraction: true,
        // Notification actions
        actions: notificationData.actions || []
      };
    }
  } else {
    // Standard format
    options = {
      body: notificationData.body || 'You have a new notification',
      icon: notificationData.icon || '/logo192.png',
      badge: '/favicon.ico',
      data: notificationData.data || { url: '/' },
      // Add vibration pattern for mobile
      vibrate: [100, 50, 100],
      // Make sure notification stays visible on iOS
      requireInteraction: true,
      // Tag to group notifications
      tag: 'stockhub-notification',
      // Notification actions
      actions: notificationData.actions || []
    };
  }
  
  console.log('[StockHub Service Worker] Showing notification:', title, options);
  
  // Show the notification
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('[StockHub Service Worker] Notification displayed successfully');
      })
      .catch(err => {
        console.error('[StockHub Service Worker] Error showing notification:', err);
      })
  );
});

// Notification click event
self.addEventListener('notificationclick', function(event) {
  console.log('[StockHub Service Worker] Notification click:', event);
  
  // Close the notification
  event.notification.close();
  
  // Handle notification click - usually by opening a specific URL
  const urlToOpen = event.notification.data.url || '/';
  
  // Handle notification actions if clicked
  if (event.action) {
    console.log('[StockHub Service Worker] Action clicked:', event.action);
    // You can handle specific actions here
  }
  
  // Open the app or specific page
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then(function(clientList) {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
}); 