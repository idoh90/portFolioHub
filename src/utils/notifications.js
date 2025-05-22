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
    supportsNotifications: true, // Non-iOS devices typically support notifications
    isStandalone: false
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
    
    // Check for notification support (iOS 16.4+ for web push notifications)
    const supportsNotifications = majorVersion > 16 || 
                                (majorVersion === 16 && minorVersion >= 4);
    
    const isStandalone = window.navigator.standalone || 
                        window.matchMedia('(display-mode: standalone)').matches;
    
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
  
  // Fallback for iOS devices where we can't parse the version
  const isStandalone = window.navigator.standalone || 
                      window.matchMedia('(display-mode: standalone)').matches;
  
  return { 
    isIOS: true, 
    version: null,
    versionDetails: null,
    deviceType,
    supportsNotifications: false, // Conservative approach - assume no support if we can't determine version
    isStandalone
  };
};

// Check if the app is running in standalone mode (added to home screen)
export const isInStandaloneMode = () => {
  const standalone = window.navigator.standalone || 
                    window.matchMedia('(display-mode: standalone)').matches;
  return standalone;
};

// Function to request notification permission
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    return false;
  }
  
  // Check iOS version if applicable
  const { isIOS, supportsNotifications, isStandalone } = detectIOSVersion();
  
  if (isIOS && !supportsNotifications) {
    return false;
  }
  
  // Check if app is in standalone mode for iOS
  if (isIOS && !isInStandaloneMode()) {
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
  console.log('getVapidPublicKey: Starting...');
  
  try {
    // Determine API URL based on environment
    const API_URL = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : 'https://port-folio-server.vercel.app';
      
    const apiUrl = `${API_URL}/api/vapid-public-key`;
    console.log('getVapidPublicKey: API URL:', apiUrl);
    
    console.log('getVapidPublicKey: Fetching VAPID key from server...');
    const response = await fetch(apiUrl);
    
    console.log('getVapidPublicKey: Response status:', response.status);
    console.log('getVapidPublicKey: Response ok:', response.ok);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('getVapidPublicKey: Server response:', data);
    console.log('getVapidPublicKey: Public key length:', data.publicKey ? data.publicKey.length : 'null');
    
    return data.publicKey;
  } catch (error) {
    console.error('getVapidPublicKey: Error fetching VAPID public key:', error);
    console.error('getVapidPublicKey: Using fallback key');
    // Return fallback key if server request fails
    return FALLBACK_PUBLIC_VAPID_KEY;
  }
};

// Subscribe to push notifications
export const subscribeToPushNotifications = async () => {
  console.log('subscribeToPushNotifications: Starting...');
  
  try {
    console.log('subscribeToPushNotifications: Checking browser support...');
    console.log('subscribeToPushNotifications: serviceWorker in navigator:', 'serviceWorker' in navigator);
    console.log('subscribeToPushNotifications: PushManager in window:', 'PushManager' in window);
    
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.error('subscribeToPushNotifications: Service Worker or PushManager not supported');
      return null;
    }

    console.log('subscribeToPushNotifications: Browser support OK, checking device...');
    
    // Check iOS-specific requirements
    const { isIOS, supportsNotifications, isStandalone } = detectIOSVersion();
    console.log('subscribeToPushNotifications: Device info:', { isIOS, supportsNotifications, isStandalone });
    
    if (isIOS) {
      console.log('subscribeToPushNotifications: iOS device detected, checking requirements...');
      
      if (!supportsNotifications) {
        console.error('subscribeToPushNotifications: iOS does not support notifications');
        return null;
      }
      
      if (!isStandalone) {
        console.error('subscribeToPushNotifications: iOS app not in standalone mode');
        return null;
      }
      
      console.log('subscribeToPushNotifications: iOS requirements passed');
    } else {
      console.log('subscribeToPushNotifications: Non-iOS device, proceeding...');
    }

    console.log('subscribeToPushNotifications: Waiting for service worker...');
    // Get the service worker registration
    const registration = await navigator.serviceWorker.ready;
    console.log('subscribeToPushNotifications: Service worker ready:', registration);
    
    console.log('subscribeToPushNotifications: Getting VAPID public key...');
    // Get VAPID public key
    const vapidPublicKey = await getVapidPublicKey();
    console.log('subscribeToPushNotifications: VAPID key received:', vapidPublicKey ? 'Yes' : 'No');
    
    if (!vapidPublicKey) {
      throw new Error('Failed to get VAPID public key');
    }
    
    console.log('subscribeToPushNotifications: Converting VAPID key...');
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    console.log('subscribeToPushNotifications: VAPID key converted, length:', applicationServerKey.length);
    
    console.log('subscribeToPushNotifications: Subscribing to push manager...');
    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });
    
    console.log('subscribeToPushNotifications: Subscription created successfully:', subscription);
    console.log('subscribeToPushNotifications: Endpoint:', subscription.endpoint);
    
    return subscription;
  } catch (error) {
    console.error('subscribeToPushNotifications: Failed to subscribe:', error);
    console.error('subscribeToPushNotifications: Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return null;
  }
};

// Send subscription to server
export const sendSubscriptionToServer = async (subscription) => {
  console.log('sendSubscriptionToServer: Starting...');
  
  try {
    // Get current user from local storage or auth context
    const currentUser = localStorage.getItem('currentUser');
    const userId = currentUser || 'anonymous';
    console.log('sendSubscriptionToServer: User ID:', userId);
    
    // Determine API URL based on environment
    const API_URL = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : 'https://port-folio-server.vercel.app';
      
    const apiUrl = `${API_URL}/api/push-subscriptions`;
    console.log('sendSubscriptionToServer: API URL:', apiUrl);
    
    console.log('sendSubscriptionToServer: Sending request...');
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
    
    console.log('sendSubscriptionToServer: Response status:', response.status);
    console.log('sendSubscriptionToServer: Response ok:', response.ok);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('sendSubscriptionToServer: Server error:', response.status, error);
      throw new Error(`Server responded with ${response.status}: ${error}`);
    }
    
    const result = await response.json();
    console.log('sendSubscriptionToServer: Server response:', result);
    
    return true;
  } catch (error) {
    console.error('sendSubscriptionToServer: Error saving subscription:', error);
    console.error('sendSubscriptionToServer: Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
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