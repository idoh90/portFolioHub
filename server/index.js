require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pushNotifications = require('./push-notifications');

const app = express();
const PORT = process.env.PORT || 5000;

const https = require('https');

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for testing, adjust for production
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', subscriptions: pushNotifications.getSubscriptionsCount() });
});

// Routes
app.post('/api/push-subscriptions', (req, res) => {
  try {
    const { userId, subscription } = req.body;
    
    if (!userId || !subscription) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing userId or subscription data' 
      });
    }
    
    const success = pushNotifications.saveSubscription(userId, subscription);
    
    if (success) {
      return res.status(201).json({ 
        success: true, 
        message: 'Subscription saved successfully' 
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to save subscription' 
      });
    }
  } catch (error) {
    console.error('Error saving subscription:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

app.delete('/api/push-subscriptions', (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing userId' 
      });
    }
    
    const removed = pushNotifications.removeSubscription(userId);
    
    if (removed) {
      return res.status(200).json({ 
        success: true, 
        message: 'Subscription removed successfully' 
      });
    } else {
      return res.status(404).json({ 
        success: false, 
        message: 'Subscription not found' 
      });
    }
  } catch (error) {
    console.error('Error removing subscription:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Send test notification
app.post('/api/test-notification', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing userId' 
      });
    }
    
    // Send a test notification
    const testNotification = {
      title: 'Test Notification',
      body: 'This is a test notification from StockHub',
      icon: '/logo192.png',
      badge: 1,
      data: { url: '/hub' },
      aps: {
        alert: {
          title: 'Test Notification',
          body: 'This is a test notification from StockHub'
        },
        badge: 1,
        'content-available': 1,
        sound: 'default'
      }
    };
    
    const success = await pushNotifications.sendNotification(userId, testNotification);
    
    if (success) {
      return res.json({ 
        success: true, 
        message: 'Test notification sent successfully' 
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send test notification' 
      });
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Broadcast notification to all users
app.post('/api/broadcast-notification', (req, res) => {
  try {
    const { notification } = req.body;
    
    if (!notification) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing notification data' 
      });
    }
    
    // Send notification asynchronously
    pushNotifications.sendBroadcast(notification)
      .catch(error => {
        console.error('Error in broadcast:', error);
      });
    
    return res.status(202).json({ 
      success: true, 
      message: 'Notification queued for broadcast' 
    });
  } catch (error) {
    console.error('Error in broadcast endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get the VAPID public key
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: pushNotifications.vapidPublicKey });
});

// Get the number of active subscriptions
app.get('/api/push-subscriptions/count', (req, res) => {
  const count = pushNotifications.getSubscriptionsCount();
  res.json({ count });
});

// Send notification to Telegram bot
app.post('/api/send-telegram', async (req, res) => {
  try {
    const { chat_id, message } = req.body;
    
    if (!chat_id || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing chat_id or message'
      });
    }
    
    // Use the provided chat_id or default to environment variable
    const chatId = chat_id || process.env.REACT_APP_TELEGRAM_CHAT_ID;
    
    // Create request payload for Telegram API
    const telegramPayload = JSON.stringify({
      chat_id: chatId,
      text: message
    });
    
    // Log the request
    console.log(`Sending Telegram notification: ${message} to chat ${chatId}`);
    
    // Create promise for https request
    const telegramPromise = new Promise((resolve, reject) => {
      // Configure request options
      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${process.env.REACT_APP_TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': telegramPayload.length
        }
      };
      
      // Make the request
      const req = https.request(options, (resp) => {
        let data = '';
        
        // Collect response data
        resp.on('data', (chunk) => {
          data += chunk;
        });
        
        // Process complete response
        resp.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            if (parsedData.ok) {
              console.log('Telegram notification sent successfully');
              resolve(parsedData);
            } else {
              console.error('Telegram API returned error:', parsedData);
              reject(new Error(`Telegram API error: ${JSON.stringify(parsedData)}`));
            }
          } catch (e) {
            console.error('Error parsing Telegram API response:', e);
            reject(e);
          }
        });
      });
      
      // Handle request errors
      req.on('error', (error) => {
        console.error('Error sending Telegram notification:', error);
        reject(error);
      });
      
      // Send the request
      req.write(telegramPayload);
      req.end();
    });
    
    // Wait for the request to complete
    const result = await telegramPromise;
    
    return res.json({
      success: true,
      message: 'Telegram notification sent successfully',
      result
    });
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send Telegram notification',
      error: error.message
    });
  }
});

// For local development only
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export the app for Vercel
module.exports = app; 