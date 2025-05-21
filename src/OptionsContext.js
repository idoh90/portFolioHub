import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { ActivityFeedContext } from './ActivityFeedContext';
import { NotificationContext } from './NotificationContext';
import { v4 as uuidv4 } from 'uuid';
import { db } from './firebase';
import { ref, set, onValue, off, update, remove, get } from 'firebase/database';

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
  const notificationContext = useContext(NotificationContext);
  const [options, setOptions] = useState([]);
  const [takenPL, setTakenPL] = useState(0);

  // Fetch taken P/L value from Firebase
  useEffect(() => {
    if (!user) return;
    
    const takenPLRef = ref(db, `optionsTakenPL/${user}`);
    const handleValue = (snapshot) => {
      const val = snapshot.val();
      if (val !== null) {
        setTakenPL(val);
        // Sync to localStorage for friends to view
        localStorage.setItem(`optionsTakenPL_${user}`, val);
      } else {
        // Initialize with zero if not found
        setTakenPL(0);
        set(takenPLRef, 0);
        localStorage.setItem(`optionsTakenPL_${user}`, 0);
      }
    };
    
    onValue(takenPLRef, handleValue);
    return () => off(takenPLRef, 'value', handleValue);
  }, [user]);

  // Sync options to localStorage for friends to see
  const syncToLocalStorage = (userOptions) => {
    if (user) {
      localStorage.setItem(`options_${user}`, JSON.stringify(userOptions));
    }
  };

  // Real-time sync with Firebase
  useEffect(() => {
    if (!user) return;
    
    // Initial check - try to load existing data from localStorage if Firebase data doesn't exist yet
    const initializeFromLocalStorage = async () => {
      const userRef = ref(db, `options/${user}`);
      const snapshot = await get(userRef);
      
      if (!snapshot.exists()) {
        // No data in Firebase, check localStorage
        try {
          const localData = localStorage.getItem(`options_${user}`);
          if (localData) {
            const parsedOptions = JSON.parse(localData);
            
            // If we have localStorage data but no Firebase data, save to Firebase
            if (Array.isArray(parsedOptions) && parsedOptions.length > 0) {
              console.log(`Migrating ${parsedOptions.length} options from localStorage to Firebase for ${user}`);
              
              // Create a batch write to save all options
              const batch = {};
              parsedOptions.forEach(option => {
                if (option.id) {
                  batch[option.id] = option;
                }
              });
              
              // Save to Firebase
              await set(userRef, batch);
            }
          }
        } catch (error) {
          console.error("Error migrating options from localStorage to Firebase:", error);
        }
      }
    };
    
    // Try to initialize from localStorage first
    initializeFromLocalStorage();
    
    // Then set up the regular Firebase listener
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
      const totalAmount = Number(optionData.contracts) * Number(optionData.premium) * 100;
      
      await activityFeedContext.addActivity({
        actionType: optionData.direction === 'LONG' ? 'buy' : 'sell',
        ticker: `${optionData.ticker} ${optionData.type}`,
        amount: totalAmount,
        assetType: 'option',
        optionType: optionData.type
      });
      
      // Send notification for buy/sell event (only for buying options)
      if (notificationContext && optionData.direction === 'LONG') {
        await notificationContext.sendTradeNotification(
          'buy',
          `${optionData.ticker} ${optionData.type}`,
          totalAmount,
          'option'
        );
      }
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
        const totalAmount = Number(option.contracts) * Number(option.premium) * 100;
        
        await activityFeedContext.addActivity({
          actionType: 'edit',
          ticker: `${updates.ticker} ${updates.type || option.type}`,
          amount: totalAmount,
          assetType: 'option',
          optionType: updates.type || option.type
        });
      }
    }
  };

  // Sell an option (by id) and calculate profit/loss
  const sellOption = async (id, sellPremium) => {
    const option = options.find(o => o.id === id);
    
    // If option doesn't exist, just return
    if (!option) {
      console.log(`Option with id ${id} not found.`);
      return;
    }
    
    const userRef = ref(db, `options/${user}/${id}`);
    
    // Calculate profit/loss
    try {
      const contracts = Number(option.contracts);
      const buyPremium = Number(option.premium);
      
      // Calculate based on direction
      let profitLoss = 0;
      const contractMultiplier = 100; // Each contract is 100 shares
      
      if (option.direction === 'LONG') {
        // For long options, profit = (sellPremium - buyPremium) * contracts * 100
        profitLoss = (sellPremium - buyPremium) * contracts * contractMultiplier;
      } else {
        // For short options, profit = (buyPremium - sellPremium) * contracts * 100
        profitLoss = (buyPremium - sellPremium) * contracts * contractMultiplier;
      }
      
      // Update takenPL in Firebase
      const takenPLRef = ref(db, `optionsTakenPL/${user}`);
      const snapshot = await get(takenPLRef);
      const currentTakenPL = snapshot.exists() ? snapshot.val() : 0;
      const newTakenPL = currentTakenPL + profitLoss;
      await set(takenPLRef, newTakenPL);
      
      // Update local state
      setTakenPL(newTakenPL);
      
      // Log activity for option sold
      if (activityFeedContext) {
        const amount = contracts * sellPremium * contractMultiplier;
        
        await activityFeedContext.addActivity({
          actionType: 'sell',
          ticker: `${option.ticker} ${option.type}`,
          amount: amount,
          assetType: 'option',
          optionType: option.type,
          profitLoss: profitLoss
        });
        
        // Send notification for sell event
        if (notificationContext) {
          await notificationContext.sendTradeNotification(
            'sell',
            `${option.ticker} ${option.type}`,
            amount,
            'option'
          );
        }
      }
      
      // Remove option from database
      await remove(userRef);
      
      return { success: true, profitLoss };
    } catch (e) {
      console.error("Error selling option:", e);
      return { success: false, error: e.message };
    }
  };

  // Delete an option (by id) without calculating profit/loss
  const deleteOption = async (id) => {
    const option = options.find(o => o.id === id);
    const userRef = ref(db, `options/${user}/${id}`);
    
    // Log activity for option deletion before deleting
    if (activityFeedContext && option) {
      const totalAmount = Number(option.contracts) * Number(option.premium) * 100;
      
      await activityFeedContext.addActivity({
        actionType: 'delete',
        ticker: `${option.ticker} ${option.type}`,
        amount: totalAmount,
        assetType: 'option',
        optionType: option.type
      });
    }
    
    await remove(userRef);
  };

  return (
    <OptionsContext.Provider value={{ 
      options, 
      addOption, 
      updateOption, 
      deleteOption,
      sellOption,
      takenPL
    }}>
      {children}
    </OptionsContext.Provider>
  );
} 