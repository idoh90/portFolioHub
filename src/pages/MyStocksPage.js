import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PositionsContext } from '../PositionsContext';
import EditLotModal from './EditLotModal';
import { v4 as uuidv4 } from 'uuid';
import { useQuote } from '../api/useQuote';
import './MyStocksPage.css';

const MAX_POSITIONS = 5;

function getLastLotDate(position) {
  if (!position.lots.length) return '--';
  const lastLot = [...position.lots].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  return lastLot.date.slice(0, 10);
}

function getTotalInvested(position) {
  return position.lots.reduce((sum, lot) => sum + Number(lot.shares) * Number(lot.price), 0);
}

function formatTime(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

const PositionModal = ({ position, onClose, onDeletePosition }) => {
  const { addLot, updatePosition, positions } = useContext(PositionsContext);
  const [editLot, setEditLot] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Find the latest position data from context
  const latestPosition = positions.find(p => p.id === position.id) || position;

  // Delete a lot by id
  const handleDeleteLot = (lotId) => {
    const newLots = latestPosition.lots.filter(lot => lot.id !== lotId);
    updatePosition(latestPosition.id, { lots: newLots });
    setRefreshKey(k => k + 1);
  };

  // Save (add or update) a lot
  const handleSaveLot = (lotData) => {
    if (editLot && editLot.id) {
      // Edit mode: update existing lot
      const newLots = latestPosition.lots.map(lot => lot.id === lotData.id ? { ...lot, ...lotData } : lot);
      updatePosition(latestPosition.id, { lots: newLots });
    } else {
      // Add mode: add new lot with uuid
      addLot(latestPosition.id, { ...lotData, id: uuidv4() });
    }
    setEditLot(null);
    setRefreshKey(k => k + 1);
  };

  if (!latestPosition) return null;
  const totalCost = latestPosition.lots.reduce((sum, lot) => sum + Number(lot.shares) * Number(lot.price), 0);
  return (
    <div className="modal-overlay" key={refreshKey}>
      <dialog open className="position-modal">
        <div className="modal-header">
          <span className="modal-ticker">{latestPosition.ticker}</span>
          <span className="modal-actions">
            <button className="modal-delete" onClick={() => { onDeletePosition(latestPosition.id); onClose(); }}>🗑</button>
          </span>
        </div>
        <div className="modal-stats">
          <span>Total shares: <b>{latestPosition.totalShares}</b></span>
          <span>Avg price: <b>${latestPosition.avgPrice.toFixed(2)}</b></span>
          <span>Total cost: <b>${totalCost.toFixed(2)}</b></span>
        </div>
        <table className="lots-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shares</th>
              <th>Price</th>
              <th>Subtotal</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {latestPosition.lots.map(lot => (
              <tr key={lot.id}>
                <td>{lot.date.slice(0, 10)}</td>
                <td>{lot.shares}</td>
                <td>${Number(lot.price).toFixed(2)}</td>
                <td>${(Number(lot.shares) * Number(lot.price)).toFixed(2)}</td>
                <td><button className="lot-edit" onClick={() => setEditLot(lot)}>✎</button></td>
                <td><button className="lot-delete" onClick={() => handleDeleteLot(lot.id)}>🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="modal-footer">
          <button className="add-lot-btn" onClick={() => setEditLot({})}>Add lot</button>
          <button className="close-modal-btn" onClick={onClose}>Close</button>
        </div>
        {editLot !== null && (
          <EditLotModal
            positionId={latestPosition.id}
            lot={Object.keys(editLot).length ? editLot : undefined}
            onSave={handleSaveLot}
            onClose={() => setEditLot(null)}
          />
        )}
      </dialog>
    </div>
  );
};

const PositionCard = ({ position, onClick }) => {
  const { price: livePrice, loading, timeLeft } = useQuote(position.ticker);
  const totalShares = position.totalShares;
  const avgPrice = position.avgPrice;
  const invested = totalShares * avgPrice;
  const liveValue = livePrice ? totalShares * livePrice : null;
  const livePL = liveValue !== null ? liveValue - invested : null;

  return (
    <div className="position-card flash-card" onClick={onClick} tabIndex={0} role="button">
      <div className="position-ticker huge">{position.ticker}</div>
      <div className="position-details">
        <span>{totalShares} sh</span>
        <span>${avgPrice.toFixed(2)}</span>
        <span>{getLastLotDate(position)}</span>
      </div>
      <div className="position-extra-details">
        <span>{position.lots.length} lot{position.lots.length !== 1 ? 's' : ''}</span>
        <span>Total: ${getTotalInvested(position).toFixed(2)}</span>
      </div>
      <div className="live-row">
        <span className="live-label">Live data</span>
        <span className="live-timer">{formatTime(timeLeft)}</span>
        <span>
          {loading ? "Loading..." : `Live: $${livePrice?.toFixed(2) ?? "--"}`}
        </span>
        <span>
          {livePL !== null && !loading && (
            <span className={livePL >= 0 ? "pos" : "neg"}>
              {livePL >= 0 ? "+" : ""}${livePL.toFixed(2)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

const MyStocksPage = () => {
  const { positions, deletePosition } = useContext(PositionsContext);
  const navigate = useNavigate();
  const [modalPosition, setModalPosition] = useState(null);
  const canAdd = positions.length < MAX_POSITIONS;

  return (
    <div className="mystocks-container">
      <button className="back-btn" onClick={() => navigate('/hub')} title="Back">←</button>
      <h1 className="mystocks-title">My Stocks</h1>
      {positions.length === 0 ? (
        <div className="zero-state-card">No positions yet • Add your first stock</div>
      ) : (
        <div className="positions-list">
          {positions.map(pos => (
            <PositionCard key={pos.id} position={pos} onClick={() => setModalPosition(pos)} />
          ))}
        </div>
      )}
      <button className="floating-add-btn" onClick={() => navigate('/new-position')} disabled={!canAdd}>＋</button>
      {!canAdd && <div className="max-stocks-warning">You can only track up to 5 stocks at a time.</div>}
      {modalPosition && <PositionModal position={modalPosition} onClose={() => setModalPosition(null)} onDeletePosition={deletePosition} />}
    </div>
  );
};

export default MyStocksPage; 