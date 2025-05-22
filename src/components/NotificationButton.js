import React, { useState, useEffect, useContext } from 'react';
import { NotificationContext } from '../NotificationContext';
import { 
  requestNotificationPermission, 
  subscribeToPushNotifications, 
  sendSubscriptionToServer,
  detectIOSVersion,
  isInStandaloneMode
} from '../utils/notifications';

// iOS install banner component
const IOSInstallBanner = () => {
  return (
    <div style={{
      backgroundColor: '#f8d7da',
      color: '#721c24',
      padding: '10px',
      borderRadius: '5px',
      marginBottom: '15px',
      fontSize: '14px'
    }}>
      <strong>iOS Users:</strong> To receive notifications, please add this app to your home screen.
      <div style={{ marginTop: '5px' }}>
        Tap the share icon <span style={{ fontSize: '18px' }}>⎙</span> and select "Add to Home Screen"
      </div>
    </div>
  );
};

// iOS update banner component
const IOSUpdateBanner = () => {
  return (
    <div style={{
      backgroundColor: '#fff3cd',
      color: '#856404',
      padding: '10px',
      borderRadius: '5px',
      marginBottom: '15px',
      fontSize: '14px'
    }}>
      <strong>Update Required:</strong> Your iOS version doesn't support web notifications.
      <div style={{ marginTop: '5px' }}>
        Please update to iOS 16.4 or later to receive notifications.
      </div>
    </div>
  );
};

const NotificationButton = () => {
  const { notificationsEnabled, toggleNotifications } = useContext(NotificationContext);
  const [permissionState, setPermissionState] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [iosInfo, setIosInfo] = useState({ isIOS: false, supportsNotifications: false });
  const [isStandalone, setIsStandalone] = useState(false);

  // Check permission state on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
      
      // Check if already subscribed
      checkSubscriptionStatus();
      
      // Check iOS specific information
      const iosData = detectIOSVersion();
      setIosInfo(iosData);
      setIsStandalone(isInStandaloneMode());
      
      // If permission is already granted but not subscribed, automatically subscribe
      if (Notification.permission === 'granted') {
        (async () => {
          const isAlreadySubscribed = await checkSubscriptionStatus();
          if (!isAlreadySubscribed) {
            await handleSubscribe();
          }
        })();
      }
    }
  }, []);

  // Check if the user is already subscribed to push notifications
  const checkSubscriptionStatus = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      const isSubscribed = !!subscription;
      setIsSubscribed(isSubscribed);
      return isSubscribed;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  };

  const handleRequestPermission = async () => {
    console.log('NotificationButton: Requesting permission...');
    
    // For iOS, check if it supports notifications and is installed to home screen
    if (iosInfo.isIOS) {
      console.log('NotificationButton: iOS device detected', iosInfo);
      
      if (!iosInfo.supportsNotifications) {
        console.warn('NotificationButton: iOS version does not support notifications');
        alert('Your iOS version does not support web push notifications. Please update to iOS 16.4 or later.');
        return;
      }
      
      if (!isStandalone) {
        console.warn('NotificationButton: App not in standalone mode');
        alert('Please add this app to your home screen to enable notifications.');
        return;
      }
    }
    
    setIsLoading(true);
    
    try {
      console.log('NotificationButton: Requesting notification permission...');
      const permissionGranted = await requestNotificationPermission();
      console.log('NotificationButton: Permission result:', permissionGranted);
      
      setPermissionState(Notification.permission);
      
      if (permissionGranted && !isSubscribed) {
        console.log('NotificationButton: Permission granted, subscribing...');
        await handleSubscribe();
      } else if (!permissionGranted) {
        console.warn('NotificationButton: Permission not granted');
      }
    } catch (error) {
      console.error('NotificationButton: Error requesting permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    console.log('NotificationButton: Starting subscription process...');
    setIsLoading(true);
    
    try {
      console.log('NotificationButton: Calling subscribeToPushNotifications...');
      const subscription = await subscribeToPushNotifications();
      console.log('NotificationButton: Subscription result:', subscription);
      
      if (subscription) {
        console.log('NotificationButton: Sending subscription to server...');
        const serverResult = await sendSubscriptionToServer(subscription);
        console.log('NotificationButton: Server result:', serverResult);
        
        if (serverResult) {
          setIsSubscribed(true);
          console.log('NotificationButton: Subscription successful');
          
          // Enable notifications in our context
          if (!notificationsEnabled) {
            console.log('NotificationButton: Enabling notifications in context...');
            await toggleNotifications();
          }
        } else {
          console.error('NotificationButton: Failed to save subscription to server');
        }
      } else {
        console.error('NotificationButton: Failed to create push subscription');
      }
    } catch (error) {
      console.error('NotificationButton: Error subscribing to push notifications:', error);
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
        
        // Get current user from local storage
        const currentUser = localStorage.getItem('currentUser');
        const userId = currentUser || 'anonymous';
        
        // Determine API URL based on environment
        const API_URL = window.location.hostname === 'localhost' 
          ? 'http://localhost:5000'
          : 'https://port-folio-server.vercel.app';
          
        const apiUrl = `${API_URL}/api/push-subscriptions`;
        
        // Notify server about unsubscription
        await fetch(apiUrl, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
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

  // Render iOS banners when needed
  const renderIOSBanners = () => {
    if (!iosInfo.isIOS) return null;
    
    if (!iosInfo.supportsNotifications) {
      return <IOSUpdateBanner />;
    }
    
    if (!isStandalone) {
      return <IOSInstallBanner />;
    }
    
    return null;
  };

  // If notifications are not supported
  if (!('Notification' in window)) {
    return null;
  }

  // If permission granted but needs to toggle enabled/disabled state
  if (isSubscribed) {
    return (
      <div>
        {renderIOSBanners()}
        <button 
          onClick={handleToggleNotifications}
          disabled={isLoading}
          className={`notification-button ${notificationsEnabled ? 'unsubscribe' : 'muted'}`}
        >
          {isLoading ? 'Processing...' : notificationsEnabled ? 'Mute Notifications' : 'Unmute Notifications'}
        </button>
      </div>
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
    <div>
      {renderIOSBanners()}
      <button 
        onClick={handleRequestPermission}
        disabled={isLoading}
        className="notification-button subscribe"
      >
        {isLoading ? 'Processing...' : 'Enable Notifications'}
      </button>
    </div>
  );
};

export default NotificationButton; 