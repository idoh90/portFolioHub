import React, { useState } from 'react';
import { testServiceWorkerRegistration, testPushSubscription } from '../utils/test-registration';

const NotificationDebugger = () => {
  const [logs, setLogs] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const addLog = (message, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prevLogs => [...prevLogs, { timestamp, message, isError }]);
  };
  
  const clearLogs = () => {
    setLogs([]);
  };
  
  const runServiceWorkerTest = async () => {
    setIsLoading(true);
    addLog('Testing service worker registration...');
    
    try {
      const result = await testServiceWorkerRegistration();
      if (result.success) {
        addLog('✅ Service worker registered successfully');
      } else {
        addLog(`❌ Service worker registration failed: ${result.error}`, true);
      }
    } catch (error) {
      addLog(`❌ Error testing service worker: ${error.message}`, true);
    }
    
    setIsLoading(false);
  };
  
  const runPushSubscriptionTest = async () => {
    setIsLoading(true);
    addLog('Testing push subscription...');
    
    try {
      const result = await testPushSubscription();
      if (result.success) {
        addLog('✅ Push subscription successful');
        if (result.subscription) {
          addLog(`📊 Endpoint: ${result.subscription.endpoint.substring(0, 50)}...`);
        }
        if (result.testFailed) {
          addLog('⚠️ Test notification failed to send', true);
        }
      } else {
        addLog(`❌ Push subscription failed: ${result.error}`, true);
      }
    } catch (error) {
      addLog(`❌ Error testing push subscription: ${error.message}`, true);
    }
    
    setIsLoading(false);
  };
  
  const sendTestNotification = async () => {
    setIsLoading(true);
    addLog('Sending test notification...');
    
    try {
      const userId = localStorage.getItem('currentUser') || 'anonymous';
      
      // Send a test notification via the API
      const response = await fetch('http://localhost:5000/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          notification: {
            title: 'StockHub Test',
            body: `Test notification at ${new Date().toLocaleTimeString()}`,
            icon: '/logo192.png',
            badge: 1,
            data: { url: '/hub' },
            aps: {
              alert: {
                title: 'StockHub Test',
                body: `Test notification at ${new Date().toLocaleTimeString()}`
              },
              badge: 1,
              'content-available': 1
            }
          }
        }),
      });
      
      if (response.ok) {
        addLog('✅ Test notification sent successfully');
      } else {
        const error = await response.text();
        addLog(`❌ Failed to send test notification: ${error}`, true);
      }
    } catch (error) {
      addLog(`❌ Error sending test notification: ${error.message}`, true);
    }
    
    setIsLoading(false);
  };
  
  const broadcastTestNotification = async () => {
    setIsLoading(true);
    addLog('Broadcasting test notification to all users...');
    
    try {
      // Send a broadcast notification via the API
      const response = await fetch('http://localhost:5000/api/broadcast-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notification: {
            title: 'StockHub Broadcast Test',
            body: `Broadcast test at ${new Date().toLocaleTimeString()}`,
            icon: '/logo192.png',
            badge: 1,
            data: { url: '/hub' },
            aps: {
              alert: {
                title: 'StockHub Broadcast Test',
                body: `Broadcast test at ${new Date().toLocaleTimeString()}`
              },
              badge: 1,
              'content-available': 1
            }
          }
        }),
      });
      
      if (response.ok) {
        addLog('✅ Broadcast notification sent successfully');
      } else {
        const error = await response.text();
        addLog(`❌ Failed to send broadcast notification: ${error}`, true);
      }
    } catch (error) {
      addLog(`❌ Error sending broadcast notification: ${error.message}`, true);
    }
    
    setIsLoading(false);
  };
  
  if (!isActive) {
    return (
      <button 
        onClick={() => setIsActive(true)}
        style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          zIndex: 1000,
          background: '#ddd',
          border: 'none',
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '12px'
        }}
      >
        Debug
      </button>
    );
  }
  
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        width: '300px',
        maxHeight: '400px',
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '4px',
        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        style={{
          padding: '8px',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '14px' }}>Notification Debugger</h3>
        <button 
          onClick={() => setIsActive(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ×
        </button>
      </div>
      
      <div
        style={{
          padding: '8px',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}
      >
        <button 
          onClick={runServiceWorkerTest}
          disabled={isLoading}
          style={{ fontSize: '12px', padding: '4px 8px' }}
        >
          Test Service Worker
        </button>
        
        <button 
          onClick={runPushSubscriptionTest}
          disabled={isLoading}
          style={{ fontSize: '12px', padding: '4px 8px' }}
        >
          Test Subscription
        </button>
        
        <button 
          onClick={sendTestNotification}
          disabled={isLoading}
          style={{ fontSize: '12px', padding: '4px 8px' }}
        >
          Test Notification
        </button>
        
        <button 
          onClick={broadcastTestNotification}
          disabled={isLoading}
          style={{ fontSize: '12px', padding: '4px 8px' }}
        >
          Test Broadcast
        </button>
        
        <button 
          onClick={clearLogs}
          disabled={isLoading}
          style={{ fontSize: '12px', padding: '4px 8px' }}
        >
          Clear Logs
        </button>
      </div>
      
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          backgroundColor: '#f5f5f5',
          fontSize: '12px',
          fontFamily: 'monospace',
          maxHeight: '300px'
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center' }}>No logs yet</div>
        ) : (
          logs.map((log, index) => (
            <div 
              key={index}
              style={{
                margin: '4px 0',
                color: log.isError ? 'red' : 'inherit'
              }}
            >
              <span style={{ color: '#888' }}>[{log.timestamp}]</span> {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationDebugger; 