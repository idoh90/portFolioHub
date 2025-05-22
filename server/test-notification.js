/**
 * Test script for sending push notifications
 * 
 * Usage examples:
 * 1. Send to specific user:
 *    node test-notification.js send user123
 * 
 * 2. Broadcast to all users:
 *    node test-notification.js broadcast
 * 
 * 3. List all subscriptions:
 *    node test-notification.js list
 */

const pushNotifications = require('./push-notifications');

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0];
const userId = args[1];

// Define test notification payload with iOS compatibility
const testNotification = {
  title: 'Test Notification',
  body: 'This is a test notification from StockHub',
  icon: '/logo192.png',
  badge: 1,
  data: {
    url: '/hub',
    test: true,
    timestamp: new Date().toISOString()
  },
  // iOS specific format
  aps: {
    alert: {
      title: 'Test Notification',
      body: 'This is a test notification from StockHub'
    },
    badge: 1,
    'content-available': 1
  }
};

// Process commands
async function processCommand() {
  console.log('🔔 StockHub Push Notification Test Tool');
  
  switch (command) {
    case 'send':
      if (!userId) {
        console.error('❌ Error: Missing user ID. Usage: node test-notification.js send <userId>');
        process.exit(1);
      }
      
      console.log(`📤 Sending test notification to user: ${userId}`);
      try {
        const result = await pushNotifications.sendNotification(userId, testNotification);
        if (result) {
          console.log(`✅ Notification sent successfully to ${userId}`);
        } else {
          console.log(`❌ Failed to send notification to ${userId}`);
        }
      } catch (error) {
        console.error('❌ Error sending notification:', error);
      }
      break;
      
    case 'broadcast':
      console.log('📢 Broadcasting test notification to all users');
      try {
        const results = await pushNotifications.sendBroadcast(testNotification);
        const successCount = Object.values(results).filter(r => r === 'success').length;
        const failCount = Object.values(results).filter(r => r === 'failed').length;
        
        console.log(`📊 Broadcast results: ${successCount} successful, ${failCount} failed`);
        console.log(results);
      } catch (error) {
        console.error('❌ Error broadcasting notification:', error);
      }
      break;
      
    case 'list':
      console.log('📋 Listing all subscriptions:');
      const subscriptions = pushNotifications.listSubscriptions();
      console.log(`📊 Total subscriptions: ${subscriptions.size}`);
      
      for (const [userId, subscription] of subscriptions.entries()) {
        console.log(`- User: ${userId}`);
        console.log(`  Endpoint: ${subscription.endpoint.substring(0, 50)}...`);
      }
      break;
      
    default:
      console.log('❓ Unknown command. Available commands:');
      console.log('  - send <userId>: Send test notification to a specific user');
      console.log('  - broadcast: Send test notification to all users');
      console.log('  - list: List all subscriptions');
      break;
  }
}

// Run the script
processCommand().then(() => {
  console.log('✨ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
}); 