import React, { useState, useEffect, useContext } from 'react';
import { NotificationContext } from '../NotificationContext';
import { requestNotificationPermission, subscribeToPushNotifications, sendSubscriptionToServer } from '../utils/notifications';

const NotificationButton = () => {
  const { notificationsEnabled, toggleNotifications } = useContext(NotificationContext);
  const [permissionState, setPermissionState] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check permission state on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
      
      // Check if already subscribed
      checkSubscriptionStatus();
    }
  }, []);

  // Check if the user is already subscribed to push notifications
  const checkSubscriptionStatus = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };

  const handleRequestPermission = async () => {
    setIsLoading(true);
    
    try {
      const permissionGranted = await requestNotificationPermission();
      setPermissionState(Notification.permission);
      
      if (permissionGranted && !isSubscribed) {
        await handleSubscribe();
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    
    try {
      const subscription = await subscribeToPushNotifications();
      
      if (subscription) {
        await sendSubscriptionToServer(subscription);
        setIsSubscribed(true);
        
        // Enable notifications in our context
        if (!notificationsEnabled) {
          await toggleNotifications();
        }
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    setIsLoading(true);
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Notify server about unsubscription
        await fetch('/api/push-subscriptions', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscription),
        });
        
        setIsSubscribed(false);
        
        // Disable notifications in our context
        if (notificationsEnabled) {
          await toggleNotifications();
        }
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle notifications state in context
  const handleToggleNotifications = async () => {
    setIsLoading(true);
    try {
      await toggleNotifications();
      setIsLoading(false);
    } catch (error) {
      console.error('Error toggling notifications:', error);
      setIsLoading(false);
    }
  };

  // If notifications are not supported
  if (!('Notification' in window)) {
    return null;
  }

  // If permission granted but needs to toggle enabled/disabled state
  if (isSubscribed) {
    return (
      <button 
        onClick={handleToggleNotifications}
        disabled={isLoading}
        className={`notification-button ${notificationsEnabled ? 'unsubscribe' : 'muted'}`}
      >
        {isLoading ? 'Processing...' : notificationsEnabled ? 'Mute Notifications' : 'Unmute Notifications'}
      </button>
    );
  }

  // If permission denied
  if (permissionState === 'denied') {
    return (
      <div className="notification-info">
        Notifications blocked. Please enable them in your browser settings.
      </div>
    );
  }

  // If permission not granted or default
  return (
    <button 
      onClick={handleRequestPermission}
      disabled={isLoading}
      className="notification-button subscribe"
    >
      {isLoading ? 'Processing...' : 'Enable Notifications'}
    </button>
  );
};

export default NotificationButton; 