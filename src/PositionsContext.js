import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { db } from './firebase';
import { ref, set, onValue, off, update, remove, push } from 'firebase/database';

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
  const [positions, setPositions] = useState([]);

  // Real-time sync with Firebase
  useEffect(() => {
    if (!user) return;
    const userRef = ref(db, `positions/${user}`);
    const handleValue = (snapshot) => {
      const val = snapshot.val();
      if (val) {
        // Convert object to array
        setPositions(Object.values(val));
      } else {
        setPositions([]);
      }
    };
    onValue(userRef, handleValue);
    return () => off(userRef, 'value', handleValue);
  }, [user]);

  // Add a new position (optionally with initial lots)
  const addPosition = async (ticker, lots = []) => {
    const id = uuidv4();
    const newPosition = { id, ticker, lots };
    const userRef = ref(db, `positions/${user}/${id}`);
    await set(userRef, newPosition);
    return id;
  };

  // Update a position (by id)
  const updatePosition = (id, updates) => {
    const userRef = ref(db, `positions/${user}/${id}`);
    update(userRef, updates);
  };

  // Delete a position (by id)
  const deletePosition = (id) => {
    const userRef = ref(db, `positions/${user}/${id}`);
    remove(userRef);
  };

  // Add a lot to a position (by position id)
  const addLot = (positionId, lot) => {
    const userRef = ref(db, `positions/${user}/${positionId}/lots`);
    // Get current lots, add new lot
    setPositions(prev => {
      const pos = prev.find(p => p.id === positionId);
      const lots = pos ? [...pos.lots, { ...lot, id: Date.now().toString() }] : [{ ...lot, id: Date.now().toString() }];
      set(userRef, lots);
      return prev;
    });
  };

  // Derived fields for each position
  const positionsWithDerived = positions.map(recalcDerivedFields);

  return (
    <PositionsContext.Provider value={{ positions: positionsWithDerived, addPosition, updatePosition, deletePosition, addLot }}>
      {children}
    </PositionsContext.Provider>
  );
} 