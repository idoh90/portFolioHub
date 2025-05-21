/**
 * Utility to manually test push notification registration
 * This helps debug issues with iOS and other devices
 */

import { urlBase64ToUint8Array } from './notifications';

// Test keys - use the same one from your server
const VAPID_PUBLIC_KEY = 'BMqyrecWOLqb2v-2s2wtuGLIpIdBv4UShX5e1RLQ67H4RL40hCbkojaCNqXkeBuv3D2ag6HyTNwF7DJaFqtqhpU';

// Check if device is iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

export async function testServiceWorkerRegistration() {
  console.log('Testing service worker registration...');
  console.log('Device is iOS:', isIOS);
  
  if (!('serviceWorker' in navigator)) {
    console.error('Service workers not supported');
    return { success: false, error: 'Service workers not supported' };
  }
  
  try {
    console.log('Registering service worker...');
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('Service worker registered:', registration);
    
    console.log('Service worker state:', registration.active ? 'active' : 'not active');
    
    return { success: true, registration };
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return { success: false, error };
  }
}

export async function testPushSubscription() {
  console.log('Testing push subscription...');
  
  if (!('PushManager' in window)) {
    console.error('Push notifications not supported');
    return { success: false, error: 'Push notifications not supported' };
  }
  
  try {
    // Check notification permission
    if (Notification.permission !== 'granted') {
      console.log('Requesting notification permission...');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.error('Notification permission not granted');
        return { success: false, error: 'Notification permission not granted' };
      }
    }
    
    // Get service worker registration
    console.log('Getting service worker registration...');
    const registration = await navigator.serviceWorker.ready;
    
    // Check for existing subscription
    console.log('Checking for existing subscription...');
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('Existing subscription found:', existingSubscription.endpoint);
      return { success: true, subscription: existingSubscription };
    }
    
    // Subscribe to push notifications
    console.log('Creating new subscription...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    
    console.log('Push subscription created:', subscription.endpoint);
    
    // Send test notification
    console.log('Sending subscription to server for testing...');
    const userId = localStorage.getItem('currentUser') || 'anonymous';
    
    const response = await fetch('http://localhost:5000/api/push-subscriptions', {
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
      console.error('Failed to send subscription to server');
      return { success: false, error: 'Failed to send subscription to server' };
    }
    
    console.log('Subscription sent to server successfully');
    
    // Try sending a test notification
    console.log('Requesting test notification...');
    const notifyResponse = await fetch('http://localhost:5000/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        notification: {
          title: 'Test Notification',
          body: 'This is a test notification from the app',
          icon: '/logo192.png',
          badge: 1,
          data: { url: '/hub' },
          aps: {
            alert: {
              title: 'Test Notification',
              body: 'This is a test notification from the app'
            },
            badge: 1,
            'content-available': 1
          }
        }
      }),
    });
    
    if (!notifyResponse.ok) {
      console.error('Failed to send test notification');
      return { success: true, subscription, testFailed: true };
    }
    
    console.log('Test notification sent successfully');
    return { success: true, subscription };
  } catch (error) {
    console.error('Error in push subscription test:', error);
    return { success: false, error };
  }
} 