const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pushNotifications = require('./push-notifications');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

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

// Test route to send a notification to a specific user
app.post('/api/send-notification', (req, res) => {
  try {
    const { userId, notification } = req.body;
    
    if (!userId || !notification) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing userId or notification data' 
      });
    }
    
    // Send notification asynchronously
    pushNotifications.sendNotification(userId, notification)
      .then(success => {
        console.log(`Notification to ${userId} ${success ? 'sent' : 'failed'}`);
      })
      .catch(error => {
        console.error('Error in notification sending:', error);
      });
    
    // Respond immediately since notification sending is async
    return res.status(202).json({ 
      success: true, 
      message: 'Notification queued for delivery' 
    });
  } catch (error) {
    console.error('Error queuing notification:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Broadcast a notification to all subscribed users
app.post('/api/broadcast-notification', (req, res) => {
  try {
    const { notification } = req.body;
    
    if (!notification) {
      console.error('Missing notification data in broadcast request');
      return res.status(400).json({ 
        success: false, 
        message: 'Missing notification data' 
      });
    }
    
    console.log('Received broadcast notification request:', JSON.stringify(notification, null, 2));
    
    // Send notification asynchronously to all users
    pushNotifications.sendBroadcast(notification)
      .then(results => {
        console.log('Broadcast notification results:', results);
      })
      .catch(error => {
        console.error('Error sending broadcast notification:', error);
      });
    
    // Respond immediately since broadcasting is async
    return res.status(202).json({ 
      success: true, 
      message: 'Notification queued for broadcast' 
    });
  } catch (error) {
    console.error('Error queuing broadcast notification:', error);
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 