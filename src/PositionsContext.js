import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { ActivityFeedContext } from './ActivityFeedContext';
import { NotificationContext } from './NotificationContext';
import { v4 as uuidv4 } from 'uuid';
import { db } from './firebase';
import { ref, set, onValue, off, update, remove, get } from 'firebase/database';

// Types for reference
// type Lot = { id, shares, price, date } // date = ISO string
// type Position = { id, ticker, lots: Lot[] }

export const PositionsContext = createContext(null);

function recalcDerivedFields(position) {
  // Handle undefined or null position
  if (!position) return null;
  
  // Handle positions without lots or with malformed lots array
  if (!position.lots || !Array.isArray(position.lots)) {
    return { ...position, totalShares: 0, avgPrice: 0, lots: [] };
  }
  
  const totalShares = position.lots.reduce((sum, lot) => sum + Number(lot.shares || 0), 0);
  const totalCost = position.lots.reduce((sum, lot) => sum + Number(lot.shares || 0) * Number(lot.price || 0), 0);
  const avgPrice = totalShares ? totalCost / totalShares : 0;
  return { ...position, totalShares, avgPrice };
}

export function PositionsProvider({ children }) {
  const { user } = useContext(AuthContext);
  const activityFeedContext = useContext(ActivityFeedContext);
  const notificationContext = useContext(NotificationContext);
  const [positions, setPositions] = useState([]);
  const [takenPL, setTakenPL] = useState(0);

  // Fetch taken P/L value from Firebase
  useEffect(() => {
    if (!user) return;
    
    const takenPLRef = ref(db, `takenPL/${user}`);
    const handleValue = (snapshot) => {
      const val = snapshot.val();
      if (val !== null) {
        setTakenPL(val);
        // Sync to localStorage for friends to view
        localStorage.setItem(`takenPL_${user}`, val);
      } else {
        // Initialize with zero if not found
        setTakenPL(0);
        set(takenPLRef, 0);
        localStorage.setItem(`takenPL_${user}`, 0);
      }
    };
    
    onValue(takenPLRef, handleValue);
    return () => off(takenPLRef, 'value', handleValue);
  }, [user]);

  // Sync positions to localStorage for friends to see
  const syncToLocalStorage = (userPositions) => {
    if (!user) return;
    
    try {
      // Ensure we have a valid array to sync
      const validPositions = Array.isArray(userPositions) ? 
        userPositions.filter(p => p !== null && p !== undefined) : [];
      
      localStorage.setItem(`positions_${user}`, JSON.stringify(validPositions));
    } catch (e) {
      console.error("Error syncing positions to localStorage:", e);
    }
  };

  // Real-time sync with Firebase
  useEffect(() => {
    if (!user) return;
    const userRef = ref(db, `positions/${user}`);
    const handleValue = (snapshot) => {
      const val = snapshot.val();
      if (val) {
        // Convert object to array
        const positionsArray = Object.values(val);
        setPositions(positionsArray);
        
        // Sync to localStorage for friends to view
        syncToLocalStorage(positionsArray);
      } else {
        setPositions([]);
        
        // Clear localStorage if no positions
        syncToLocalStorage([]);
      }
    };
    onValue(userRef, handleValue);
    return () => off(userRef, 'value', handleValue);
  }, [user, syncToLocalStorage]);

  // Add a new position (optionally with initial lots)
  const addPosition = async (ticker, lots = []) => {
    const id = uuidv4();
    const newPosition = { id, ticker, lots };
    const userRef = ref(db, `positions/${user}/${id}`);
    await set(userRef, newPosition);
    
    // Log activity for new position
    if (activityFeedContext && lots.length > 0) {
      const totalAmount = lots.reduce((sum, lot) => (
        sum + (Number(lot.shares) * Number(lot.price))
      ), 0);
      
      await activityFeedContext.addActivity({
        actionType: 'buy',
        ticker: ticker,
        amount: totalAmount
      });
      
      // Send notification for buy event
      if (notificationContext && lots.length > 0) {
        await notificationContext.sendTradeNotification(
          'buy',
          ticker,
          totalAmount,
          'stock'
        );
      }
    }
    
    return id;
  };

  // Update a position (by id)
  const updatePosition = async (id, updates) => {
    // Ensure position exists before updating
    const position = positions.find(p => p.id === id);
    if (!position) {
      console.log(`Position with id ${id} not found for updating.`);
      return;
    }
    
    const userRef = ref(db, `positions/${user}/${id}`);
    
    try {
      await update(userRef, updates);
      
      // Log activity for position update if ticker is provided
      if (activityFeedContext && updates.ticker) {
        if (position && position.lots && Array.isArray(position.lots)) {
          const totalAmount = position.lots.reduce((sum, lot) => (
            sum + (Number(lot.shares || 0) * Number(lot.price || 0))
          ), 0);
          
          await activityFeedContext.addActivity({
            actionType: 'edit',
            ticker: updates.ticker,
            amount: totalAmount,
            type: 'stock'
          });
        }
      }
    } catch (e) {
      console.error(`Error updating position ${id}:`, e);
    }
  };

  // Sell a position (by id) and calculate profit/loss
  const sellPosition = async (id, sellPrice) => {
    const position = positions.find(p => p.id === id);
    
    // If position doesn't exist, just return
    if (!position) {
      console.log(`Position with id ${id} not found.`);
      return;
    }
    
    const userRef = ref(db, `positions/${user}/${id}`);
    
    // Calculate profit/loss
    if (position && position.lots && Array.isArray(position.lots)) {
      try {
        const totalShares = position.totalShares || position.lots.reduce((sum, lot) => 
          sum + Number(lot.shares || 0), 0);
        
        const totalCost = position.lots.reduce((sum, lot) => 
          sum + (Number(lot.shares || 0) * Number(lot.price || 0)), 0);
        
        const sellValue = totalShares * sellPrice;
        const profitLoss = sellValue - totalCost;
        
        // Update takenPL in Firebase
        const takenPLRef = ref(db, `takenPL/${user}`);
        const snapshot = await get(takenPLRef);
        const currentTakenPL = snapshot.exists() ? snapshot.val() : 0;
        const newTakenPL = currentTakenPL + profitLoss;
        await set(takenPLRef, newTakenPL);
        
        // Update local state
        setTakenPL(newTakenPL);
        
        // Log activity for position sold
        if (activityFeedContext) {
          await activityFeedContext.addActivity({
            actionType: 'sell',
            ticker: position.ticker,
            amount: sellValue,
            type: 'stock',
            profitLoss: profitLoss
          });
          
          // Send notification for sell event
          if (notificationContext) {
            await notificationContext.sendTradeNotification(
              'sell',
              position.ticker,
              sellValue,
              'stock'
            );
          }
        }
        
        // Remove position from database
        await remove(userRef);
        
        return { success: true, profitLoss };
      } catch (e) {
        console.error("Error selling position:", e);
        return { success: false, error: e.message };
      }
    }
  };

  // Delete a position (by id) without calculating profit/loss
  const deletePosition = async (id) => {
    const position = positions.find(p => p.id === id);
    
    // If position doesn't exist, just return
    if (!position) {
      console.log(`Position with id ${id} not found.`);
      return;
    }
    
    const userRef = ref(db, `positions/${user}/${id}`);
    
    // Log activity for position deletion before deleting
    if (activityFeedContext && position && position.lots) {
      try {
        const totalAmount = position.lots.reduce((sum, lot) => (
          sum + (Number(lot.shares || 0) * Number(lot.price || 0))
        ), 0);
        
        await activityFeedContext.addActivity({
          actionType: 'delete',
          ticker: position.ticker,
          amount: totalAmount,
          type: 'stock' // Add explicit type for better activity tracking
        });
      } catch (e) {
        console.error("Error logging activity for delete:", e);
      }
    }
    
    try {
      await remove(userRef);
    } catch (e) {
      console.error(`Error deleting position ${id}:`, e);
    }
  };

  // Add a lot to a position (by position id)
  const addLot = async (positionId, lot) => {
    // Ensure position exists
    const position = positions.find(p => p.id === positionId);
    if (!position) {
      console.log(`Position with id ${positionId} not found for adding lot.`);
      return;
    }
    
    // Validate lot data
    if (!lot || !lot.shares || !lot.price) {
      console.error("Invalid lot data:", lot);
      return;
    }
    
    const userRef = ref(db, `positions/${user}/${positionId}/lots`);
    
    try {
      // Ensure position has lots array
      const existingLots = Array.isArray(position.lots) ? position.lots : [];
      const newLot = { ...lot, id: Date.now().toString() };
      const lots = [...existingLots, newLot];
      await set(userRef, lots);
      
      // Log activity for adding a lot
      if (activityFeedContext) {
        const amount = Number(lot.shares) * Number(lot.price);
        
        await activityFeedContext.addActivity({
          actionType: 'buy',
          ticker: position.ticker,
          amount: amount,
          type: 'stock'
        });
        
        // Send notification for buying more shares
        if (notificationContext) {
          await notificationContext.sendTradeNotification(
            'buy',
            position.ticker,
            amount,
            'stock'
          );
        }
      }
    } catch (e) {
      console.error(`Error adding lot to position ${positionId}:`, e);
    }
  };

  // Derived fields for each position
  const positionsWithDerived = positions
    .map(recalcDerivedFields)
    .filter(position => position !== null); // Filter out any null positions

  return (
    <PositionsContext.Provider value={{ 
      positions: positionsWithDerived, 
      addPosition, 
      updatePosition, 
      deletePosition, 
      sellPosition,
      addLot,
      takenPL 
    }}>
      {children}
    </PositionsContext.Provider>
  );
} 