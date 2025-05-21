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

// Utility function to ensure friend data is saved properly for viewing
const ensureFriendDataInitialized = () => {
  const allAvailableUsers = ['Yanai', 'Ido', 'Ofek', 'Megi'];
  
  // For each user, check if they have positions and options data
  allAvailableUsers.forEach(userName => {
    // Check positions
    if (!localStorage.getItem(`positions_${userName}`)) {
      // Initialize empty positions array
      localStorage.setItem(`positions_${userName}`, JSON.stringify([]));
    }
    
    // Check options
    if (!localStorage.getItem(`options_${userName}`)) {
      // Initialize empty options array
      localStorage.setItem(`options_${userName}`, JSON.stringify([]));
    }
    
    // Add sample options for Ofek if none exist (for testing only)
    if (userName === 'Ofek' && localStorage.getItem(`options_${userName}`) === '[]') {
      const sampleOptions = [
        {
          id: 'sample-option-1',
          ticker: 'AAPL',
          type: 'CALL',
          direction: 'LONG',
          contracts: 2,
          strike: 175,
          premium: 5.25,
          expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          tradeDate: new Date().toISOString()
        },
        {
          id: 'sample-option-2',
          ticker: 'MSFT',
          type: 'PUT',
          direction: 'SHORT',
          contracts: 1,
          strike: 320,
          premium: 7.80,
          expiration: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days from now
          tradeDate: new Date().toISOString()
        }
      ];
      localStorage.setItem(`options_${userName}`, JSON.stringify(sampleOptions));
    }
  });
};

