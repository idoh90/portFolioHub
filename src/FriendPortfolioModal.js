import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import './FriendPortfolioModal.css';

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
  const [stats, setStats] = useState({
    totalValue: 0,
    totalPL: 0,
    dailyPL: 0,
    lastUpdated: new Date().toLocaleString()
  });

  // Define fetchData as a callback so it can be called from UI
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Special cleanup for Ofek
      if (friend.friendName === 'Ofek' && window.cleanupOfekMockData) {
        try {
          window.cleanupOfekMockData();
        } catch (e) {
          console.error("Error cleaning up Ofek data:", e);
        }
      }
      
      // If purgeAllMockData is available, use it
      if (window.purgeAllMockData) {
        try {
          window.purgeAllMockData();
        } catch (e) {
          console.error("Error purging all mock data:", e);
        }
      }
      
      let totalValue = 0;
      let totalCost = 0;
      let yesterdayValue = 0;

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
            console.log(`Found ${friendSellActivities.length} sell activities for ${friend.friendName}`);
          }
        }
      } catch (activityError) {
        console.error("Error checking activity feed:", activityError);
      }

      // Get positions from localStorage
      try {
        const storedPositions = localStorage.getItem(`positions_${friend.friendName}`);
        if (storedPositions) {
          const parsedPositions = JSON.parse(storedPositions);
          
          // Filter out positions with no lots or empty lots arrays
          const validPositions = parsedPositions.filter(pos => 
            pos && pos.ticker && pos.lots && Array.isArray(pos.lots) && pos.lots.length > 0
          );
          
          // Further validate against activity feed
          const activityData = localStorage.getItem('activityFeed');
          let filteredPositions = validPositions;
          
          if (activityData) {
            const activities = JSON.parse(activityData);
            const friendSellActivities = activities.filter(
              activity => activity.user === friend.friendName && activity.action === 'sold' && activity.type === 'stock'
            );
            
            if (friendSellActivities.length > 0) {
              // Remove sold positions
              filteredPositions = validPositions.filter(position => {
                const soldActivity = friendSellActivities.find(
                  activity => activity.ticker === position.ticker
                );
                return !soldActivity;
              });
            }
          }
          
          setPositions(filteredPositions);

          // Calculate portfolio stats from real position data
          filteredPositions.forEach(position => {
            if (!position.lots) return;
            
            position.lots.forEach(lot => {
              if (!lot) return;
              
              const shares = Number(lot.shares) || 0;
              const buyPrice = Number(lot.price) || 0;
              const currentPrice = Number(lot.currentPrice) || buyPrice;
              
              if (shares <= 0 || buyPrice <= 0) return; // Skip invalid data
              
              const lotValue = shares * currentPrice;
              const lotCost = shares * buyPrice;
              const lotYesterdayValue = shares * (currentPrice * 0.99); // Approximate yesterday's value
              
              totalValue += lotValue;
              totalCost += lotCost;
              yesterdayValue += lotYesterdayValue;
            });
          });
        } else {
          setPositions([]);
        }
      } catch (posError) {
        console.error("Error parsing positions for friend:", friend.friendName, posError);
        setPositions([]);
      }

      // Get options from localStorage
      try {
        const storedOptions = localStorage.getItem(`options_${friend.friendName}`);
        if (storedOptions) {
          const parsedOptions = JSON.parse(storedOptions);
          const validOptions = Array.isArray(parsedOptions) ? parsedOptions : [];
          
          // Further validate against activity feed
          const activityData = localStorage.getItem('activityFeed');
          let filteredOptions = validOptions;
          
          if (activityData) {
            const activities = JSON.parse(activityData);
            const friendSellActivities = activities.filter(
              activity => activity.user === friend.friendName && activity.action === 'sold' && activity.type === 'option'
            );
            
            if (friendSellActivities.length > 0) {
              // Remove sold options
              filteredOptions = validOptions.filter(option => {
                const soldActivity = friendSellActivities.find(
                  activity => activity.ticker === option.ticker && activity.optionType === option.type
                );
                return !soldActivity;
              });
            }
          }
          
          setOptions(filteredOptions);
          
          // Add options value to total stats
          if (filteredOptions.length > 0) {
            filteredOptions.forEach(option => {
              if (!option) return;
              
              const contracts = Number(option.contracts) || 0;
              const strike = Number(option.strike) || 0;
              const premium = Number(option.premium) || 0;
              
              if (contracts <= 0 || premium <= 0) return; // Skip invalid data
              
              // Simple calculation for demonstration - this would be more complex in reality
              const optionValue = contracts * premium * 100; // Each contract is 100 shares
              const optionCost = contracts * premium * 100;
              const optionYesterdayValue = optionValue * 0.99; // Approximate
              
              totalValue += optionValue;
              totalCost += optionCost;
              yesterdayValue += optionYesterdayValue;
            });
          }
        } else {
          setOptions([]);
        }
      } catch (optError) {
        console.error("Error parsing options for friend:", friend.friendName, optError);
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
  }, [friend.friendName]);

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