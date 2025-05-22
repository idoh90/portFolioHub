/**
 * This is a sample server-side module for sending push notifications
 * You'll need to integrate this into your backend server
 */

const webpush = require('web-push');
require('dotenv').config();

// VAPID keys from environment variables
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BMqyrecWOLqb2v-2s2wtuGLIpIdBv4UShX5e1RLQ67H4RL40hCbkojaCNqXkeBuv3D2ag6HyTNwF7DJaFqtqhpU',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'mulT31fALunp8blgwmE5XJ74Od7_DswHg8j9r9hKNYE'
};

// Configure web-push with VAPID details
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_CONTACT_EMAIL || 'your-email@example.com'}`,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Store user subscriptions in memory (in production, use a database)
const subscriptions = new Map();

/**
 * Save a new push subscription
 * @param {string} userId - User identifier
 * @param {Object} subscription - PushSubscription object from browser
 */
const saveSubscription = (userId, subscription) => {
  // Check if subscription has endpoint and keys
  if (!subscription.endpoint) {
    console.error(`Missing endpoint in subscription for ${userId}`);
    return false;
  }
  
  if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
    console.error(`Missing keys in subscription for ${userId}`);
    return false;
  }
  
  // Check if it's an iOS subscription
  const isIOS = subscription.endpoint.includes('safari.push.apple.com');
  
  subscriptions.set(userId, subscription);
  return true;
};

/**
 * Remove a push subscription
 * @param {string} userId - User identifier
 */
const removeSubscription = (userId) => {
  const removed = subscriptions.delete(userId);
  return removed;
};

/**
 * Send a push notification to a specific user
 * @param {string} userId - User identifier
 * @param {Object} payload - Notification payload
 */
const sendNotification = async (userId, payload) => {
  const subscription = subscriptions.get(userId);
  
  if (!subscription) {
    return false;
  }
  
  try {
    // Prepare proper payload format for iOS compatibility
    let pushPayload = { ...payload }; // Clone to avoid modifying original
    
    // Check if it's an iOS subscription
    const isIOS = subscription.endpoint.includes('safari.push.apple.com');
    
    // For Safari/iOS web push, we need a very specific payload format
    if (isIOS) {
      // Ensure the aps structure is properly formatted - this is critical for iOS
      if (!pushPayload.aps) {
        pushPayload.aps = {
          alert: {
            title: pushPayload.title || 'StockHub',
            body: pushPayload.body || ''
          },
          badge: pushPayload.badge || 1,
          'content-available': 1,
          sound: 'default'
        };
      }
    }
    
    // Convert to string for webpush
    const pushPayloadString = JSON.stringify(pushPayload);
    
    const result = await webpush.sendNotification(
      subscription,
      pushPayloadString,
      {
        // Add TTL for iOS
        TTL: isIOS ? 86400 : undefined, // 24 hours for iOS
        urgency: 'high',
        topic: isIOS ? 'stockhub' : undefined // Required for iOS
      }
    );
    
    return true;
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error.message);
    
    // If subscription is expired or invalid, remove it
    if (error.statusCode === 410) {
      removeSubscription(userId);
    }
    
    return false;
  }
};

/**
 * Send a broadcast notification to all subscribed users
 * @param {Object} payload - Notification payload
 */
const sendBroadcast = async (payload) => {
  if (subscriptions.size === 0) {
    return {};
  }
  
  const results = {};
  
  for (const [userId, subscription] of subscriptions.entries()) {
    try {
      // Prepare proper payload format for iOS compatibility
      let pushPayload = { ...payload }; // Clone to avoid modifying original
      
      // For Safari/iOS web push, we need a very specific payload format
      // Ensure the aps structure is properly formatted - this is critical for iOS
      if (!pushPayload.aps) {
        pushPayload.aps = {
          alert: {
            title: pushPayload.title || 'StockHub',
            body: pushPayload.body || ''
          },
          badge: pushPayload.badge || 1,
          'content-available': 1
        };
      }
      
      // Convert to string for webpush
      const pushPayloadString = JSON.stringify(pushPayload);
      
      const result = await webpush.sendNotification(
        subscription,
        pushPayloadString
      );
      
      results[userId] = 'success';
    } catch (error) {
      results[userId] = 'failed';
      console.error(`Error broadcasting to user ${userId}:`, error.message);
      
      // If subscription is expired or invalid, remove it
      if (error.statusCode === 410) {
        removeSubscription(userId);
      }
    }
  }
  
  return results;
};

/**
 * Example notification payloads
 */
const notificationExamples = {
  // Basic notification
  basic: {
    title: 'StockHub Update',
    body: 'You have a new notification',
    icon: '/logo192.png'
  },
  
  // Stock price alert
  priceAlert: {
    title: 'Price Alert',
    body: 'AAPL has reached your target price of $150',
    icon: '/logo192.png',
    data: {
      url: '/mystocks',
      ticker: 'AAPL',
      price: 150
    }
  },
  
  // Friend activity notification
  friendActivity: {
    title: 'Friend Activity',
    body: 'John just bought 10 shares of TSLA',
    icon: '/logo192.png',
    data: {
      url: '/hub',
      activity: {
        user: 'John',
        action: 'bought',
        ticker: 'TSLA',
        shares: 10
      }
    }
  }
};

/**
 * Get the current number of subscriptions
 * @returns {number} The number of active subscriptions
 */
const getSubscriptionsCount = () => {
  return subscriptions.size;
};

module.exports = {
  saveSubscription,
  removeSubscription,
  sendNotification,
  sendBroadcast,
  notificationExamples,
  vapidPublicKey: vapidKeys.publicKey,
  getSubscriptionsCount,
  // Add a method to get all subscriptions for testing
  listSubscriptions: () => subscriptions
}; 