// This is the service worker with the Cache-first network strategy

const CACHE = 'stockhub-v1';

// Debug mode
const DEBUG = true;
const log = (...args) => DEBUG && console.log('[SW-DEBUG]', ...args);

log('Service Worker Loaded');

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
self.addEventListener('install', function(event) {
  log('Install Event');
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      log('Caching app shell');
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/logo192.png',
        '/logo512.png',
        '/favicon.ico',
        '/static/js/main.js',
        '/static/css/main.css'
      ]);
    })
  );
  // Force activation
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', function(event) {
  log('Activate Event');
  event.waitUntil(
    caches.keys().then(function(keyList) {
      return Promise.all(keyList.map(function(key) {
        if (key !== CACHE) {
          log('Removing old cache', key);
          return caches.delete(key);
        }
      }));
    }).then(() => {
      log('Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event
self.addEventListener('fetch', function(event) {
  log('Fetch Event', event.request.url);
  event.respondWith(
    caches.match(event.request).then(function(response) {
      if (response) {
        log('Serving from cache', event.request.url);
        return response;
      }
      log('Serving from network', event.request.url);
      return fetch(event.request);
    })
  );
});

// Push event
self.addEventListener('push', function(event) {
  log('Push Event Received');
  
  let notificationData = {};
  
  try {
    if (event.data) {
      notificationData = event.data.json();
      log('Push data:', notificationData);
    } else {
      log('No push data received');
      notificationData = {
        title: 'StockHub Update',
        body: 'You have a new notification'
      };
    }
  } catch (e) {
    log('Error parsing push data:', e);
    notificationData = {
      title: 'StockHub Update',
      body: event.data ? event.data.text() : 'You have a new notification'
    };
  }
  
  // Prepare notification options
  let title = 'StockHub Update';
  let options = {
    body: 'You have a new notification',
    icon: '/logo192.png',
    badge: '/favicon.ico',
    data: { url: '/' },
    vibrate: [100, 50, 100],
    requireInteraction: true,
    tag: 'stockhub-notification',
    silent: false,
    renotify: true
  };
  
  // Handle iOS-specific format first
  if (notificationData.aps && notificationData.aps.alert) {
    log('Processing iOS APS format');
    
    const aps = notificationData.aps;
    
    if (typeof aps.alert === 'string') {
      title = 'StockHub Update';
      options.body = aps.alert;
    } else if (typeof aps.alert === 'object') {
      title = aps.alert.title || 'StockHub Update';
      options.body = aps.alert.body || 'You have a new notification';
    }
    
    // Set badge if provided
    if (aps.badge) {
      options.badge = '/favicon.ico';
    }
    
    // Merge additional data
    if (notificationData.data) {
      options.data = notificationData.data;
    }
    
    // Override with any direct notification properties
    if (notificationData.icon) {
      options.icon = notificationData.icon;
    }
  }
  // Handle standard web push format
  else {
    log('Processing standard web push format');
    
    if (notificationData.title) {
      title = notificationData.title;
    }
    
    if (notificationData.body) {
      options.body = notificationData.body;
    }
    
    if (notificationData.icon) {
      options.icon = notificationData.icon;
    }
    
    if (notificationData.data) {
      options.data = notificationData.data;
    }
    
    if (notificationData.badge) {
      options.badge = notificationData.badge;
    }
    
    if (notificationData.actions) {
      options.actions = notificationData.actions;
    }
  }
  
  log('Final notification:', { title, options });
  
  // Show the notification
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => log('Notification shown successfully'))
      .catch(error => {
        log('Error showing notification:', error);
        // Fallback: try with minimal options
        return self.registration.showNotification(title, {
          body: options.body,
          icon: '/logo192.png'
        });
      })
  );
});

// Notification click event
self.addEventListener('notificationclick', function(event) {
  log('Notification Click Event');
  
  // Close the notification
  event.notification.close();
  
  // Get the URL to open from notification data
  const urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  log('Opening URL:', urlToOpen);
  
  // Handle notification actions if clicked
  if (event.action) {
    log('Action clicked:', event.action);
  }
  
  // Open the window
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      log('Found', clientList.length, 'clients');
      
      // Check if we have a client with the target URL or any client from the same origin
      for (let client of clientList) {
        const clientUrl = new URL(client.url);
        const targetUrl = new URL(urlToOpen, self.location.origin);
        
        // Focus existing client if it's from the same origin
        if (clientUrl.origin === targetUrl.origin && 'focus' in client) {
          log('Focusing existing client and navigating to:', targetUrl.pathname);
          return client.focus().then(() => {
            // Try to navigate to the target URL
            if (client.navigate) {
              return client.navigate(targetUrl.href);
            }
          });
        }
      }
      
      // If no suitable client is found, open a new window
      log('Opening new window for:', urlToOpen);
      const fullUrl = new URL(urlToOpen, self.location.origin).href;
      return clients.openWindow(fullUrl);
    }).catch(error => {
      log('Error handling notification click:', error);
      // Fallback: try to open a new window
      const fullUrl = new URL(urlToOpen, self.location.origin).href;
      return clients.openWindow(fullUrl);
    })
  );
}); 