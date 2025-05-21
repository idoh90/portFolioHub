import React, { useState, useEffect, useMemo } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalValue: 0,
    totalPL: 0,
    dailyPL: 0,
    lastUpdated: new Date().toLocaleString()
  });

  // Load the friend's portfolio data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get positions from localStorage
        const storedPositions = localStorage.getItem(`positions_${friend.friendName}`);
        if (!storedPositions) {
          console.error("No portfolio data found for friend:", friend.friendName);
          setLoading(false);
          return;
        }

        const parsedPositions = JSON.parse(storedPositions);
        
        // Filter out positions with no lots or empty lots arrays
        const validPositions = parsedPositions.filter(pos => pos.lots && pos.lots.length > 0);
        setPositions(validPositions);

        // Calculate portfolio stats from real position data
        let totalValue = 0;
        let totalCost = 0;
        let yesterdayValue = 0;

        validPositions.forEach(position => {
          position.lots.forEach(lot => {
            const shares = Number(lot.shares);
            const buyPrice = Number(lot.price);
            const currentPrice = Number(lot.currentPrice || buyPrice);
            
            const lotValue = shares * currentPrice;
            const lotCost = shares * buyPrice;
            const lotYesterdayValue = shares * (currentPrice * 0.99); // Approximate yesterday's value
            
            totalValue += lotValue;
            totalCost += lotCost;
            yesterdayValue += lotYesterdayValue;
          });
        });

        const totalPL = totalValue - totalCost;
        const plPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
        const dailyPL = totalValue > 0 ? ((totalValue - yesterdayValue) / yesterdayValue) * 100 : 0;

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
    };
    
    fetchData();
  }, [friend.friendName]);

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
          <div className="last-updated">Last updated: {stats.lastUpdated}</div>
        </div>
        
        {loading ? (
          <div className="loading-container">Loading portfolio data...</div>
        ) : positions.length === 0 ? (
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
            
            <div className="allocation-section">
              <h3>Portfolio Allocation</h3>
              <div className="pie-chart-container">
                <Pie data={chartData} options={chartOptions} />
              </div>
            </div>
            
            <div className="positions-section">
              <h3>Positions</h3>
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
          </>
        )}
      </div>
    </div>
  );
};

export default FriendPortfolioModal; 