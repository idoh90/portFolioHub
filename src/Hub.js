import React, { useContext, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { PositionsContext } from './PositionsContext';
import { useQuote } from './api/useQuote';
import { getQuote } from './api/quote';
import './Hub.css';
import FriendPortfolioModal from './FriendPortfolioModal';
import ActivityFeed from './ActivityFeed';
import { OptionsContext } from './OptionsContext';

// Utility to calculate average buy price for a ticker from transactions
function calculateAvgBuyPrice(transactions, ticker) {
  const filtered = transactions.filter(tx => tx.ticker === ticker && tx.type === 'buy');
  const totalShares = filtered.reduce((sum, tx) => sum + tx.shares, 0);
  const totalCost = filtered.reduce((sum, tx) => sum + tx.shares * tx.price, 0);
  return totalShares ? (totalCost / totalShares) : 0;
}

// Mock Data
const mockArticles = [
  {
    headline: 'Stocks Rally as Tech Leads Market Gains',
    source: 'Bloomberg',
    url: 'https://bloomberg.com/article1',
  },
  {
    headline: 'Crypto Surges After Regulatory Clarity',
    source: 'CoinDesk',
    url: 'https://coindesk.com/article2',
  },
  {
    headline: 'Fed Signals No Rate Hike in Q3',
    source: 'Reuters',
    url: 'https://reuters.com/article3',
  },
  {
    headline: 'AI Startups Attract Record Funding',
    source: 'TechCrunch',
    url: 'https://techcrunch.com/article4',
  },
  {
    headline: 'Oil Prices Dip Amid Global Uncertainty',
    source: 'WSJ',
    url: 'https://wsj.com/article5',
  },
];

const mockFriends = [
  {
    friendName: 'Yanai',
    portfolioValue: 45200,
    transactions: [
      { ticker: 'AAPL', shares: 10, price: 140, type: 'buy' },
      { ticker: 'AAPL', shares: 5, price: 150, type: 'buy' },
      { ticker: 'TSLA', shares: 7, price: 200, type: 'buy' },
      { ticker: 'TSLA', shares: 3, price: 220, type: 'buy' },
      { ticker: 'NVDA', shares: 4, price: 370, type: 'buy' },
      { ticker: 'NVDA', shares: 2, price: 400, type: 'buy' },
    ],
    top3Positions: [
      { ticker: 'AAPL', percent: 32 },
      { ticker: 'TSLA', percent: 21 },
      { ticker: 'NVDA', percent: 14 },
    ],
  },
  {
    friendName: 'Ido',
    portfolioValue: 38900,
    transactions: [
      { ticker: 'AMZN', shares: 8, price: 115, type: 'buy' },
      { ticker: 'AMZN', shares: 4, price: 130, type: 'buy' },
      { ticker: 'GOOGL', shares: 6, price: 95, type: 'buy' },
      { ticker: 'GOOGL', shares: 3, price: 105, type: 'buy' },
      { ticker: 'META', shares: 5, price: 230, type: 'buy' },
      { ticker: 'META', shares: 2, price: 260, type: 'buy' },
    ],
    top3Positions: [
      { ticker: 'AMZN', percent: 28 },
      { ticker: 'GOOGL', percent: 19 },
      { ticker: 'META', percent: 17 },
    ],
  },
  {
    friendName: 'Ofek',
    portfolioValue: 51200,
    transactions: [
      { ticker: 'MSFT', shares: 12, price: 250, type: 'buy' },
      { ticker: 'MSFT', shares: 6, price: 270, type: 'buy' },
      { ticker: 'NFLX', shares: 3, price: 330, type: 'buy' },
      { ticker: 'NFLX', shares: 2, price: 350, type: 'buy' },
      { ticker: 'AMD', shares: 7, price: 105, type: 'buy' },
      { ticker: 'AMD', shares: 3, price: 120, type: 'buy' },
    ],
    top3Positions: [
      { ticker: 'MSFT', percent: 35 },
      { ticker: 'NFLX', percent: 18 },
      { ticker: 'AMD', percent: 13 },
    ],
  },
  {
    friendName: 'Megi',
    portfolioValue: 47000,
    transactions: [
      { ticker: 'AAPL', shares: 8, price: 142, type: 'buy' },
      { ticker: 'TSLA', shares: 6, price: 215, type: 'buy' },
      { ticker: 'NVDA', shares: 5, price: 390, type: 'buy' },
    ],
    top3Positions: [
      { ticker: 'AAPL', percent: 30 },
      { ticker: 'TSLA', percent: 22 },
      { ticker: 'NVDA', percent: 15 },
    ],
  },
];

// Custom hook to manage user's online status
function useOnlineStatus(username) {
  useEffect(() => {
    if (!username) return;

    // Update last online time when component mounts (user enters site)
    const updateLastOnline = () => {
      const timestamp = new Date().toISOString();
      localStorage.setItem(`lastOnline_${username}`, timestamp);
    };

    // Update on mount (when user enters site)
    updateLastOnline();

    // Set up interval to update timestamp periodically while user is active
    const interval = setInterval(updateLastOnline, 60000); // Update every minute

    // Update on window focus
    const handleFocus = () => {
      updateLastOnline();
    };

    // Update before user leaves
    const handleBeforeUnload = () => {
      updateLastOnline();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [username]);
}

// Hook to get last online time for a user
function useLastOnlineTime(username) {
  const [lastOnline, setLastOnline] = useState(null);

  useEffect(() => {
    const getLastOnline = () => {
      const timestamp = localStorage.getItem(`lastOnline_${username}`);
      setLastOnline(timestamp ? new Date(timestamp) : null);
    };

    // Get initial value
    getLastOnline();

    // Set up interval to check for updates
    const interval = setInterval(getLastOnline, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [username]);

  return lastOnline;
}

// Helper function to format time since
function formatTimeSince(date) {
  if (!date) return 'Never';
  
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  
  if (seconds < 10) return "Just now";
  
  return Math.floor(seconds) + "s ago";
}

// Data hooks (stubs)
export function useNews() {
  return mockArticles;
}

export function useFriends() {
  return mockFriends;
}

const formatCurrency = (value) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const getColor = (value) => (value >= 0 ? 'pos' : 'neg');

const NewsFeed = ({ articles }) => (
  <div className="newsfeed-container">
    {articles.map((article, idx) => (
      <a
        className="news-card"
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        key={idx}
      >
        <div className="news-headline">{article.headline}</div>
        <div className="news-source">{article.source}</div>
      </a>
    ))}
  </div>
);

// Custom hook to fetch all quotes for an array of tickers
function useQuotesForTickers(tickers) {
  const [quotes, setQuotes] = useState({});

  // Fetch all quotes
  const fetchAll = async () => {
    console.log('Tickers to fetch:', tickers);
    const results = {};
    for (const ticker of tickers) {
      console.log('Fetching quote for', ticker);
      results[ticker] = { price: null, loading: true };
      const price = await getQuote(ticker);
      results[ticker] = { price, loading: false };
    }
    setQuotes(results);
  };

  useEffect(() => {
    let isMounted = true;
    setQuotes({}); // reset
    fetchAll();
    let timer = setInterval(() => {
      if (isMounted) fetchAll();
    }, 5 * 60 * 1000); // 5 minutes
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [tickers.join(',')]);

  return quotes;
}

function usePortfolioStats(positions) {
  const { options } = useContext(OptionsContext);
  const [stats, setStats] = useState({
    totalValue: 0,
    totalPL: 0,
    dailyPL: 0,
    hasLiveData: true
  });

  // Get all unique tickers from positions and options
  const tickers = useMemo(() => {
    const stockTickers = positions.map(pos => pos.ticker);
    const optionTickers = options ? options.map(opt => opt.ticker) : [];
    return [...new Set([...stockTickers, ...optionTickers])];
  }, [positions, options]);

  const quotes = useQuotesForTickers(tickers);

  useEffect(() => {
    let totalValue = 0;
    let totalCost = 0;
    let yesterdayValue = 0;
    let hasLiveData = true;

    // Calculate stock values
    positions.forEach(pos => {
      const quote = quotes[pos.ticker];
      if (!quote || quote.loading || quote.price === null) {
        hasLiveData = false;
      }
      pos.lots.forEach(lot => {
        const lotValue = Number(lot.shares) * (quote?.price || Number(lot.price));
        totalValue += lotValue;
        totalCost += Number(lot.shares) * Number(lot.price);
        // For dailyPL, use yesterday's price (1% less for now)
        yesterdayValue += Number(lot.shares) * (Number(lot.price) * 0.99);
      });
    });

    // Calculate option values
    if (options && options.length > 0) {
      options.forEach(opt => {
        const quote = quotes[opt.ticker];
        if (!quote || quote.loading || quote.price === null) {
          hasLiveData = false;
        }
        
        const contracts = Number(opt.contracts);
        const premium = Number(opt.premium);
        
        // For option value approximation (would use proper option pricing in real app)
        // Here we just use a simple approximation based on underlying price movement
        const currentPrice = quote?.price || 0;
        const buyPrice = Number(opt.strike);
        
        let optionValue = 0;
        const contractMultiplier = 100; // Each contract is for 100 shares
        
        if (opt.type === 'CALL') {
          if (opt.direction === 'LONG') {
            // For long calls: current value approximation
            optionValue = contracts * Math.max(0, currentPrice - buyPrice) * contractMultiplier;
            // Add time value approximation (simplified)
            if (optionValue === 0) optionValue = contracts * premium * contractMultiplier * 0.5;
          } else {
            // For short calls: potential liability
            optionValue = -contracts * Math.max(0, currentPrice - buyPrice) * contractMultiplier;
          }
        } else if (opt.type === 'PUT') {
          if (opt.direction === 'LONG') {
            // For long puts: current value approximation
            optionValue = contracts * Math.max(0, buyPrice - currentPrice) * contractMultiplier;
            // Add time value approximation (simplified)
            if (optionValue === 0) optionValue = contracts * premium * contractMultiplier * 0.5;
          } else {
            // For short puts: potential liability
            optionValue = -contracts * Math.max(0, buyPrice - currentPrice) * contractMultiplier;
          }
        }
        
        // Cost basis
        const optionCost = opt.direction === 'LONG' 
          ? contracts * premium * contractMultiplier 
          : -contracts * premium * contractMultiplier;
        
        // Yesterday approximation
        const optionYesterdayValue = optionValue * 0.99;
        
        totalValue += optionValue;
        totalCost += optionCost;
        yesterdayValue += optionYesterdayValue;
      });
    }

    const totalPL = totalValue - totalCost;
    const dailyPL = totalCost ? (((totalValue - yesterdayValue) / totalCost) * 100) : 0;
    
    setStats({
      totalValue,
      totalPL,
      dailyPL,
      hasLiveData
    });
  }, [positions, options, quotes]);

  return stats;
}

function useFriendPortfolioStats(friendName) {
  const [stats, setStats] = useState({
    totalValue: 0,
    totalPL: 0,
    dailyPL: 0,
    biggestStock: null,
    biggestStockValue: 0,
    hasLiveData: false
  });

  // Get positions and options from localStorage
  const positions = useMemo(() => {
    try {
      const key = `positions_${friendName}`;
      const posData = localStorage.getItem(key);
      if (!posData) return [];
      
      const parsedPositions = JSON.parse(posData);
      // Filter out positions with no lots or empty lots arrays
      return parsedPositions.filter(pos => pos.lots && pos.lots.length > 0);
    } catch (error) {
      console.error(`Error loading ${friendName}'s positions:`, error);
      return [];
    }
  }, [friendName]);

  const options = useMemo(() => {
    try {
      const key = `options_${friendName}`;
      const optionsData = localStorage.getItem(key);
      if (!optionsData) return [];
      
      return JSON.parse(optionsData);
    } catch (error) {
      console.error(`Error loading ${friendName}'s options:`, error);
      return [];
    }
  }, [friendName]);

  // Get all unique tickers from positions and options
  const tickers = useMemo(() => {
    const stockTickers = positions.map(pos => pos.ticker);
    const optionTickers = options.map(opt => opt.ticker);
    return [...new Set([...stockTickers, ...optionTickers])];
  }, [positions, options]);

  const quotes = useQuotesForTickers(tickers);

  useEffect(() => {
    let totalValue = 0;
    let totalCost = 0;
    let yesterdayValue = 0;
    let biggestStock = null;
    let biggestStockValue = 0;
    let hasLiveData = true;

    // Calculate stock values
    positions.forEach(pos => {
      const quote = quotes[pos.ticker];
      if (!quote || quote.loading || quote.price === null) {
        hasLiveData = false;
      }
      let posValue = 0;
      pos.lots.forEach(lot => {
        const shares = Number(lot.shares);
        const buyPrice = Number(lot.price);
        const currentPrice = quote?.price || buyPrice;
        
        const lotValue = shares * currentPrice;
        const lotCost = shares * buyPrice;
        // For yesterday's price, use 99% of current price as approximation
        const lotYesterdayValue = shares * (currentPrice * 0.99);
        
        totalValue += lotValue;
        totalCost += lotCost;
        yesterdayValue += lotYesterdayValue;
        posValue += lotValue;
      });
      if (posValue > biggestStockValue) {
        biggestStockValue = posValue;
        biggestStock = pos.ticker;
      }
    });

    // Calculate option values
    options.forEach(opt => {
      const quote = quotes[opt.ticker];
      if (!quote || quote.loading || quote.price === null) {
        hasLiveData = false;
      }
      const contracts = Number(opt.contracts);
      const premium = Number(opt.premium);
      const currentPrice = quote?.price || premium;
      
      // For options, we'll use a simple approximation of current value
      // In a real app, you'd want to use proper option pricing models
      const optionValue = contracts * currentPrice * 100;
      const optionCost = contracts * premium * 100;
      const optionYesterdayValue = contracts * (currentPrice * 0.99) * 100;
      
      totalValue += optionValue;
      totalCost += optionCost;
      yesterdayValue += optionYesterdayValue;
      
      if (optionValue > biggestStockValue) {
        biggestStockValue = optionValue;
        biggestStock = `${opt.ticker} ${opt.type}`;
      }
    });

    const totalPL = totalValue - totalCost;
    const plPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
    // Calculate daily P/L as percentage based on yesterday's value
    const dailyPL = yesterdayValue > 0 ? ((totalValue - yesterdayValue) / yesterdayValue) * 100 : 0;
    
    setStats({
      totalValue,
      totalPL,
      plPercent,
      dailyPL,
      biggestStock,
      biggestStockValue,
      hasLiveData
    });
  }, [positions, options, quotes]);

  return stats;
}

// Updated Friend card component with real last online time
const FriendCard = ({ friendName }) => {
  const stats = useFriendPortfolioStats(friendName);
  const [showModal, setShowModal] = useState(false);
  const lastOnlineTime = useLastOnlineTime(friendName);
  
  return (
    <>
      <div className="friend-card" onClick={() => setShowModal(true)}>
        <div className="friend-name">{friendName}</div>
        <div className="friend-portfolio-value">
          {stats.hasLiveData ? formatCurrency(stats.totalValue) : '--'}
        </div>
        <div className="friend-positions">
          <div className="friend-position">
            <span className="ticker">Total P/L</span>
            <span className={stats.totalPL >= 0 ? 'pos' : 'neg'}>
              {stats.hasLiveData ? `${stats.totalPL >= 0 ? '+' : ''}${formatCurrency(stats.totalPL)}` : '--'}
            </span>
          </div>
          <div className="friend-position">
            <span className="ticker">Daily P/L</span>
            <span className={stats.dailyPL >= 0 ? 'pos' : 'neg'}>
              {stats.hasLiveData ? `${stats.dailyPL >= 0 ? '+' : ''}${stats.dailyPL.toFixed(2)}%` : '--'}
            </span>
          </div>
        </div>
        {stats.biggestStock && (
          <div className="friend-biggest-stock">
            <span>Biggest: <b>{stats.biggestStock}</b></span>
            <span>{stats.hasLiveData ? formatCurrency(stats.biggestStockValue) : '--'}</span>
          </div>
        )}
        <div className="friend-last-online">
          <span>Last online: {formatTimeSince(lastOnlineTime)}</span>
        </div>
      </div>
      
      {showModal && (
        <FriendPortfolioModal 
          friend={{ friendName }} 
          onClose={() => setShowModal(false)} 
        />
      )}
    </>
  );
};

const FriendsPortfolios = ({ friends }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresh stats every 5 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshKey(k => k + 1);
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="friends-grid" key={refreshKey}>
      {friends.map((friend, idx) => (
        <FriendCard key={idx} friendName={friend} />
      ))}
    </div>
  );
};

// New FriendsGroupStats component
const FriendsGroupStats = ({ friends }) => {
  const [stats, setStats] = useState({
    mostProfitable: { name: '', value: 0 },
    bestDailyGainer: { name: '', value: 0 },
    mostDiversified: { name: '', count: 0 },
    mostActive: { name: '', count: 0 },
    optionsEnthusiast: { name: '', count: 0 },
    worstDay: { name: '', value: 0 }
  });
  const [hasData, setHasData] = useState(false);
  // Get the mock friends data at component level
  const allFriendData = useFriends();

  useEffect(() => {
    const calculateStats = () => {
      let mostProfitable = { name: '', value: 0 };
      let bestDailyGainer = { name: '', value: 0 };
      let mostDiversified = { name: '', count: 0 };
      let mostActive = { name: '', count: 0 };
      let optionsEnthusiast = { name: '', count: 0 };
      let worstDay = { name: '', value: 0 };
      let dataFound = false;

      // Process each friend's portfolio data from localStorage
      friends.forEach(friendName => {
        // Try to get positions from localStorage first
        const storedPositionsStr = localStorage.getItem(`positions_${friendName}`);
        
        try {
          // If localStorage data exists, use it
          if (storedPositionsStr) {
            const storedPositions = JSON.parse(storedPositionsStr);
            if (Array.isArray(storedPositions) && storedPositions.length > 0) {
              dataFound = true;
              
              // Calculate total P/L
              let totalPnl = 0;
              let dailyChange = 0;
              const uniqueStocks = new Set();
              let lastWeekTrades = 0;
              let optionsCount = 0;

              storedPositions.forEach(position => {
                if (!position.lots || position.lots.length === 0) return;

                // Add to unique stocks
                uniqueStocks.add(position.ticker);

                // Check if it's an option position
                if (position.isOption) {
                  optionsCount += position.lots.length;
                }

                // Calculate trades in last 7 days
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                position.lots.forEach(lot => {
                  const shares = Number(lot.shares);
                  const buyPrice = Number(lot.price);
                  const currentPrice = Number(lot.currentPrice || buyPrice * 1.02); // Mock current price
                  
                  // Calculate P/L
                  const lotPnl = shares * (currentPrice - buyPrice);
                  totalPnl += lotPnl;

                  // Calculate daily change (mock: using random values for demo)
                  const yesterdayPrice = currentPrice / (1 + (Math.random() * 0.03 - 0.005));
                  const lotDailyChangePct = (currentPrice - yesterdayPrice) / yesterdayPrice * 100;
                  if (Math.abs(lotDailyChangePct) > Math.abs(dailyChange)) {
                    dailyChange = lotDailyChangePct;
                  }

                  // Count recent trades
                  if (lot.date) {
                    const lotDate = new Date(lot.date);
                    if (lotDate > sevenDaysAgo) {
                      lastWeekTrades++;
                    }
                  }
                });
              });

              // Update stats if this friend has better values
              if (totalPnl > mostProfitable.value) {
                mostProfitable = { name: friendName, value: totalPnl };
              }

              if (dailyChange > 0 && dailyChange > bestDailyGainer.value) {
                bestDailyGainer = { name: friendName, value: dailyChange };
              } else if (dailyChange < 0 && dailyChange < worstDay.value) {
                worstDay = { name: friendName, value: dailyChange };
              }

              if (uniqueStocks.size > mostDiversified.count) {
                mostDiversified = { name: friendName, count: uniqueStocks.size };
              }

              if (lastWeekTrades > mostActive.count) {
                mostActive = { name: friendName, count: lastWeekTrades };
              }

              if (optionsCount > optionsEnthusiast.count) {
                optionsEnthusiast = { name: friendName, count: optionsCount };
              }
            }
          }
        } catch (error) {
          console.error(`Error processing friend stats for ${friendName}:`, error);
        }
      });

      setHasData(dataFound);
      setStats({
        mostProfitable,
        bestDailyGainer,
        mostDiversified,
        mostActive,
        optionsEnthusiast,
        worstDay
      });
    };

    calculateStats();
  }, [friends]);

  const formatCurrency = (value) =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  if (!hasData) {
    return (
      <div className="friends-group-stats no-data">
        <h3>Group Stats</h3>
        <div className="no-data-message">
          Still waiting for more movements, start adding stock bitch
        </div>
      </div>
    );
  }

  return (
    <div className="friends-group-stats">
      <h3>Group Stats</h3>
      <div className="stats-grid">
        {stats.mostProfitable.name && (
          <div className="stat-card">
            <div className="stat-emoji">🔥</div>
            <div className="stat-title">Most Profitable Friend</div>
            <div className="stat-value">
              📈 {stats.mostProfitable.name} has the highest total P/L: 
              {stats.mostProfitable.value > 0 ? '+' : ''}{formatCurrency(stats.mostProfitable.value)}
            </div>
          </div>
        )}

        {stats.bestDailyGainer.name && (
          <div className="stat-card">
            <div className="stat-emoji">🚀</div>
            <div className="stat-title">Best Daily Gainer</div>
            <div className="stat-value">
              📊 {stats.bestDailyGainer.name} had the best daily return: 
              +{stats.bestDailyGainer.value.toFixed(2)}% today
            </div>
          </div>
        )}

        {stats.mostDiversified.name && (
          <div className="stat-card">
            <div className="stat-emoji">🧠</div>
            <div className="stat-title">Most Diversified Portfolio</div>
            <div className="stat-value">
              🔀 {stats.mostDiversified.name} holds {stats.mostDiversified.count} unique stocks
            </div>
          </div>
        )}

        {stats.mostActive.name && (
          <div className="stat-card">
            <div className="stat-emoji">📦</div>
            <div className="stat-title">Most Active Trader (Last 7 Days)</div>
            <div className="stat-value">
              🔄 {stats.mostActive.name} made {stats.mostActive.count} trades this week
            </div>
          </div>
        )}

        {stats.optionsEnthusiast.name && (
          <div className="stat-card">
            <div className="stat-emoji">🛠️</div>
            <div className="stat-title">Options Enthusiast</div>
            <div className="stat-value">
              🧩 {stats.optionsEnthusiast.name} holds {stats.optionsEnthusiast.count} options
            </div>
          </div>
        )}

        {stats.worstDay.name && (
          <div className="stat-card">
            <div className="stat-emoji">📉</div>
            <div className="stat-title">Worst Day</div>
            <div className="stat-value">
              😵 {stats.worstDay.name} dropped {Math.abs(stats.worstDay.value).toFixed(2)}% today. Yikes.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Hub = () => {
  const { user, logout } = useContext(AuthContext);
  const { positions } = useContext(PositionsContext);
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  // Track online status for current user
  useOnlineStatus(user);

  const handleLogout = () => {
    // Update last online time before logging out
    localStorage.setItem(`lastOnline_${user}`, new Date().toISOString());
    logout();
    navigate('/');
  };

  // Calculate portfolio stats from positions
  const { totalValue, totalPL, dailyPL, hasLiveData } = usePortfolioStats(positions);

  // Refresh stats every 5 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshKey(k => k + 1);
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Get friends list from ALLOWED users (excluding current user)
  const friends = useMemo(() => {
    const allFriends = ['Yanai', 'Ido', 'Ofek', 'Megi'];
    return allFriends.filter(friend => friend !== user);
  }, [user]);

  return (
    <div className="hub-container" key={refreshKey}>
      <div className="hub-padding-top" />
      <button className="logout-btn modern-button" onClick={handleLogout} title="Logout">⎋</button>
      <div className="financial-summary-vertical">
        <div className="total-value-block">
          <div className="summary-label">Total Value</div>
          <div className="total-value bold">{hasLiveData ? formatCurrency(totalValue) : '--'}</div>
        </div>
        <div className="summary-row">
          <div className="summary-block">
            <div className="summary-label">Total P/L</div>
            <div className={`summary-value bold ${getColor(totalPL)}`}>
              {hasLiveData ? `${totalPL >= 0 ? '+' : ''}${formatCurrency(totalPL)}` : '--'}
            </div>
          </div>
          <div className="summary-block">
            <div className="summary-label">Daily P/L</div>
            <div className={`summary-value bold ${getColor(dailyPL)}`}>
              {hasLiveData ? `${dailyPL >= 0 ? '+' : ''}${dailyPL.toFixed(2)}%` : '--'}
            </div>
          </div>
        </div>
      </div>
      <div className="welcome-message">Welcome, {user}</div>
      <div className="buttons-container">
        <button className="mystocks-btn modern-button" onClick={() => navigate('/mystocks')}>My Stocks</button>
        <button className="myoptions-btn modern-button" onClick={() => navigate('/myoptions')}>My Options</button>
      </div>
      
      <div className="friends-section">
        <div className="friends-header">
          <h2>Friends' Portfolios</h2>
        </div>
        <FriendsPortfolios friends={friends} />
        <FriendsGroupStats friends={friends} />
      </div>
      {/* Activity Feed block */}
      <ActivityFeed />
      <main className="hub-main">
        {/* Dashboard content goes here */}
        <h1>Hub Dashboard</h1>
        <p>ברוכים הבאים מגיז, זהו אתר לדוגמה כדי לתת לנו לאונן אחד לשני תוך כדי שאנחנו רואים מה ההשקעות של כל אחד ולהתחרות בצורה ידידותית אחד בשני. אוהב אתכם המון המון</p>
      </main>
    </div>
  );
};

export default Hub;