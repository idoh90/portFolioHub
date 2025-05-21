import React, { useState, useEffect } from 'react';
import './FriendPortfolioModal.css';

const FriendPortfolioModal = ({ friend, onClose }) => {
  const [positions, setPositions] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = () => {
      try {
        // Load positions
        const posKey = `positions_${friend.friendName}`;
        const posData = localStorage.getItem(posKey);
        if (posData) {
          const parsedPositions = JSON.parse(posData);
          setPositions(parsedPositions.filter(pos => pos.lots && pos.lots.length > 0));
        }

        // Load options
        const optKey = `options_${friend.friendName}`;
        const optData = localStorage.getItem(optKey);
        if (optData) {
          setOptions(JSON.parse(optData));
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading friend portfolio:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [friend.friendName]);

  const formatCurrency = (value) =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="friend-portfolio-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{friend.friendName}'s Portfolio</h2>
          <button className="close-modal-btn" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <div className="portfolio-content">
            {positions.length > 0 && (
              <div className="portfolio-section">
                <h3>Stocks</h3>
                <div className="positions-list">
                  {positions.map((position, idx) => (
                    <div key={idx} className="position-item">
                      <div className="position-header">
                        <span className="ticker">{position.ticker}</span>
                        <span className="shares">{position.lots.reduce((sum, lot) => sum + Number(lot.shares), 0)} shares</span>
                      </div>
                      <div className="position-details">
                        <span>Avg: ${position.lots.reduce((sum, lot) => sum + Number(lot.price), 0) / position.lots.length}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {options.length > 0 && (
              <div className="portfolio-section">
                <h3>Options</h3>
                <div className="options-list">
                  {options.map((option, idx) => (
                    <div key={idx} className={`option-item ${option.type.toLowerCase()}`}>
                      <div className="option-header">
                        <span className="ticker">{option.ticker} {option.type}</span>
                        <span className="contracts">{option.contracts} contracts</span>
                      </div>
                      <div className="option-details">
                        <span>Strike: ${option.strike}</span>
                        <span>Premium: ${option.premium}</span>
                        <span>Exp: {new Date(option.expiration).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {positions.length === 0 && options.length === 0 && (
              <div className="empty-portfolio">
                No positions or options found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendPortfolioModal; 