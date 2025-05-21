import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { ActivityFeedContext } from './ActivityFeedContext';
import { v4 as uuidv4 } from 'uuid';
import { db } from './firebase';
import { ref, set, onValue, off, update, remove } from 'firebase/database';

// Types for reference
// type Lot = { id, shares, price, date } // date = ISO string
// type Position = { id, ticker, lots: Lot[] }

export const PositionsContext = createContext(null);

function recalcDerivedFields(position) {
  const totalShares = position.lots.reduce((sum, lot) => sum + Number(lot.shares), 0);
  const totalCost = position.lots.reduce((sum, lot) => sum + Number(lot.shares) * Number(lot.price), 0);
  const avgPrice = totalShares ? totalCost / totalShares : 0;
  return { ...position, totalShares, avgPrice };
}

export function PositionsProvider({ children }) {
  const { user } = useContext(AuthContext);
  const activityFeedContext = useContext(ActivityFeedContext);
  const [positions, setPositions] = useState([]);

  // Sync positions to localStorage for friends to see
  const syncToLocalStorage = (userPositions) => {
    if (user) {
      localStorage.setItem(`positions_${user}`, JSON.stringify(userPositions));
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
    }
    
    return id;
  };

  // Update a position (by id)
  const updatePosition = async (id, updates) => {
    const userRef = ref(db, `positions/${user}/${id}`);
    await update(userRef, updates);
    
    // Log activity for position update if ticker is provided
    if (activityFeedContext && updates.ticker) {
      const position = positions.find(p => p.id === id);
      if (position) {
        const totalAmount = position.lots.reduce((sum, lot) => (
          sum + (Number(lot.shares) * Number(lot.price))
        ), 0);
        
        await activityFeedContext.addActivity({
          actionType: 'edit',
          ticker: updates.ticker,
          amount: totalAmount
        });
      }
    }
  };

  // Delete a position (by id)
  const deletePosition = async (id) => {
    const position = positions.find(p => p.id === id);
    const userRef = ref(db, `positions/${user}/${id}`);
    
    // Log activity for position deletion before deleting
    if (activityFeedContext && position) {
      const totalAmount = position.lots.reduce((sum, lot) => (
        sum + (Number(lot.shares) * Number(lot.price))
      ), 0);
      
      await activityFeedContext.addActivity({
        actionType: 'sell',
        ticker: position.ticker,
        amount: totalAmount
      });
    }
    
    await remove(userRef);
  };

  // Add a lot to a position (by position id)
  const addLot = async (positionId, lot) => {
    const userRef = ref(db, `positions/${user}/${positionId}/lots`);
    const position = positions.find(p => p.id === positionId);
    
    // Get current lots, add new lot
    if (position) {
      const newLot = { ...lot, id: Date.now().toString() };
      const lots = [...position.lots, newLot];
      await set(userRef, lots);
      
      // Log activity for adding a lot
      if (activityFeedContext) {
        const amount = Number(lot.shares) * Number(lot.price);
        
        await activityFeedContext.addActivity({
          actionType: 'buy',
          ticker: position.ticker,
          amount: amount
        });
      }
    }
  };

  // Derived fields for each position
  const positionsWithDerived = positions.map(recalcDerivedFields);

  return (
    <PositionsContext.Provider value={{ positions: positionsWithDerived, addPosition, updatePosition, deletePosition, addLot }}>
      {children}
    </PositionsContext.Provider>
  );
} 