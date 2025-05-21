const webpush = require('web-push');
const pushNotifications = require('./push-notifications');

// Configure web-push with VAPID details
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  'BMqyrecWOLqb2v-2s2wtuGLIpIdBv4UShX5e1RLQ67H4RL40hCbkojaCNqXkeBuv3D2ag6HyTNwF7DJaFqtqhpU',
  'mulT31fALunp8blgwmE5XJ74Od7_DswHg8j9r9hKNYE'
);

// Test notification payload
const testNotification = {
  title: 'Test Notification',
  body: 'This is a test notification from StockHub!',
  icon: '/logo192.png',
  data: {
    url: '/',
    timestamp: new Date().toISOString()
  }
};

// Send test notification
async function sendTestNotification() {
  try {
    const results = await pushNotifications.sendBroadcast(testNotification);
    console.log('Notification results:', results);
  } catch (error) {
    console.error('Error sending test notification:', error);
  }
}

sendTestNotification(); 