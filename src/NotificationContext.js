import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { db } from './firebase';
import { ref, set, get } from 'firebase/database';

export const NotificationContext = createContext(null);

// Determine API URL based on environment
// In production, this will be your Vercel deployment URL
// In development, this will be your local server
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://port-folio-57bpr6zcb-idoh90s-projects.vercel.app';

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

  // Send a notification to server for broadcasting and to Telegram bot
  const sendTradeNotification = async (actionType, ticker, amount, type = 'stock') => {
    if (!user) return;
    
    try {
      // Only send notification if user has them enabled
      if (!notificationsEnabled) {
        return;
      }
      
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
      
      // Use the API URL from our constant
      const apiUrl = `${API_URL}/api/broadcast-notification`;
        
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
      
      await response.json();
      
      // Send notification to Telegram bot
      try {
        const telegramUrl = 'https://api.telegram.org/bot7749002252:AAE82IOaGUVDaPJjo-dajHlDaE8mq59pOuw/sendMessage';
        const action = actionType === 'buy' ? 'bought' : 'sold';
        const formattedAmount = new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD',
          maximumFractionDigits: 2
        }).format(amount);
        
        // Create Telegram message payload
        const telegramPayload = {
          chat_id: "4682068246",
          text: `${user} just ${action} ${ticker} for ${formattedAmount}!`
        };
        
        const telegramResponse = await fetch(telegramUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(telegramPayload)
        });
        
        if (!telegramResponse.ok) {
          const telegramErrorData = await telegramResponse.text();
          console.error("Failed to send notification to Telegram:", telegramResponse.status, telegramErrorData);
        }
      } catch (telegramError) {
        console.error('Error sending notification to Telegram:', telegramError);
        // Don't throw here to avoid preventing other functionality if Telegram fails
      }
      
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