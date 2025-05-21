import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { db } from './firebase';
import { ref, onValue, off, push, query, orderByChild, limitToLast } from 'firebase/database';

export const ActivityFeedContext = createContext(null);

export function ActivityFeedProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [activities, setActivities] = useState([]);
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const [hasNewActivity, setHasNewActivity] = useState(false);

  // Fetch activities from Firebase
  useEffect(() => {
    const activitiesRef = query(
      ref(db, 'portfolio_activity'),
      orderByChild('timestamp'),
      limitToLast(50)
    );

    const handleValue = (snapshot) => {
      const val = snapshot.val();
      if (val) {
        // Convert object to array and sort by timestamp in descending order
        const activitiesArray = Object.values(val)
          .sort((a, b) => b.timestamp - a.timestamp);
        
        setActivities(activitiesArray);
        
        // If there are new activities and user isn't scrolled up, don't show the "Latest" button
        if (!isScrollLocked) {
          setHasNewActivity(false);
        } else if (activitiesArray.length > activities.length) {
          setHasNewActivity(true);
        }
      } else {
        setActivities([]);
      }
    };

    onValue(activitiesRef, handleValue);
    return () => off(activitiesRef, 'value', handleValue);
  }, [user, isScrollLocked, activities.length]);

  // Add a new activity
  const addActivity = async (data) => {
    const activityRef = ref(db, 'portfolio_activity');
    const newActivity = {
      timestamp: Date.now(),
      userId: user,
      ...data
    };
    await push(activityRef, newActivity);
  };

  // Scroll to latest
  const scrollToLatest = () => {
    setIsScrollLocked(false);
    setHasNewActivity(false);
  };

  return (
    <ActivityFeedContext.Provider value={{ 
      activities, 
      addActivity, 
      isScrollLocked, 
      setIsScrollLocked,
      hasNewActivity,
      scrollToLatest
    }}>
      {children}
    </ActivityFeedContext.Provider>
  );
} 