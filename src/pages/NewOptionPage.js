import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { OptionsContext } from '../OptionsContext';
import './NewOptionPage.css';

const today = () => new Date().toISOString().slice(0, 10);

const NewOptionPage = () => {
  const { addOption } = useContext(OptionsContext);
  const [ticker, setTicker] = useState('');
  const [contractType, setContractType] = useState('CALL');
  const [direction, setDirection] = useState('LONG');
  const [contracts, setContracts] = useState('');
  const [strike, setStrike] = useState('');
  const [premium, setPremium] = useState('');
  const [expiration, setExpiration] = useState('');
  const [tradeDate, setTradeDate] = useState(today());
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ticker || !contracts || !strike || !premium || !expiration || !tradeDate) return;
    
    const upperTicker = ticker.trim().toUpperCase();
    
    await addOption({
      ticker: upperTicker,
      type: contractType,
      direction,
      contracts: Number(contracts),
      strike: Number(strike),
      premium: Number(premium),
      expiration,
      tradeDate
    });
    
    navigate('/myoptions');
  };

  return (
    <div className="newoption-container pwa-container">
      <h1 className="newoption-title">Add New Option</h1>
      <form className="newoption-form" onSubmit={handleSubmit}>
        <label>
          Underlying Ticker
          <input 
            type="text" 
            value={ticker} 
            onChange={e => setTicker(e.target.value.toUpperCase())} 
            required 
            maxLength={8} 
          />
        </label>
        
        <label>
          Contract Type
          <select 
            value={contractType} 
            onChange={e => setContractType(e.target.value)} 
            required
          >
            <option value="CALL">Call</option>
            <option value="PUT">Put</option>
          </select>
        </label>
        
        <label>
          Direction
          <select 
            value={direction} 
            onChange={e => setDirection(e.target.value)} 
            required
          >
            <option value="LONG">Long</option>
            <option value="SHORT">Short</option>
          </select>
        </label>
        
        <label>
          Contracts
          <input 
            type="number" 
            min="1" 
            step="1" 
            value={contracts} 
            onChange={e => setContracts(e.target.value)} 
            required 
          />
        </label>
        
        <label>
          Strike Price
          <input 
            type="number" 
            min="0.01" 
            step="0.01" 
            value={strike} 
            onChange={e => setStrike(e.target.value)} 
            required 
          />
        </label>
        
        <label>
          Premium per Contract
          <input 
            type="number" 
            min="0.01" 
            step="0.01" 
            value={premium} 
            onChange={e => setPremium(e.target.value)} 
            required 
          />
        </label>
        
        <label>
          Expiration Date
          <input 
            type="date" 
            value={expiration} 
            onChange={e => setExpiration(e.target.value)} 
            required 
          />
        </label>
        
        <label>
          Trade Date
          <input 
            type="date" 
            value={tradeDate} 
            onChange={e => setTradeDate(e.target.value)} 
            required 
          />
        </label>
        
        <div className="newoption-actions">
          <button className="add-option-btn modern-button" type="submit">Add Option</button>
          <button 
            className="cancel-option-btn modern-button" 
            type="button" 
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewOptionPage; 