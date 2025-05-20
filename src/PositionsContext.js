import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';

// Types for reference
// type Lot = { id, shares, price, date } // date = ISO string
// type Position = { id, ticker, lots: Lot[] }

export const PositionsContext = createContext(null);

function getStorageKey(user) {
  return `positions_${user}`;
}

function recalcDerivedFields(position) {
  const totalShares = position.lots.reduce((sum, lot) => sum + Number(lot.shares), 0);
  const totalCost = position.lots.reduce((sum, lot) => sum + Number(lot.shares) * Number(lot.price), 0);
  const avgPrice = totalShares ? totalCost / totalShares : 0;
  return { ...position, totalShares, avgPrice };
}

export function PositionsProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [positions, setPositions] = useState([]);

  // Load positions from localStorage on mount or user change
  useEffect(() => {
    if (!user) return;
    const key = getStorageKey(user);
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setPositions(JSON.parse(stored));
      } catch {
        setPositions([]);
      }
    } else {
      setPositions([]);
    }
  }, [user]);

  // Save positions to localStorage when they change
  useEffect(() => {
    if (!user) return;
    const key = getStorageKey(user);
    localStorage.setItem(key, JSON.stringify(positions));
  }, [positions, user]);

  // Add a new position (optionally with initial lots)
  const addPosition = (ticker, lots = []) => {
    const id = uuidv4();
    setPositions(prev => [...prev, { id, ticker, lots }]);
    return id;
  };

  // Update a position (by id)
  const updatePosition = (id, updates) => {
    setPositions(prev => prev.map(pos => pos.id === id ? { ...pos, ...updates } : pos));
  };

  // Delete a position (by id)
  const deletePosition = (id) => {
    setPositions(prev => prev.filter(pos => pos.id !== id));
  };

  // Add a lot to a position (by position id)
  const addLot = (positionId, lot) => {
    setPositions(prev => prev.map(pos =>
      pos.id === positionId
        ? { ...pos, lots: [...pos.lots, { ...lot, id: Date.now().toString() }] }
        : pos
    ));
  };

  // Derived fields for each position
  const positionsWithDerived = positions.map(recalcDerivedFields);

  return (
    <PositionsContext.Provider value={{ positions: positionsWithDerived, addPosition, updatePosition, deletePosition, addLot }}>
      {children}
    </PositionsContext.Provider>
  );
} 