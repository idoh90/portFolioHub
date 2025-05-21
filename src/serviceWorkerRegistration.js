// This optional code is used to register a service worker.
// register() is not called by default.

// This lets the app load faster on subsequent visits in production, and gives
// it offline capabilities. However, it also means that developers (and users)
// will only see deployed updates on subsequent visits to a page, after all the
// existing tabs open on the page have been closed, since previously cached
// resources are updated in the background.

const SERVICE_WORKER_VERSION = '1.0.1'; // Increment this when you update the service worker
const DEBUG = true; // Set to true to enable detailed logging

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    // [::1] is the IPv6 localhost address.
    window.location.hostname === '[::1]' ||
    // 127.0.0.0/8 are considered localhost for IPv4.
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

// Check if device is iOS - special handling needed
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

function log(...args) {
  if (DEBUG) {
    console.log('[SW Registration]', ...args);
  }
}

export function register(config) {
  log('Starting service worker registration. Version:', SERVICE_WORKER_VERSION);
  log('Device detection - iOS:', isIOS);
  
  if ('serviceWorker' in navigator) {
    // The URL constructor is available in all browsers that support SW.
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      // Our service worker won't work if PUBLIC_URL is on a different origin
      // from what our page is served on. This might happen if a CDN is used to
      // serve assets; see https://github.com/facebook/create-react-app/issues/2374
      log('Different origin detected - service worker will not be registered');
      return;
    }

    window.addEventListener('load', () => {
      // Add a version query parameter to force service worker update
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js?v=${SERVICE_WORKER_VERSION}`;
      log('Service worker URL with version:', swUrl);

      if (isLocalhost) {
        // This is running on localhost. Let's check if a service worker still exists or not.
        checkValidServiceWorker(swUrl, config);

        // Add some additional logging to localhost, pointing developers to the
        // service worker/PWA documentation.
        navigator.serviceWorker.ready.then(() => {
          log('Service worker is ready and active');
        });
      } else {
        // Is not localhost. Just register service worker
        registerValidSW(swUrl, config);
      }
    });
  } else {
    log('Service workers are not supported in this browser');
  }
}

function registerValidSW(swUrl, config) {
  log('Registering service worker...');
  
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      log('Service worker registered successfully:', registration);
      
      // iOS requires special handling for service worker updates
      if (isIOS) {
        log('iOS device detected - performing special update handling');
        // Force update for iOS devices
        registration.update();
      }
      
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        
        log('New service worker is installing...');
        
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // At this point, the updated precached content has been fetched,
              // but the previous service worker will still serve the older
              // content until all client tabs are closed.
              log('New content is available and will be used when all tabs for this page are closed');

              // Execute callback
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
              
              // For iOS, we might need to prompt the user to reload
              if (isIOS) {
                log('Prompting iOS user to reload for new content');
                // You could show a user-visible notification here
              }
            } else {
              // At this point, everything has been precached.
              log('Content is cached for offline use');

              // Execute callback
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
      
      // Check if Push API is supported and permission has been granted
      if ('PushManager' in window) {
        log('Push notifications are supported');
        
        if (Notification.permission === 'granted') {
          log('Notification permission already granted, checking subscription status');
          checkPushSubscription(registration);
        } else if (Notification.permission !== 'denied') {
          log('Notification permission not decided yet - will be requested via UI');
          // Don't ask for permission here - let user decide via UI
        } else {
          log('Notification permission denied by user');
        }
      } else {
        log('Push notifications are not supported on this device');
      }
    })
    .catch((error) => {
      console.error('Error during service worker registration:', error);
    });
}

// Function to check if the user is already subscribed to push notifications
function checkPushSubscription(registration) {
  log('Checking push subscription status...');
  
  registration.pushManager.getSubscription()
    .then(subscription => {
      if (subscription) {
        log('User is already subscribed to push notifications', subscription.endpoint);
        // Don't update subscription automatically - we'll do this when user interacts with notification UI
      } else {
        log('User is not subscribed to push notifications');
        // Don't automatically subscribe here - let the user choose from the UI
      }
    })
    .catch(error => {
      console.error('Error checking push subscription:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  log('Checking if service worker is valid...');
  
  // Check if the service worker can be found. If it can't reload the page.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        log('Invalid service worker found, unregistering and reloading');
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found. Proceed as normal.
        log('Valid service worker found, proceeding with registration');
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      log('No internet connection found. App is running in offline mode.');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    log('Unregistering service worker...');
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        log('Service worker unregistered successfully');
      })
      .catch((error) => {
        console.error('Error unregistering service worker:', error.message);
      });
  }
} 