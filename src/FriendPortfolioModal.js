import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import './FriendPortfolioModal.css';
import { getQuote } from './api/quote';
import { useLastOnlineTime, formatTimeSince } from './Hub';
import { ref, get, set, serverTimestamp } from 'firebase/database';
import { db } from './firebase';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

// Generate random yet consistent colors for the pie chart
const generateColors = (count) => {
  const colors = [];
  const baseHues = [200, 160, 120, 280, 40, 320, 80, 0, 240];
  
  for (let i = 0; i < count; i++) {
    const hue = baseHues[i % baseHues.length];
    const lightness = 50 + (i * 3) % 20;
    colors.push(`hsl(${hue}, 70%, ${lightness}%)`);
  }
  
  return colors;
};

const formatCurrency = (value) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const getColor = (value) => (value >= 0 ? 'pos' : 'neg');

const FriendPortfolioModal = ({ friend, onClose }) => {
  const [positions, setPositions] = useState([]);
  const [options, setOptions] = useState([]);
  const [activeTab, setActiveTab] = useState('stocks');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [takenPL, setTakenPL] = useState({
    stocks: 0,
    options: 0
  });
  const [stats, setStats] = useState({
    totalValue: 0,
    totalPL: 0,
    dailyPL: 0,
    lastUpdated: new Date().toLocaleString()
  });
  
  // Get friend's online status
  const { lastOnline, isOnline } = useLastOnlineTime(friend.friendName);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  
  // Function to refresh the online status explicitly
  const refreshOnlineStatus = useCallback(() => {
    setRefreshingStatus(true);
    const friendStatusRef = ref(db, `userStatus/${friend.friendName}`);
    
    get(friendStatusRef).then(snapshot => {
      setTimeout(() => setRefreshingStatus(false), 800);
    }).catch(error => {
      console.error(`Error checking friend status in modal:`, error);
      setRefreshingStatus(false);
    });
  }, [friend.friendName]);
  
  // Refresh status when modal opens
  useEffect(() => {
    refreshOnlineStatus();
  }, [refreshOnlineStatus]);

  // Define fetchData as a callback so it can be called from UI
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      
      // Refresh online status
      refreshOnlineStatus();
      
      let totalValue = 0;
      let totalCost = 0;
      let yesterdayValue = 0;

      // Get taken P/L values from localStorage
      try {
        // Try to fetch taken P/L values from localStorage
        const stocksTakenPLKey = `takenPL_${friend.friendName}`;
        const optionsTakenPLKey = `optionsTakenPL_${friend.friendName}`;
        
        const stocksTakenPL = localStorage.getItem(stocksTakenPLKey) ? 
          Number(localStorage.getItem(stocksTakenPLKey)) : 0;
        
        const optionsTakenPL = localStorage.getItem(optionsTakenPLKey) ? 
          Number(localStorage.getItem(optionsTakenPLKey)) : 0;
        
        setTakenPL({
          stocks: stocksTakenPL,
          options: optionsTakenPL
        });
      } catch (error) {
        console.error("Error fetching taken P/L values:", error);
        setTakenPL({
          stocks: 0,
          options: 0
        });
      }

      // Fetch data directly from Firebase for the current friend
      // First fetch stock positions
      try {
        const positionsRef = ref(db, `positions/${friend.friendName}`);
        const positionsSnapshot = await get(positionsRef);
        
        if (positionsSnapshot.exists()) {
          const positionsData = positionsSnapshot.val();
          // Convert object to array
          const positionsArray = Object.values(positionsData);
          
          // Filter out positions with no lots or empty lots arrays
          const validPositions = positionsArray.filter(pos => 
            pos && pos.ticker && pos.lots && Array.isArray(pos.lots) && pos.lots.length > 0
          );

          // Fetch current stock prices for each position
          const updatedPositions = await Promise.all(validPositions.map(async position => {
            try {
              // Use the getQuote API to fetch current prices
              const tickerPrice = await getQuote(position.ticker);
              if (tickerPrice && tickerPrice > 0) {
                return {
                  ...position,
                  currentPrice: tickerPrice
                };
              }
              return position;
            } catch (e) {
              console.error(`Error fetching price for ${position.ticker}:`, e);
              return position;
            }
          }));
          
          setPositions(updatedPositions);

          // Calculate portfolio stats from real position data
          updatedPositions.forEach(position => {
            if (!position.lots) return;
            
            position.lots.forEach(lot => {
              if (!lot) return;
              
              const shares = Number(lot.shares) || 0;
              const buyPrice = Number(lot.price) || 0;
              const currentPrice = Number(position.currentPrice) || buyPrice;
              
              if (shares <= 0 || buyPrice <= 0) return; // Skip invalid data
              
              const lotValue = shares * currentPrice;
              const lotCost = shares * buyPrice;
              const lotYesterdayValue = shares * (currentPrice * 0.99); // Approximate yesterday's value
              
              totalValue += lotValue;
              totalCost += lotCost;
              yesterdayValue += lotYesterdayValue;
            });
          });
          
          // Update localStorage with the latest data from Firebase
          localStorage.setItem(`positions_${friend.friendName}`, JSON.stringify(updatedPositions));
        } else {
          setPositions([]);
          localStorage.removeItem(`positions_${friend.friendName}`);
        }
      } catch (posError) {
        console.error("Error fetching positions for friend:", friend.friendName, posError);
        setPositions([]);
      }

      // First check activity feed for recent sells
      try {
        const activityData = localStorage.getItem('activityFeed');
        if (activityData) {
          const activities = JSON.parse(activityData);
          const friendSellActivities = activities.filter(
            activity => activity.user === friend.friendName && activity.action === 'sold'
          );
          
          // If there are sell activities, process them
          if (friendSellActivities.length > 0) {
            // We'll use these to filter out sold stocks/options
          }
        }
      } catch (activityError) {
        console.error("Error checking activity feed:", activityError);
      }

      // Fetch options directly from Firebase
      try {
        const optionsRef = ref(db, `options/${friend.friendName}`);
        const optionsSnapshot = await get(optionsRef);
        
        if (optionsSnapshot.exists()) {
          const optionsData = optionsSnapshot.val();
          // Convert object to array if needed
          const optionsArray = Array.isArray(optionsData) ? optionsData : Object.values(optionsData);
          
          // Ensure valid options
          const validOptions = optionsArray.filter(option => 
            option && option.ticker && option.strike && option.expiration
          );
          
          setOptions(validOptions);
          
          // Update localStorage with the latest data
          localStorage.setItem(`options_${friend.friendName}`, JSON.stringify(validOptions));
          
          // Add options value to total portfolio value
          validOptions.forEach(option => {
            const contracts = Number(option.contracts) || 0;
            const currentPrice = Number(option.currentPrice) || 0;
            
            if (contracts <= 0 || currentPrice <= 0) return;
            
            // Each contract represents 100 shares
            const optionValue = contracts * currentPrice * 100;
            totalValue += optionValue;
            
            // Add to yesterday's value with a small variance
            const yesterdayOptionPrice = currentPrice * 0.98; // Assume 2% change
            const yesterdayOptionValue = contracts * yesterdayOptionPrice * 100;
            yesterdayValue += yesterdayOptionValue;
          });
        } else {
          setOptions([]);
          localStorage.removeItem(`options_${friend.friendName}`);
        }
      } catch (optError) {
        console.error("Error fetching options for friend:", friend.friendName, optError);
        setOptions([]);
      }

      const totalPL = totalValue - totalCost;
      const plPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
      const dailyPL = yesterdayValue > 0 ? ((totalValue - yesterdayValue) / yesterdayValue) * 100 : 0;

      setStats({
        totalValue,
        totalPL,
        plPercent,
        dailyPL,
        lastUpdated: new Date().toLocaleString()
      });

      setLoading(false);
    } catch (error) {
      console.error("Error loading friend portfolio data:", error);
      setLoading(false);
    }
  }, [friend.friendName, refreshOnlineStatus]);

  // Helper function to get real-time stock prices
  const getStockPrice = async (ticker) => {
    try {
      return await getQuote(ticker);
    } catch (error) {
      console.error(`Error fetching price for ${ticker}:`, error);
      return 0;
    }
  };

  // Load the friend's portfolio data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate average buy price for each position
  const positionsWithAvgPrice = useMemo(() => {
    return positions.map(position => {
      const totalShares = position.lots.reduce((sum, lot) => sum + Number(lot.shares), 0);
      const totalCost = position.lots.reduce((sum, lot) => sum + (Number(lot.shares) * Number(lot.price)), 0);
      const avgPrice = totalShares > 0 ? totalCost / totalShares : 0;
      const currentPrice = position.currentPrice || avgPrice;
      const totalValue = totalShares * currentPrice;
      const unrealizedPL = totalValue - totalCost;
      const unrealizedPLPercent = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0;
      
      return {
        ...position,
        totalShares,
        avgPrice,
        currentPrice,
        totalValue,
        unrealizedPL,
        unrealizedPLPercent
      };
    });
  }, [positions]);

  // Prepare pie chart data
  const chartData = useMemo(() => {
    const labels = positionsWithAvgPrice.map(p => p.ticker);
    const data = positionsWithAvgPrice.map(p => p.totalValue);
    const backgroundColor = generateColors(positionsWithAvgPrice.length);
    
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderWidth: 1,
          borderColor: '#2a2a2a'
        }
      ]
    };
  }, [positionsWithAvgPrice]);

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: {
          color: '#fff',
          boxWidth: 10,
          font: {
            size: 10
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.raw;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
          }
        }
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="friend-portfolio-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>×</button>
        
        <div className="modal-header">
          <h2>{friend.friendName}'s Portfolio</h2>
          <div className="friend-online-status">
            <button 
              className="status-refresh-button modal-status-refresh" 
              onClick={refreshOnlineStatus}
              disabled={refreshingStatus}
              title="Refresh online status"
            >
              {refreshingStatus ? "⌛" : "↻"}
            </button>
            <span className="online-indicator">{isOnline ? '🟢 Online now' : '⚪ Offline'}</span>
            {!isOnline && lastOnline && <span className="last-online">Last seen: {formatTimeSince(lastOnline)}</span>}
          </div>
          <div className="modal-actions">
            <button 
              className="refresh-button" 
              onClick={() => fetchData()}
              disabled={loading}
              title="Refresh data"
            >
              ↻ Refresh
            </button>
            <div className="last-updated">Last updated: {stats.lastUpdated}</div>
          </div>
        </div>
        
        {loading ? (
          <div className="loading-container">Loading portfolio data...</div>
        ) : positions.length === 0 && options.length === 0 ? (
          <div className="loading-container">No portfolio data available</div>
        ) : (
          <>
            <div className="portfolio-snapshot">
              <div className="snapshot-row">
                <div className="snapshot-item total-value">
                  <div className="label">Total Value</div>
                  <div className="value">{formatCurrency(stats.totalValue)}</div>
                </div>
              </div>
              
              <div className="snapshot-row">
                <div className="snapshot-item">
                  <div className="label">Total P/L</div>
                  <div className={`value ${stats.totalPL >= 0 ? 'pos' : 'neg'}`}>
                    {stats.totalPL >= 0 ? '+' : ''}{formatCurrency(stats.totalPL)} 
                    ({stats.plPercent ? stats.plPercent.toFixed(2) : '0.00'}%)
                  </div>
                </div>
                
                <div className="snapshot-item">
                  <div className="label">Daily P/L</div>
                  <div className={`value ${stats.dailyPL >= 0 ? 'pos' : 'neg'}`}>
                    {stats.dailyPL >= 0 ? '+' : ''}{stats.dailyPL.toFixed(2)}%
                  </div>
                </div>
              </div>
              
              <div className="snapshot-row">
                <div className="snapshot-item">
                  <div className="label">Stocks Taken P/L</div>
                  <div className={`value ${takenPL.stocks >= 0 ? 'pos' : 'neg'}`}>
                    {takenPL.stocks >= 0 ? '+' : ''}{formatCurrency(takenPL.stocks)}
                  </div>
                </div>
                
                <div className="snapshot-item">
                  <div className="label">Options Taken P/L</div>
                  <div className={`value ${takenPL.options >= 0 ? 'pos' : 'neg'}`}>
                    {takenPL.options >= 0 ? '+' : ''}{formatCurrency(takenPL.options)}
                  </div>
                </div>
              </div>
              
              <div className="snapshot-row">
                <div className="snapshot-item">
                  <div className="label">Total Taken P/L</div>
                  <div className={`value ${(takenPL.stocks + takenPL.options) >= 0 ? 'pos' : 'neg'}`}>
                    {(takenPL.stocks + takenPL.options) >= 0 ? '+' : ''}{formatCurrency(takenPL.stocks + takenPL.options)}
                  </div>
                </div>
              </div>
            </div>
            
            {positions.length > 0 && (
              <div className="allocation-section">
                <h3>Portfolio Allocation</h3>
                <div className="pie-chart-container">
                  <Pie data={chartData} options={chartOptions} />
                </div>
              </div>
            )}
            
            <div className="tabs-container">
              <div className="tabs">
                <button 
                  className={`tab-button ${activeTab === 'stocks' ? 'active' : ''}`}
                  onClick={() => setActiveTab('stocks')}
                >
                  Stocks {positions.length > 0 && `(${positions.length})`}
                </button>
                <button 
                  className={`tab-button ${activeTab === 'options' ? 'active' : ''}`}
                  onClick={() => setActiveTab('options')}
                >
                  Options {options.length > 0 && `(${options.length})`}
                </button>
              </div>
              
              {activeTab === 'stocks' && positions.length > 0 && (
                <div className="positions-section">
                  <div className="positions-table-container">
                    <table className="positions-table">
                      <thead>
                        <tr>
                          <th>Ticker</th>
                          <th>Shares</th>
                          <th>Avg Price</th>
                          <th>Current</th>
                          <th>P/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positionsWithAvgPrice.map((position, index) => (
                          <tr key={index}>
                            <td className="ticker-cell">{position.ticker}</td>
                            <td>{position.totalShares}</td>
                            <td>{formatCurrency(position.avgPrice)}</td>
                            <td>{formatCurrency(position.currentPrice)}</td>
                            <td className={position.unrealizedPL >= 0 ? 'pos' : 'neg'}>
                              {position.unrealizedPL >= 0 ? '+' : ''}
                              {formatCurrency(position.unrealizedPL)} 
                              <span className="pl-percent">
                                ({position.unrealizedPLPercent >= 0 ? '+' : ''}
                                {position.unrealizedPLPercent.toFixed(2)}%)
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {activeTab === 'options' && (
                <div className="options-section">
                  {options.length === 0 ? (
                    <div className="no-options-message">No options in portfolio</div>
                  ) : (
                    <div className="options-list">
                      {options.map((option, index) => (
                        <div key={index} className={`option-card ${option.type?.toLowerCase()}`}>
                          <div className="option-header">
                            <span className="option-ticker">{option.ticker} {option.type}</span>
                            <span className="option-direction">{option.direction}</span>
                          </div>
                          <div className="option-details">
                            <div className="option-detail">
                              <span className="detail-label">Contracts:</span>
                              <span className="detail-value">{option.contracts}</span>
                            </div>
                            <div className="option-detail">
                              <span className="detail-label">Strike:</span>
                              <span className="detail-value">${option.strike}</span>
                            </div>
                            <div className="option-detail">
                              <span className="detail-label">Premium:</span>
                              <span className="detail-value">${option.premium}/contract</span>
                            </div>
                            <div className="option-detail">
                              <span className="detail-label">Total Value:</span>
                              <span className="detail-value">${(option.premium * option.contracts * 100).toFixed(2)}</span>
                            </div>
                            <div className="option-detail">
                              <span className="detail-label">Expiration:</span>
                              <span className="detail-value">{new Date(option.expiration).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FriendPortfolioModal; 