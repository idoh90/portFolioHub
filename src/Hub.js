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

// Friend card component to handle individual friend stats
const FriendCard = ({ friendName }) => {
  const stats = useFriendPortfolioStats(friendName);
  const [showModal, setShowModal] = useState(false);
  
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

const Hub = () => {
  const { user, logout } = useContext(AuthContext);
  const { positions } = useContext(PositionsContext);
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLogout = () => {
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