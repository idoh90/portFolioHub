import React, { useState, useEffect } from 'react';
import './EditLotModal.css';

const today = () => new Date().toISOString().slice(0, 10);

const EditLotModal = ({ positionId, lot, onSave, onClose }) => {
  const [shares, setShares] = useState(lot ? lot.shares : '');
  const [price, setPrice] = useState(lot ? lot.price : '');
  const [date, setDate] = useState(lot ? lot.date.slice(0, 10) : today());

  useEffect(() => {
    if (lot) {
      setShares(lot.shares);
      setPrice(lot.price);
      setDate(lot.date.slice(0, 10));
    }
  }, [lot]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!shares || !price || !date) return;
    onSave({
      ...(lot ? lot : {}),
      shares: Number(shares),
      price: Number(price),
      date: date,
    });
  };

  return (
    <div className="modal-overlay">
      <dialog open className="editlot-modal">
        <form onSubmit={handleSubmit}>
          <h2>{lot ? 'Edit Lot' : 'Add Lot'}</h2>
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
          <div className="editlot-actions">
            <button type="submit" className="save-btn modern-button">Save</button>
            <button type="button" className="cancel-btn modern-button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </dialog>
    </div>
  );
};

export default EditLotModal; 