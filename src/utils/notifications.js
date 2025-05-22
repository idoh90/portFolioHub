// VAPID keys - in production, these should be environment variables
// You'll need to generate actual VAPID keys using the web-push library
// This is a fallback in case the server request fails
const FALLBACK_PUBLIC_VAPID_KEY = 'BMqyrecWOLqb2v-2s2wtuGLIpIdBv4UShX5e1RLQ67H4RL40hCbkojaCNqXkeBuv3D2ag6HyTNwF7DJaFqtqhpU';

// Detect iOS version
export const detectIOSVersion = () => {
  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  
  if (!isIOS) return { 
    isIOS: false, 
    version: null,
    deviceType: null,
    supportsNotifications: false
  };
  
  // Determine device type
  const deviceType = /iPad/.test(userAgent) ? 'iPad' : 
                    /iPhone/.test(userAgent) ? 'iPhone' : 
                    /iPod/.test(userAgent) ? 'iPod' : null;
  
  // Extract iOS version with more detailed parsing
  const match = userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
  if (match) {
    const majorVersion = parseInt(match[1], 10);
    const minorVersion = parseInt(match[2], 10);
    const patchVersion = match[3] ? parseInt(match[3], 10) : 0;
    
    // Calculate full version number
    const version = majorVersion + (minorVersion / 10) + (patchVersion / 100);
    
    // Check for notification support
    // iOS 16.4+ supports web push notifications
    const supportsNotifications = majorVersion > 16 || 
                                (majorVersion === 16 && minorVersion >= 4);
    
    return { 
      isIOS: true,
      version,
      versionDetails: {
        major: majorVersion,
        minor: minorVersion,
        patch: patchVersion
      },
      deviceType,
      supportsNotifications,
      isStandalone: window.navigator.standalone || 
                    window.matchMedia('(display-mode: standalone)').matches
    };
  }
  
  return { 
    isIOS: true, 
    version: null,
    versionDetails: null,
    deviceType,
    supportsNotifications: false,
    isStandalone: window.navigator.standalone || 
                  window.matchMedia('(display-mode: standalone)').matches
  };
};

// Check if the app is running in standalone mode (added to home screen)
export const isInStandaloneMode = () => {
  return window.navigator.standalone || 
         window.matchMedia('(display-mode: standalone)').matches;
};

// Function to request notification permission
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }
  
  // Check iOS version if applicable
  const { isIOS, supportsNotifications } = detectIOSVersion();
  if (isIOS && !supportsNotifications) {
    console.log('iOS version does not support notifications');
    return false;
  }
  
  // Check if app is in standalone mode for iOS
  if (isIOS && !isInStandaloneMode()) {
    console.log('iOS app must be installed to home screen for notifications');
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

// Convert URL base64 to Uint8Array for the applicationServerKey
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Fetch VAPID public key from server
export const getVapidPublicKey = async () => {
  try {
    // In development, the server might be on a different port
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? '/api/vapid-public-key'
      : 'http://localhost:5000/api/vapid-public-key';
      
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch VAPID key');
    }
    
    const data = await response.json();
    return data.publicKey;
  } catch (error) {
    console.error('Error fetching VAPID public key:', error);
    // Return fallback key if server request fails
    return FALLBACK_PUBLIC_VAPID_KEY;
  }
};

// Subscribe to push notifications
export const subscribeToPushNotifications = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported');
    return null;
  }

  // Check iOS-specific requirements
  const { isIOS, supportsNotifications } = detectIOSVersion();
  if (isIOS) {
    if (!supportsNotifications) {
      console.log('iOS version does not support web push notifications');
      return null;
    }
    
    if (!isInStandaloneMode()) {
      console.log('iOS app must be installed to home screen for notifications');
      return null;
    }
  }

  try {
    // Get the service worker registration
    const registration = await navigator.serviceWorker.ready;
    
    // Get VAPID public key
    const vapidPublicKey = await getVapidPublicKey();
    
    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    
    console.log('Push notification subscription:', subscription);
    
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
};

// Send subscription to server
export const sendSubscriptionToServer = async (subscription) => {
  try {
    // Get current user from local storage or auth context
    const currentUser = localStorage.getItem('currentUser');
    const userId = currentUser || 'anonymous';
    
    console.log('Sending subscription to server for user:', userId);
    
    // Replace with your actual API endpoint
    const apiUrl = process.env.NODE_ENV === 'production'
      ? '/api/push-subscriptions'
      : 'http://localhost:5000/api/push-subscriptions';
      
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        subscription
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save subscription on server');
    }
    
    console.log('Subscription saved on server');
    return true;
  } catch (error) {
    console.error('Error saving subscription:', error);
    return false;
  }
};

// Initialize notifications system
export const initializeNotifications = async () => {
  const permissionGranted = await requestNotificationPermission();
  
  if (permissionGranted) {
    const subscription = await subscribeToPushNotifications();
    if (subscription) {
      await sendSubscriptionToServer(subscription);
      return true;
    }
  }
  
  return false;
}; 