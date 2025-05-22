// VAPID keys - in production, these should be environment variables
// You'll need to generate actual VAPID keys using the web-push library
// This is a fallback in case the server request fails
const FALLBACK_PUBLIC_VAPID_KEY = 'BMqyrecWOLqb2v-2s2wtuGLIpIdBv4UShX5e1RLQ67H4RL40hCbkojaCNqXkeBuv3D2ag6HyTNwF7DJaFqtqhpU';

// Detect iOS version
export const detectIOSVersion = () => {
  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  
  console.log('[iOS-DEBUG] User Agent:', userAgent);
  console.log('[iOS-DEBUG] Is iOS device:', isIOS);
  
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
  
  console.log('[iOS-DEBUG] Device type:', deviceType);
  
  // Extract iOS version with more detailed parsing
  const match = userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
  if (match) {
    const majorVersion = parseInt(match[1], 10);
    const minorVersion = parseInt(match[2], 10);
    const patchVersion = match[3] ? parseInt(match[3], 10) : 0;
    
    console.log('[iOS-DEBUG] iOS version details:', { major: majorVersion, minor: minorVersion, patch: patchVersion });
    
    // Calculate full version number
    const version = majorVersion + (minorVersion / 10) + (patchVersion / 100);
    
    // Check for notification support
    const supportsNotifications = majorVersion > 16 || 
                                (majorVersion === 16 && minorVersion >= 4);
    
    const isStandalone = window.navigator.standalone || 
                        window.matchMedia('(display-mode: standalone)').matches;
                        
    console.log('[iOS-DEBUG] Supports notifications:', supportsNotifications);
    console.log('[iOS-DEBUG] Is standalone mode:', isStandalone);
    
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
      isStandalone
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
  const standalone = window.navigator.standalone || 
                    window.matchMedia('(display-mode: standalone)').matches;
  console.log('[iOS-DEBUG] Checking standalone mode:', standalone);
  return standalone;
};

// Function to request notification permission
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('[iOS-DEBUG] This browser does not support notifications');
    return false;
  }
  
  // Check iOS version if applicable
  const { isIOS, supportsNotifications, isStandalone, versionDetails } = detectIOSVersion();
  console.log('[iOS-DEBUG] Device info:', { isIOS, supportsNotifications, isStandalone, versionDetails });
  
  if (isIOS && !supportsNotifications) {
    console.log('[iOS-DEBUG] iOS version does not support notifications');
    return false;
  }
  
  // Check if app is in standalone mode for iOS
  if (isIOS && !isInStandaloneMode()) {
    console.log('[iOS-DEBUG] iOS app must be installed to home screen for notifications');
    return false;
  }
  
  try {
    console.log('[iOS-DEBUG] Requesting notification permission...');
    const permission = await Notification.requestPermission();
    console.log('[iOS-DEBUG] Permission result:', permission);
    return permission === 'granted';
  } catch (error) {
    console.error('[iOS-DEBUG] Error requesting notification permission:', error);
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
    // Determine API URL based on environment
    const API_URL = process.env.NODE_ENV === 'production' 
      ? 'https://your-vercel-app.vercel.app' // REPLACE WITH YOUR ACTUAL VERCEL URL AFTER DEPLOYMENT
      : 'http://localhost:5000';
      
    const apiUrl = `${API_URL}/api/vapid-public-key`;
    console.log(`[iOS-DEBUG] Fetching VAPID key from: ${apiUrl}`);
    
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
    console.log('[iOS-DEBUG] Push notifications not supported');
    return null;
  }

  // Check iOS-specific requirements
  const { isIOS, supportsNotifications, isStandalone } = detectIOSVersion();
  console.log('[iOS-DEBUG] Checking subscription requirements:', { isIOS, supportsNotifications, isStandalone });
  
  if (isIOS) {
    if (!supportsNotifications) {
      console.log('[iOS-DEBUG] iOS version does not support web push notifications');
      return null;
    }
    
    if (!isStandalone) {
      console.log('[iOS-DEBUG] iOS app must be installed to home screen for notifications');
      return null;
    }
  }

  try {
    // Get the service worker registration
    console.log('[iOS-DEBUG] Getting service worker registration...');
    const registration = await navigator.serviceWorker.ready;
    console.log('[iOS-DEBUG] Service worker state:', registration.active ? 'active' : 'not active');
    
    // Get VAPID public key
    console.log('[iOS-DEBUG] Fetching VAPID public key...');
    const vapidPublicKey = await getVapidPublicKey();
    
    // Subscribe to push notifications
    console.log('[iOS-DEBUG] Subscribing to push notifications...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    
    console.log('[iOS-DEBUG] Push notification subscription:', subscription);
    console.log('[iOS-DEBUG] Subscription endpoint:', subscription.endpoint);
    
    return subscription;
  } catch (error) {
    console.error('[iOS-DEBUG] Failed to subscribe to push notifications:', error);
    return null;
  }
};

// Send subscription to server
export const sendSubscriptionToServer = async (subscription) => {
  try {
    // Get current user from local storage or auth context
    const currentUser = localStorage.getItem('currentUser');
    const userId = currentUser || 'anonymous';
    
    console.log('[iOS-DEBUG] Sending subscription to server for user:', userId);
    
    // Determine API URL based on environment
    const API_URL = process.env.NODE_ENV === 'production' 
      ? 'https://your-vercel-app.vercel.app' // REPLACE WITH YOUR ACTUAL VERCEL URL AFTER DEPLOYMENT
      : 'http://localhost:5000';
      
    const apiUrl = `${API_URL}/api/push-subscriptions`;
    console.log('[iOS-DEBUG] Sending to API URL:', apiUrl);
    
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
      const error = await response.text();
      console.error('[iOS-DEBUG] Failed to save subscription:', response.status, error);
      throw new Error('Failed to save subscription on server');
    }
    
    console.log('[iOS-DEBUG] Subscription saved successfully');
    return true;
  } catch (error) {
    console.error('[iOS-DEBUG] Error saving subscription:', error);
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