import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { PositionsContext } from '../PositionsContext';
import { v4 as uuidv4 } from 'uuid';
import './NewPositionPage.css';

const today = () => new Date().toISOString().slice(0, 10);

const NewPositionPage = () => {
  const { addPosition } = useContext(PositionsContext);
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(today());
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!ticker || !shares || !price || !date) return;
    const upperTicker = ticker.trim().toUpperCase();
    const lotId = uuidv4();
    // Add position with first lot in one step
    addPosition(upperTicker, [{ id: lotId, shares: Number(shares), price: Number(price), date }]);
    navigate('/mystocks');
  };

  return (
    <div className="newposition-container">
      <h1 className="newposition-title">Add New Position</h1>
      <form className="newposition-form" onSubmit={handleSubmit}>
        <label>
          Ticker
          <input type="text" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} required maxLength={8} />
        </label>
        <label>
          Shares
          <input type="number" min="1" value={shares} onChange={e => setShares(e.target.value)} required />
        </label>
        <label>
          Price
          <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required />
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </label>
        <div className="newposition-actions">
          <button className="add-position-btn" type="submit">Add Position</button>
          <button className="cancel-position-btn" type="button" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default NewPositionPage; 