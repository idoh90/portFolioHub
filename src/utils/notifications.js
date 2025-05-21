// VAPID keys - in production, these should be environment variables
// You'll need to generate actual VAPID keys using the web-push library
// This is a fallback in case the server request fails
const FALLBACK_PUBLIC_VAPID_KEY = 'BMqyrecWOLqb2v-2s2wtuGLIpIdBv4UShX5e1RLQ67H4RL40hCbkojaCNqXkeBuv3D2ag6HyTNwF7DJaFqtqhpU';

// Function to request notification permission
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
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
function urlBase64ToUint8Array(base64String) {
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
    // Get current user from local storage or context
    // For this example, we'll use a hardcoded value or get from localStorage
    const userId = localStorage.getItem('currentUser') || 'anonymous';
    
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