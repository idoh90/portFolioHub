import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OptionsContext } from '../OptionsContext';
import OptionCard from '../components/OptionCard';
import AddOptionButton from '../components/AddOptionButton';
import './MyOptionsPage.css';

const MAX_OPTIONS = 10;

const OptionModal = ({ option, onClose, onDeleteOption }) => {
  const { updateOption } = useContext(OptionsContext);
  
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
      </dialog>
    </div>
  );
};

const MyOptionsPage = () => {
  const { options, deleteOption } = useContext(OptionsContext);
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
        />
      )}
    </div>
  );
};

export default MyOptionsPage; 