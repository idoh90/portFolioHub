import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { ActivityFeedContext } from './ActivityFeedContext';
import { v4 as uuidv4 } from 'uuid';
import { db } from './firebase';
import { ref, set, onValue, off, update, remove } from 'firebase/database';

// Type for reference
// type Option = { 
//   id, 
//   ticker, 
//   type: 'CALL' | 'PUT',
//   direction: 'LONG' | 'SHORT',
//   contracts,
//   strike,
//   premium,
//   expiration,   // ISO string
//   tradeDate
// }

export const OptionsContext = createContext(null);

export function OptionsProvider({ children }) {
  const { user } = useContext(AuthContext);
  const activityFeedContext = useContext(ActivityFeedContext);
  const [options, setOptions] = useState([]);

  // Sync options to localStorage for friends to see
  const syncToLocalStorage = (userOptions) => {
    if (user) {
      localStorage.setItem(`options_${user}`, JSON.stringify(userOptions));
    }
  };

  // Real-time sync with Firebase
  useEffect(() => {
    if (!user) return;
    const userRef = ref(db, `options/${user}`);
    const handleValue = (snapshot) => {
      const val = snapshot.val();
      if (val) {
        // Convert object to array
        const optionsArray = Object.values(val);
        setOptions(optionsArray);
        
        // Sync to localStorage for friends to view
        syncToLocalStorage(optionsArray);
      } else {
        setOptions([]);
        
        // Clear localStorage if no options
        syncToLocalStorage([]);
      }
    };
    onValue(userRef, handleValue);
    return () => off(userRef, 'value', handleValue);
  }, [user]);

  // Add a new option
  const addOption = async (optionData) => {
    const id = uuidv4();
    const newOption = { 
      id, 
      ...optionData 
    };
    const userRef = ref(db, `options/${user}/${id}`);
    await set(userRef, newOption);
    
    // Log activity for new option
    if (activityFeedContext) {
      const totalAmount = Number(optionData.contracts) * Number(optionData.premium);
      
      await activityFeedContext.addActivity({
        actionType: optionData.direction === 'LONG' ? 'buy' : 'sell',
        ticker: `${optionData.ticker} ${optionData.type}`,
        amount: totalAmount
      });
    }
    
    return id;
  };

  // Update an option (by id)
  const updateOption = async (id, updates) => {
    const userRef = ref(db, `options/${user}/${id}`);
    await update(userRef, updates);
    
    // Log activity for option update if ticker is provided
    if (activityFeedContext && updates.ticker) {
      const option = options.find(o => o.id === id);
      if (option) {
        const totalAmount = Number(option.contracts) * Number(option.premium);
        
        await activityFeedContext.addActivity({
          actionType: 'edit',
          ticker: `${updates.ticker} ${updates.type || option.type}`,
          amount: totalAmount
        });
      }
    }
  };

  // Delete an option (by id)
  const deleteOption = async (id) => {
    const option = options.find(o => o.id === id);
    const userRef = ref(db, `options/${user}/${id}`);
    
    // Log activity for option deletion before deleting
    if (activityFeedContext && option) {
      const totalAmount = Number(option.contracts) * Number(option.premium);
      
      await activityFeedContext.addActivity({
        actionType: option.direction === 'LONG' ? 'sell' : 'buy',
        ticker: `${option.ticker} ${option.type}`,
        amount: totalAmount
      });
    }
    
    await remove(userRef);
  };

  return (
    <OptionsContext.Provider value={{ 
      options, 
      addOption, 
      updateOption, 
      deleteOption 
    }}>
      {children}
    </OptionsContext.Provider>
  );
} 