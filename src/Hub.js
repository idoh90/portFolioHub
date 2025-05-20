import React, { useContext, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { PositionsContext } from './PositionsContext';
import { useQuote } from './api/useQuote';
import { getQuote } from './api/quote';
import './Hub.css';

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
  const [stats, setStats] = useState({
    totalValue: 0,
    totalPL: 0,
    dailyPL: 0,
    hasLiveData: true
  });

  // Get all unique tickers from positions
  const tickers = useMemo(() => positions.map(pos => pos.ticker), [positions]);
  const quotes = useQuotesForTickers(tickers);

  useEffect(() => {
    let totalValue = 0;
    let totalCost = 0;
    let yesterdayValue = 0;
    let hasLiveData = true;

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

    const totalPL = totalValue - totalCost;
    const dailyPL = totalCost ? (((totalValue - yesterdayValue) / totalCost) * 100) : 0;
    
    setStats({
      totalValue,
      totalPL,
      dailyPL,
      hasLiveData
    });
  }, [positions, quotes]);

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

  // Get positions from localStorage
  const positions = useMemo(() => {
    try {
      const key = `positions_${friendName}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  }, [friendName]);

  // Get all unique tickers from positions
  const tickers = useMemo(() => positions.map(pos => pos.ticker), [positions]);
  const quotes = useQuotesForTickers(tickers);

  useEffect(() => {
    let totalValue = 0;
    let totalCost = 0;
    let yesterdayValue = 0;
    let biggestStock = null;
    let biggestStockValue = 0;
    let hasLiveData = true;

    positions.forEach(pos => {
      const quote = quotes[pos.ticker];
      if (!quote || quote.loading || quote.price === null) {
        hasLiveData = false;
      }
      let posValue = 0;
      pos.lots.forEach(lot => {
        const lotValue = Number(lot.shares) * (quote?.price || Number(lot.price));
        totalValue += lotValue;
        totalCost += Number(lot.shares) * Number(lot.price);
        yesterdayValue += Number(lot.shares) * (Number(lot.price) * 0.99);
        posValue += lotValue;
      });
      if (posValue > biggestStockValue) {
        biggestStockValue = posValue;
        biggestStock = pos.ticker;
      }
    });

    const totalPL = totalValue - totalCost;
    const dailyPL = totalCost ? (((totalValue - yesterdayValue) / totalCost) * 100) : 0;
    
    setStats({
      totalValue,
      totalPL,
      dailyPL,
      biggestStock,
      biggestStockValue,
      hasLiveData
    });
  }, [positions, quotes]);

  return stats;
}

// Friend card component to handle individual friend stats
const FriendCard = ({ friendName }) => {
  const stats = useFriendPortfolioStats(friendName);
  
  return (
    <div className="friend-card">
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
        <FriendCard key={idx} friendName={friend.friendName} />
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

  // Filter out the logged-in user from the friends list
  const filteredFriends = mockFriends.filter(friend => friend.friendName !== user);

  return (
    <div className="hub-container" key={refreshKey}>
      <div className="hub-padding-top" />
      <button className="logout-btn" onClick={handleLogout} title="Logout">⎋</button>
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
      <button className="mystocks-btn" onClick={() => navigate('/mystocks')}>My Stocks</button>
      <FriendsPortfolios friends={filteredFriends} />
      <main className="hub-main">
        {/* Dashboard content goes here */}
        <h1>Hub Dashboard</h1>
        <p>This is your mobile-first, scrollable dashboard. Add widgets and content here.</p>
      </main>
    </div>
  );
};

export default Hub; 