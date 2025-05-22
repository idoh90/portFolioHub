const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pushNotifications = require('./push-notifications');

const app = express();
const PORT = process.env.PORT || 5000;

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
      .then(results => {
        console.log('Broadcast results:', results);
      })
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
  console.log(`[DEBUG] Current subscriptions count: ${count}`);
  res.json({ count });
});

// For local development only
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`VAPID public key: ${pushNotifications.vapidPublicKey}`);
  });
}

// Export the app for Vercel
module.exports = app; 