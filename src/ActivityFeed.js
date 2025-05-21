import React, { useContext } from 'react';
import { ActivityFeedContext } from './ActivityFeedContext';
import './ActivityFeed.css';

const ActivityFeed = () => {
  const { activities } = useContext(ActivityFeedContext);

  // Format timestamp to human-readable time
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.round(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatAmount = (amount) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    });
  };

  const getActionEmoji = (actionType) => {
    switch (actionType) {
      case 'buy':
        return '🟢';
      case 'sell':
        return '🔴';
      case 'edit':
        return '✏️';
      default:
        return '•';
    }
  };

  const getActionText = (actionType) => {
    switch (actionType) {
      case 'buy':
        return 'bought';
      case 'sell':
        return 'sold';
      case 'edit':
        return 'edited';
      default:
        return actionType;
    }
  };

  // Show up to 20 recent activities
  const recentActivities = activities.slice(0, 20);

  return (
    <div className="activity-feed">
      <h3 className="activity-feed-title">Recent Activity</h3>
      <div className="activities-list">
        {recentActivities.length > 0 ? (
          recentActivities.map((activity, index) => (
            <div key={index} className="activity-item">
              <div className="activity-main">
                <span className="activity-emoji">{getActionEmoji(activity.actionType)}</span>
                <div className="activity-content">
                  <div className="activity-user-action">
                    <span className="activity-user">{activity.userId || 'Anonymous'}</span>
                    <span className="activity-text">
                      {getActionText(activity.actionType)} 
                      <span className="activity-ticker"> {activity.ticker}</span>
                    </span>
                  </div>
                  <div className="activity-time">{formatTime(activity.timestamp)}</div>
                </div>
              </div>
              <span className="activity-amount">{formatAmount(activity.amount)}</span>
            </div>
          ))
        ) : (
          <div className="no-activities">No recent activities</div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed; 