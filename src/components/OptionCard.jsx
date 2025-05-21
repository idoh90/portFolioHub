import React from 'react';
import './OptionCard.css';

function getDaysRemaining(expirationDate) {
  const now = new Date();
  const expDate = new Date(expirationDate);
  const diffTime = Math.abs(expDate - now);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

const OptionCard = ({ option, onClick }) => {
  const { 
    ticker, 
    type, 
    direction, 
    contracts, 
    strike, 
    premium, 
    expiration
  } = option;
  
  const daysRemaining = getDaysRemaining(expiration);
  const totalCost = direction === 'LONG' 
    ? contracts * premium * 100 
    : -contracts * premium * 100;
  
  // For simple P/L - would need live data for real P/L
  const currentPL = 0; // Placeholder, would be calculated with market data
  
  return (
    <div className={`option-card flash-card ${type.toLowerCase()}`} onClick={onClick} tabIndex={0} role="button">
      <div className="option-header">
        <div className="option-ticker huge">{ticker}</div>
        <div className={`option-badge ${type.toLowerCase()}`}>{type}</div>
      </div>
      
      <div className="option-details">
        <span>
          {contracts} × {direction.toLowerCase() === 'long' ? 'Long' : 'Short'} 
          @ ${premium}/contract
        </span>
        <span>Strike: ${strike}</span>
        <span>Exp: {formatDate(expiration)} ({daysRemaining} days)</span>
      </div>
      
      <div className="option-extra-details">
        <span>Total: ${Math.abs(totalCost).toFixed(2)}</span>
        <span className={direction.toLowerCase()}>
          {direction === 'LONG' ? 'Long position' : 'Short position'}
        </span>
      </div>
      
      <div className="option-pl">
        <span>Unrealized P/L: </span>
        <span className={currentPL >= 0 ? "pos" : "neg"}>
          {currentPL >= 0 ? "+" : ""}${currentPL.toFixed(2)}
        </span>
      </div>
    </div>
  );
};

export default OptionCard; 