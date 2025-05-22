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
  
  if (!event.data) {
    console.log('[StockHub Service Worker] No data received');
    return;
  }
  
  let notificationData;
  
  try {
    // Parse the data sent from server
    notificationData = event.data.json();
    console.log('[StockHub Service Worker] Push data parsed:', JSON.stringify(notificationData));
  } catch (error) {
    // If JSON parsing fails, try text
    console.log('[StockHub Service Worker] JSON parse failed, trying text');
    try {
      const textData = event.data.text();
      notificationData = JSON.parse(textData);
      console.log('[StockHub Service Worker] Text data parsed:', JSON.stringify(notificationData));
    } catch (textError) {
      console.error('[StockHub Service Worker] Error parsing push data:', textError);
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
  }
  
  // First check for iOS-specific format
  if (notificationData.aps) {
    console.log('[StockHub Service Worker] Using iOS format');
    
    // Extract iOS format
    const aps = notificationData.aps;
    let title = 'StockHub Update';
    let options = {};
    
    if (aps.alert) {
      // If alert is a string
      if (typeof aps.alert === 'string') {
        title = 'StockHub Update';
        options = {
          body: aps.alert,
          icon: notificationData.icon || '/logo192.png',
          badge: '/favicon.ico',
          data: notificationData.data || { url: '/' }
        };
      } 
      // If alert is an object
      else {
        title = aps.alert.title || 'StockHub Update';
        options = {
          body: aps.alert.body || 'You have a new notification',
          icon: notificationData.icon || '/logo192.png',
          badge: '/favicon.ico',
          data: notificationData.data || { url: '/' }
        };
      }
    }
    
    // Add other options
    options.vibrate = [100, 50, 100];
    options.requireInteraction = true;
    options.tag = 'stockhub-notification';
    options.actions = notificationData.actions || [];
    
    console.log('[StockHub Service Worker] Showing iOS notification:', title, options);
    
    // Show the notification - using simplified promise chain for iOS
    event.waitUntil(self.registration.showNotification(title, options));
  } 
  // Standard format
  else {
    const title = notificationData.title || 'StockHub Update';
    
    const options = {
      body: notificationData.body || 'You have a new notification',
      icon: notificationData.icon || '/logo192.png',
      badge: '/favicon.ico',
      data: notificationData.data || { url: '/' },
      vibrate: [100, 50, 100],
      requireInteraction: true,
      tag: 'stockhub-notification',
      actions: notificationData.actions || []
    };
    
    console.log('[StockHub Service Worker] Showing standard notification:', title, options);
    
    // Show the notification - using simplified promise chain for iOS
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Notification click event
self.addEventListener('notificationclick', function(event) {
  console.log('[StockHub Service Worker] Notification click:', event);
  
  // Close the notification
  event.notification.close();
  
  // Get the URL to open from notification data
  const urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  
  // Handle notification actions if clicked
  if (event.action) {
    console.log('[StockHub Service Worker] Action clicked:', event.action);
    // You can handle specific actions here
  }
  
  // Simplified promise chain for iOS compatibility
  event.waitUntil(clients.openWindow(urlToOpen));
}); 