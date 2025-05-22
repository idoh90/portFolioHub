import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { db } from './firebase';
import { ref, set, get } from 'firebase/database';

export const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Load notification preferences from Firebase
  useEffect(() => {
    if (!user) return;
    
    const loadNotificationPreferences = async () => {
      try {
        const notificationRef = ref(db, `notificationPreferences/${user}`);
        const snapshot = await get(notificationRef);
        
        if (snapshot.exists()) {
          setNotificationsEnabled(snapshot.val().enabled);
        } else {
          // Default to enabled if no preference is set
          await set(notificationRef, { enabled: true });
        }
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      }
    };
    
    loadNotificationPreferences();
  }, [user]);

  // Update notification preferences in Firebase
  const toggleNotifications = async () => {
    if (!user) return;
    
    try {
      const newState = !notificationsEnabled;
      const notificationRef = ref(db, `notificationPreferences/${user}`);
      await set(notificationRef, { enabled: newState });
      setNotificationsEnabled(newState);
      return newState;
    } catch (error) {
      console.error('Error toggling notification preferences:', error);
      return notificationsEnabled;
    }
  };

  // Send a notification to server for broadcasting
  const sendTradeNotification = async (actionType, ticker, amount, type = 'stock') => {
    if (!user) return;
    
    try {
      // Only send notification if user has them enabled
      if (!notificationsEnabled) {
        console.log("Notifications disabled, not sending trade notification");
        return;
      }
      
      console.log(`Preparing to send ${actionType} notification for ${ticker}`);
      
      // Create notification payload
      const notification = {
        title: 'StockHub Trade Alert',
        body: `${user} just ${actionType === 'buy' ? 'bought' : 'sold'} ${ticker} ${type}`,
        icon: '/logo192.png',
        data: {
          url: '/hub',
          activity: {
            user,
            action: actionType === 'buy' ? 'bought' : 'sold',
            ticker,
            type,
            amount
          }
        }
      };
      
      console.log("Notification payload:", notification);
      
      // Determine API URL based on environment
      const isDevelopment = process.env.NODE_ENV === 'development';
      const API_BASE_URL = isDevelopment ? 'http://localhost:5000' : ''; // Adjust port if your server runs elsewhere
      const apiUrl = `${API_BASE_URL}/api/broadcast-notification`;
      
      console.log(`Sending notification to: ${apiUrl}`);
        
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notification
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error("Failed to send notification to server:", response.status, errorData);
        throw new Error('Failed to send notification to server');
      }
      
      const result = await response.json();
      console.log("Notification broadcast response:", result);
      
    } catch (error) {
      console.error('Error sending trade notification:', error);
      // Add a user-facing error message here if needed
    }
  };

  return (
    <NotificationContext.Provider value={{ 
      notificationsEnabled, 
      toggleNotifications,
      sendTradeNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
} 