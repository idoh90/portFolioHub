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
    notificationData = event.data.json();
    log('Push data:', notificationData);
  } catch (e) {
    log('Error parsing push data:', e);
    notificationData = {
      title: 'New Notification',
      body: event.data ? event.data.text() : 'No payload'
    };
  }
  
  // First check for iOS-specific format
  if (notificationData.aps) {
    log('Using iOS format');
    
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
    
    log('Showing iOS notification:', { title, options });
    
    // Show the notification
    event.waitUntil(
      self.registration.showNotification(title, options)
        .then(() => log('Notification shown successfully'))
        .catch(error => log('Error showing notification:', error))
    );
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
    
    log('Showing standard notification:', { title, options });
    
    // Show the notification
    event.waitUntil(
      self.registration.showNotification(title, options)
        .then(() => log('Notification shown successfully'))
        .catch(error => log('Error showing notification:', error))
    );
  }
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
      
      // If we have a client, focus it
      for (let client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          log('Focusing existing client');
          return client.focus();
        }
      }
      
      // If no client is found, open a new window
      log('Opening new window');
      return clients.openWindow(urlToOpen);
    })
  );
}); 