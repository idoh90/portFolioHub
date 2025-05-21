import React, { useContext, useRef, useEffect } from 'react';
import { ActivityFeedContext } from './ActivityFeedContext';
import './ActivityFeed.css';

const ActivityFeed = () => {
  const { activities, isScrollLocked, setIsScrollLocked, hasNewActivity, scrollToLatest } = useContext(ActivityFeedContext);
  const feedRef = useRef(null);
  const [collapsed, setCollapsed] = React.useState(window.innerWidth < 768);

  // Format timestamp to local time
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format amount with currency symbol
  const formatAmount = (amount, actionType) => {
    const sign = actionType === 'sell' ? '-' : '+';
    return `${sign}₪${parseFloat(amount).toLocaleString()}`;
  };

  // Determine text color based on action type
  const getTextColor = (actionType) => {
    switch (actionType) {
      case 'buy': return 'activity-buy';
      case 'sell': return 'activity-sell';
      default: return 'activity-edit';
    }
  };

  // Handle scroll events to detect when user scrolls up
  const handleScroll = () => {
    if (feedRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
      setIsScrollLocked(!isAtBottom);
    }
  };

  // Scroll to bottom when new activities arrive if not locked
  useEffect(() => {
    if (feedRef.current && !isScrollLocked) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [activities, isScrollLocked]);

  // Listen for window resize to auto-collapse on mobile
  useEffect(() => {
    const handleResize = () => {
      setCollapsed(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toggle collapsed state
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div className={`activity-feed-container ${collapsed ? 'collapsed' : ''}`}>
      <div className="activity-feed-header">
        <h3>Activity Feed</h3>
        <button 
          className="toggle-button" 
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand feed" : "Collapse feed"}
        >
          {collapsed ? '▲' : '▼'}
        </button>
        {hasNewActivity && !collapsed && (
          <button className="latest-button" onClick={scrollToLatest}>
            Latest
          </button>
        )}
      </div>
      
      {!collapsed && (
        <div className="activity-feed-content" ref={feedRef} onScroll={handleScroll}>
          {activities.length === 0 ? (
            <div className="no-activity">No recent activity</div>
          ) : (
            activities.map((activity, index) => (
              <div key={index} className="activity-item">
                <span className="activity-time">{formatTime(activity.timestamp)}</span>
                <span className="activity-user">{activity.userId}</span>
                <span className="activity-ticker">{activity.ticker}</span>
                <span className={`activity-amount ${getTextColor(activity.actionType)}`}>
                  {formatAmount(activity.amount, activity.actionType)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ActivityFeed; 