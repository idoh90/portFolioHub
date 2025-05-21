/**
 * Test script to check if notifications are working properly
 * Run with: node test-notifications.js
 */

const pushNotifications = require('./push-notifications');

// Sample notification data
const notificationData = {
  title: 'StockHub Test Notification',
  body: 'This is a test notification from StockHub',
  icon: '/logo192.png',
  data: {
    url: '/hub',
    activity: {
      user: 'TestUser',
      action: 'bought',
      ticker: 'AAPL',
      type: 'stock',
      amount: 1000
    }
  },
  // iOS specific format
  aps: {
    alert: {
      title: 'StockHub Test Notification',
      body: 'This is a test notification from StockHub'
    },
    badge: 1,
    'content-available': 1
  }
};

// Function to broadcast a test notification
async function broadcastTestNotification() {
  console.log('Sending test broadcast notification...');
  
  // List all current subscriptions
  console.log('Current subscriptions:');
  let subscriptionCount = 0;
  pushNotifications.listSubscriptions().forEach((subscription, userId) => {
    subscriptionCount++;
    console.log(`- User: ${userId}`);
  });
  
  console.log(`Total subscriptions: ${subscriptionCount}`);
  
  if (subscriptionCount === 0) {
    console.log('No subscriptions found. Please subscribe a device first.');
    return;
  }
  
  try {
    const results = await pushNotifications.sendBroadcast(notificationData);
    console.log('Broadcast results:', results);
  } catch (error) {
    console.error('Error broadcasting notification:', error);
  }
}

// Run the test
broadcastTestNotification(); 