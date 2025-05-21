import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OptionsContext } from '../OptionsContext';
import OptionCard from '../components/OptionCard';
import AddOptionButton from '../components/AddOptionButton';
import './MyOptionsPage.css';

const MAX_OPTIONS = 10;

// Sell Option Modal component
const SellOptionModal = ({ option, onClose, onSell }) => {
  const [sellPremium, setSellPremium] = useState(option.premium);
  const [error, setError] = useState("");
  
  const contractMultiplier = 100; // Each contract is 100 shares
  const contracts = Number(option.contracts);
  const buyPremium = Number(option.premium);
  
  let profitLoss = 0;
  if (option.direction === 'LONG') {
    // For long options, profit = (sellPremium - buyPremium) * contracts * 100
    profitLoss = (sellPremium - buyPremium) * contracts * contractMultiplier;
  } else {
    // For short options, profit = (buyPremium - sellPremium) * contracts * 100
    profitLoss = (buyPremium - sellPremium) * contracts * contractMultiplier;
  }
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!sellPremium || sellPremium <= 0) {
      setError("Please enter a valid sell premium");
      return;
    }
    
    onSell(option.id, Number(sellPremium));
    onClose();
  };
  
  return (
    <div className="modal-overlay">
      <dialog open className="edit-lot-modal sell-modal">
        <h3>Sell {option.ticker} {option.type}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              Sell Premium:
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={sellPremium}
                onChange={(e) => setSellPremium(e.target.value)}
                required
              />
            </label>
          </div>
          
          <div className="position-summary">
            <p>Contracts: {option.contracts}</p>
            <p>Buy Premium: ${option.premium}/contract</p>
            <p>Direction: {option.direction}</p>
            <p>Total Sale: ${(contracts * sellPremium * contractMultiplier).toFixed(2)}</p>
            <p className={profitLoss >= 0 ? "profit" : "loss"}>
              Profit/Loss: ${profitLoss.toFixed(2)}
            </p>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="button-row">
            <button type="button" className="cancel-btn modern-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="save-btn modern-button">Confirm Sale</button>
          </div>
        </form>
      </dialog>
    </div>
  );
};

const OptionModal = ({ option, onClose, onDeleteOption, onSellOption }) => {
  const { updateOption } = useContext(OptionsContext);
  const [showSellModal, setShowSellModal] = useState(false);
  
  const handleUpdateOption = (id, updates) => {
    updateOption(id, updates);
  };
  
  if (!option) return null;
  
  const totalCost = option.direction === 'LONG' 
    ? option.contracts * option.premium * 100 
    : -option.contracts * option.premium * 100;
  
  return (
    <div className="modal-overlay">
      <dialog open className="option-modal">
        <div className="modal-header">
          <span className="modal-ticker">{option.ticker}</span>
          <span className="modal-actions">
            <button 
              className="modal-sell modern-button" 
              onClick={() => setShowSellModal(true)}
            >
              💰
            </button>
            <button 
              className="modal-delete modern-button" 
              onClick={() => { onDeleteOption(option.id); onClose(); }}
            >
              🗑
            </button>
          </span>
        </div>
        
        <div className="modal-stats">
          <span>Type: <b className={option.type.toLowerCase()}>{option.type}</b></span>
          <span>Direction: <b className={option.direction.toLowerCase()}>{option.direction}</b></span>
          <span>Contracts: <b>{option.contracts}</b></span>
          <span>Strike: <b>${option.strike}</b></span>
          <span>Premium: <b>${option.premium}</b></span>
          <span>Expiration: <b>{new Date(option.expiration).toLocaleDateString()}</b></span>
          <span>Total Cost: <b>${Math.abs(totalCost).toFixed(2)}</b></span>
        </div>
        
        <div className="live-pricing">
          <div className="price-input">
            <label>
              Current Option Price:
              <input 
                type="number" 
                min="0.01" 
                step="0.01"
                placeholder="Enter mark price"
              />
            </label>
            <button className="calculate-btn modern-button">Calculate P/L</button>
          </div>
          <div className="calculated-pl">
            <span>Unrealized P/L: <b>--</b></span>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            className="close-modal-btn modern-button" 
            onClick={onClose}
          >
            Close
          </button>
        </div>
        
        {showSellModal && (
          <SellOptionModal
            option={option}
            onClose={() => setShowSellModal(false)}
            onSell={onSellOption}
          />
        )}
      </dialog>
    </div>
  );
};

const MyOptionsPage = () => {
  const { options, deleteOption, sellOption, takenPL } = useContext(OptionsContext);
  const navigate = useNavigate();
  const [modalOption, setModalOption] = useState(null);
  const canAdd = options.length < MAX_OPTIONS;

  return (
    <div className="myoptions-container">
      <button 
        className="back-btn modern-button" 
        onClick={() => navigate('/hub')} 
        title="Back"
      >
        ←
      </button>
      <h1 className="myoptions-title">My Options</h1>
      
      <div className="taken-pl">
        <span>Options Taken P/L:</span> 
        <span className={takenPL >= 0 ? "pos" : "neg"}>
          {takenPL >= 0 ? "+" : ""}
          ${takenPL.toFixed(2)}
        </span>
      </div>
      
      {options.length === 0 ? (
        <div className="zero-state-card">No options yet • Add your first option</div>
      ) : (
        <div className="options-list">
          {options.map(opt => (
            <OptionCard 
              key={opt.id} 
              option={opt} 
              onClick={() => setModalOption(opt)} 
            />
          ))}
        </div>
      )}
      
      <AddOptionButton disabled={!canAdd} />
      
      {!canAdd && (
        <div className="max-options-warning">
          You can only track up to {MAX_OPTIONS} options at a time.
        </div>
      )}
      
      {modalOption && (
        <OptionModal 
          option={modalOption} 
          onClose={() => setModalOption(null)} 
          onDeleteOption={deleteOption}
          onSellOption={sellOption}
        />
      )}
    </div>
  );
};

export default MyOptionsPage; 