// Custom hook to manage user's online status
function useOnlineStatus(username) {
  useEffect(() => {
    if (!username) return;

    // Update last online time when component mounts (user enters site)
    const updateLastOnline = () => {
      const timestamp = new Date().toISOString();
      
      // Store in localStorage to persist across browser sessions
      localStorage.setItem(`lastOnline_${username}`, timestamp);
      
      // Use sessionStorage to mark active status in current session
      sessionStorage.setItem('currentlyActive', 'true');
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
      // Still update the timestamp on unmount but don't clear from localStorage
      // This ensures the timestamp persists even after the user leaves
      updateLastOnline();
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
      // Use sessionStorage to track current session status
      let timestamp = localStorage.getItem(`lastOnline_${username}`);
      
      // Ensure we're getting the persistent value from localStorage, not the session-specific one
      if (timestamp) {
        setLastOnline(new Date(timestamp));
      } else {
        setLastOnline(null);
      }
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

// Data hooks
export function useNews() {
  // Replace mock articles with fetched or stored real data
  const [articles, setArticles] = useState([]);
  
  useEffect(() => {
    // In a real implementation, this would fetch from an API
    // For now, we'll create some simple articles based on recent stock activity
    const generateArticles = () => {
      // Check localStorage for recent activities
      try {
        const allUsers = ['Yanai', 'Ido', 'Ofek', 'Megi'];
        const recentArticles = [];
        
        // Generate articles based on recent user activity
        allUsers.forEach(user => {
          // Check for positions
          const posKey = `positions_${user}`;
          const posData = localStorage.getItem(posKey);
          if (posData) {
            try {
              const positions = JSON.parse(posData);
              if (positions && positions.length > 0) {
                // Take the most recent position (simplified approach)
                const latestPosition = positions[positions.length - 1];
                if (latestPosition && latestPosition.ticker) {
                  recentArticles.push({
                    headline: `${user} Added ${latestPosition.ticker} to Portfolio`,
                    source: 'PortfolioHub',
                    url: '#'
                  });
                }
              }
            } catch (e) {
              console.error("Error parsing positions data for articles:", e);
            }
          }
          
          // Check for options
          const optKey = `options_${user}`;
          const optData = localStorage.getItem(optKey);
          if (optData) {
            try {
              const options = JSON.parse(optData);
              if (options && options.length > 0) {
                // Take the most recent option (simplified approach)
                const latestOption = options[options.length - 1];
                if (latestOption && latestOption.ticker) {
                  recentArticles.push({
                    headline: `${user} Added ${latestOption.ticker} ${latestOption.type} Option`,
                    source: 'PortfolioHub',
                    url: '#'
                  });
                }
              }
            } catch (e) {
              console.error("Error parsing options data for articles:", e);
            }
          }
        });
        
        // Add some market articles if we don't have enough
        if (recentArticles.length < 3) {
          recentArticles.push({
            headline: 'Markets Rally on Positive Economic Data',
            source: 'PortfolioHub News',
            url: '#'
          });
          recentArticles.push({
            headline: 'Tech Stocks Lead Market Gains',
            source: 'PortfolioHub News',
            url: '#'
          });
        }
        
        setArticles(recentArticles);
      } catch (error) {
        console.error("Error generating articles:", error);
        // Fallback to basic articles
        setArticles([
          {
            headline: 'Markets Update: Recent Trends and Analysis',
            source: 'PortfolioHub News',
            url: '#'
          },
          {
            headline: 'Top Performing Stocks This Week',
            source: 'PortfolioHub News',
            url: '#'
          }
        ]);
      }
    };
    
    generateArticles();
    // Refresh articles every 5 minutes
    const interval = setInterval(generateArticles, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return articles;
}

export function useFriends() {
  // This was already updated to use real data
  // Instead of returning mock data, get the list of valid users
  // This should match the possible usernames in the app
  const allAvailableUsers = ['Yanai', 'Ido', 'Ofek', 'Megi'];
  
  // Initialize data with all available users
  const friendsData = allAvailableUsers.map(friendName => {
    return { friendName };
  });
  
  return friendsData.map(friend => friend.friendName);
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
      
      const parsedOptions = JSON.parse(optionsData);
      return Array.isArray(parsedOptions) ? parsedOptions : [];
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
    if (options.length > 0) {
      let optionsBlock = {
        totalValue: 0,
        ticker: 'OPTIONS'
      };
      
      options.forEach(opt => {
        const quote = quotes[opt.ticker];
        if (!quote || quote.loading || quote.price === null) {
          hasLiveData = false;
        }
        
        try {
          const contracts = Number(opt.contracts || 0);
          const premium = Number(opt.premium || 0);
          const strike = Number(opt.strike || 0);
          
          // Basic option value calculation (simplified)
          // A real implementation would use proper options pricing formulas
          const contractMultiplier = 100; // Each contract is for 100 shares
          const optionValue = contracts * premium * contractMultiplier;
          const optionCost = contracts * premium * contractMultiplier;
          const optionYesterdayValue = optionValue * 0.99; // Simple approximation
          
          totalValue += optionValue;
          totalCost += optionCost;
          yesterdayValue += optionYesterdayValue;
          
          optionsBlock.totalValue += optionValue;
          
          // Track individual large options
          const optType = `${opt.ticker} ${opt.type}`;
          if (optionValue > biggestStockValue) {
            biggestStockValue = optionValue;
            biggestStock = optType;
          }
        } catch (e) {
          console.error(`Error calculating value for option:`, opt, e);
        }
      });
      
      // If all options together are the biggest position
      if (optionsBlock.totalValue > biggestStockValue && options.length > 1) {
        biggestStockValue = optionsBlock.totalValue;
        biggestStock = 'OPTIONS';
      }
    }

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

// Updated Friend card component with real last online time and options display
const FriendCard = ({ friendName }) => {
  const stats = useFriendPortfolioStats(friendName);
  const [showModal, setShowModal] = useState(false);
  const lastOnlineTime = useLastOnlineTime(friendName);
  const [friendOptions, setFriendOptions] = useState([]);
  const [totalOptionsValue, setTotalOptionsValue] = useState(0);
  
  // Get friend's options
  useEffect(() => {
    try {
      const optionsKey = `options_${friendName}`;
      const optionsData = localStorage.getItem(optionsKey);
      if (optionsData) {
        const parsedOptions = JSON.parse(optionsData);
        if (Array.isArray(parsedOptions)) {
          setFriendOptions(parsedOptions);
          
          // Calculate total options value
          let optionsValue = 0;
          parsedOptions.forEach(option => {
            const contracts = Number(option.contracts || 0);
            const premium = Number(option.premium || 0);
            optionsValue += contracts * premium * 100; // Each contract is 100 shares
          });
          setTotalOptionsValue(optionsValue);
        } else {
          setFriendOptions([]);
          setTotalOptionsValue(0);
        }
      } else {
        setFriendOptions([]);
        setTotalOptionsValue(0);
      }
    } catch (error) {
      console.error(`Error loading options for ${friendName}:`, error);
      setFriendOptions([]);
      setTotalOptionsValue(0);
    }
  }, [friendName]);
  
  // Calculate combined portfolio value including options
  const combinedValue = stats.hasLiveData ? stats.totalValue + totalOptionsValue : 0;
  
  return (
    <>
      <div className="friend-card" onClick={() => setShowModal(true)}>
        <div className="friend-name">{friendName}</div>
        <div className="friend-portfolio-value">
          {stats.hasLiveData ? formatCurrency(combinedValue) : '--'}
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
        
        {/* Display friend's options */}
        {friendOptions.length > 0 && (
          <div className="friend-options">
            <span>Options: {friendOptions.length}</span>
            <div className="friend-options-preview">
              {friendOptions.slice(0, 2).map((option, idx) => (
                <div key={idx} className="friend-recent-option">
                  <span className={option.type === 'CALL' ? 'call-option' : 'put-option'}>
                    {option.ticker} {option.type} ${option.strike}
                  </span>
                </div>
              ))}
              {friendOptions.length > 2 && (
                <div className="friend-options-more">+{friendOptions.length - 2} more</div>
              )}
            </div>
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
const FriendsGroupStats = ({ friends, currentUser }) => {
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

      // Process each user's portfolio data from localStorage
      friends.forEach(friendName => {
        try {
          // Try to get positions and options from localStorage
          const storedPositionsStr = localStorage.getItem(`positions_${friendName}`);
          const storedOptionsStr = localStorage.getItem(`options_${friendName}`);
          
          // Initialize counters and stats for this friend
          let totalPnl = 0;
          let dailyChange = 0;
          const uniqueStocks = new Set();
          let lastWeekTrades = 0;
          let optionsCount = 0;

          // Process positions data if it exists
          if (storedPositionsStr) {
            const storedPositions = JSON.parse(storedPositionsStr);
            if (Array.isArray(storedPositions) && storedPositions.length > 0) {
              dataFound = true;
              
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
            }
          }
          
          // Process options data if it exists
          if (storedOptionsStr) {
            const storedOptions = JSON.parse(storedOptionsStr);
            if (Array.isArray(storedOptions) && storedOptions.length > 0) {
              dataFound = true;
              
              // Add options to the count for the options enthusiast stat
              optionsCount += storedOptions.length;
              
              // Add option tickers to unique stocks set
              storedOptions.forEach(option => {
                uniqueStocks.add(option.ticker);
              });
            }
          }

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

  const isCurrentUser = (name) => name === currentUser;

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
          <div className={`stat-card ${isCurrentUser(stats.mostProfitable.name) ? 'current-user-stat' : ''}`}>
            <div className="stat-emoji">🔥</div>
            <div className="stat-title">Most Profitable</div>
            <div className="stat-value">
              📈 {isCurrentUser(stats.mostProfitable.name) ? 'You' : stats.mostProfitable.name} {isCurrentUser(stats.mostProfitable.name) ? 'have' : 'has'} the highest total P/L: 
              {stats.mostProfitable.value > 0 ? '+' : ''}{formatCurrency(stats.mostProfitable.value)}
            </div>
          </div>
        )}

        {stats.bestDailyGainer.name && (
          <div className={`stat-card ${isCurrentUser(stats.bestDailyGainer.name) ? 'current-user-stat' : ''}`}>
            <div className="stat-emoji">🚀</div>
            <div className="stat-title">Best Daily Gainer</div>
            <div className="stat-value">
              📊 {isCurrentUser(stats.bestDailyGainer.name) ? 'You' : stats.bestDailyGainer.name} {isCurrentUser(stats.bestDailyGainer.name) ? 'had' : 'had'} the best daily return: 
              +{stats.bestDailyGainer.value.toFixed(2)}% today
            </div>
          </div>
        )}

        {stats.mostDiversified.name && (
          <div className={`stat-card ${isCurrentUser(stats.mostDiversified.name) ? 'current-user-stat' : ''}`}>
            <div className="stat-emoji">🧠</div>
            <div className="stat-title">Most Diversified Portfolio</div>
            <div className="stat-value">
              🔀 {isCurrentUser(stats.mostDiversified.name) ? 'You' : stats.mostDiversified.name} {isCurrentUser(stats.mostDiversified.name) ? 'hold' : 'holds'} {stats.mostDiversified.count} unique stocks
            </div>
          </div>
        )}

        {stats.mostActive.name && (
          <div className={`stat-card ${isCurrentUser(stats.mostActive.name) ? 'current-user-stat' : ''}`}>
            <div className="stat-emoji">📦</div>
            <div className="stat-title">Most Active Trader (Last 7 Days)</div>
            <div className="stat-value">
              🔄 {isCurrentUser(stats.mostActive.name) ? 'You' : stats.mostActive.name} made {stats.mostActive.count} trades this week
            </div>
          </div>
        )}

        {stats.optionsEnthusiast.name && (
          <div className={`stat-card ${isCurrentUser(stats.optionsEnthusiast.name) ? 'current-user-stat' : ''}`}>
            <div className="stat-emoji">🛠️</div>
            <div className="stat-title">Options Enthusiast</div>
            <div className="stat-value">
              🧩 {isCurrentUser(stats.optionsEnthusiast.name) ? 'You' : stats.optionsEnthusiast.name} {isCurrentUser(stats.optionsEnthusiast.name) ? 'hold' : 'holds'} {stats.optionsEnthusiast.count} options
            </div>
          </div>
        )}

        {stats.worstDay.name && (
          <div className={`stat-card ${isCurrentUser(stats.worstDay.name) ? 'current-user-stat' : ''}`}>
            <div className="stat-emoji">📉</div>
            <div className="stat-title">Worst Day</div>
            <div className="stat-value">
              😵 {isCurrentUser(stats.worstDay.name) ? 'You' : stats.worstDay.name} dropped {Math.abs(stats.worstDay.value).toFixed(2)}% today. Yikes.
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

  // Initialize friends' data if needed
  useEffect(() => {
    ensureFriendDataInitialized();
  }, []);
  
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
  
  // Get all users for group stats (including current user)
  const allUsers = useMemo(() => {
    return ['Yanai', 'Ido', 'Ofek', 'Megi'];
  }, []);

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
        <FriendsGroupStats friends={allUsers} currentUser={user} />
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