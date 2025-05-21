/**
 * This is a sample server-side module for sending push notifications
 * You'll need to integrate this into your backend server
 */

const webpush = require('web-push');

// VAPID keys should be generated only once and stored securely
// Generate using: npx web-push generate-vapid-keys
const vapidKeys = {
  publicKey: 'BMqyrecWOLqb2v-2s2wtuGLIpIdBv4UShX5e1RLQ67H4RL40hCbkojaCNqXkeBuv3D2ag6HyTNwF7DJaFqtqhpU',
  privateKey: 'mulT31fALunp8blgwmE5XJ74Od7_DswHg8j9r9hKNYE'
};

// Configure web-push with VAPID details
webpush.setVapidDetails(
  'mailto:your-email@example.com', // Change to your contact email
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
  subscriptions.set(userId, subscription);
  console.log(`Saved subscription for user ${userId}`);
  return true;
};

/**
 * Remove a push subscription
 * @param {string} userId - User identifier
 */
const removeSubscription = (userId) => {
  const removed = subscriptions.delete(userId);
  if (removed) {
    console.log(`Removed subscription for user ${userId}`);
  }
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
    console.log(`No subscription found for user ${userId}`);
    return false;
  }
  
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
    console.log(`Notification sent to user ${userId}`);
    return true;
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
    
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
  const results = {};
  
  for (const [userId, subscription] of subscriptions.entries()) {
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify(payload)
      );
      results[userId] = 'success';
    } catch (error) {
      results[userId] = 'failed';
      console.error(`Error sending broadcast to user ${userId}:`, error);
      
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

module.exports = {
  saveSubscription,
  removeSubscription,
  sendNotification,
  sendBroadcast,
  notificationExamples,
  vapidPublicKey: vapidKeys.publicKey
}; 