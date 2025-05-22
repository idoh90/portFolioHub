import React, { useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { PositionsContext } from './PositionsContext';
import { useQuote } from './api/useQuote';
import { getQuote } from './api/quote';
import './Hub.css';
import FriendPortfolioModal from './FriendPortfolioModal';
import ActivityFeed from './ActivityFeed';
import { OptionsContext } from './OptionsContext';
import NotificationButton from './components/NotificationButton';

import './components/NotificationButton.css';
import { ref, set, onValue, off, get, serverTimestamp } from 'firebase/database';
import { db } from './firebase';

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
    } else {
      // Validate existing positions data
      try {
        const existingPositions = JSON.parse(localStorage.getItem(`positions_${userName}`));
        // Filter out invalid positions (missing or empty lots)
        const validPositions = Array.isArray(existingPositions) 
          ? existingPositions.filter(pos => pos && pos.lots && pos.lots.length > 0)
          : [];
        localStorage.setItem(`positions_${userName}`, JSON.stringify(validPositions));
      } catch (e) {
        console.error(`Error validating positions for ${userName}:`, e);
        localStorage.setItem(`positions_${userName}`, JSON.stringify([]));
      }
    }
    
    // Check options
    if (!localStorage.getItem(`options_${userName}`)) {
      // Initialize empty options array
      localStorage.setItem(`options_${userName}`, JSON.stringify([]));
    } else {
      // Validate existing options data
      try {
        const existingOptions = JSON.parse(localStorage.getItem(`options_${userName}`));
        // Ensure options data is valid array
        const validOptions = Array.isArray(existingOptions) ? existingOptions : [];
        localStorage.setItem(`options_${userName}`, JSON.stringify(validOptions));
      } catch (e) {
        console.error(`Error validating options for ${userName}:`, e);
        localStorage.setItem(`options_${userName}`, JSON.stringify([]));
      }
    }
    
    // NO MORE MOCK DATA FOR ANY USER - Removed all mock data initialization
  });
};

// Function to clean up sold positions and options
const cleanupSoldItems = () => {
  const allAvailableUsers = ['Yanai', 'Ido', 'Ofek', 'Megi'];
  const activityData = localStorage.getItem('activityFeed');
  
  if (!activityData) return;
  
  try {
    // Parse activity feed to find sell transactions
    const activities = JSON.parse(activityData);
    if (!Array.isArray(activities)) return;
    
    // Process each user
    allAvailableUsers.forEach(userName => {
      // Get user's sell activities
      const userSellActivities = activities.filter(
        activity => activity.user === userName && activity.action === 'sold'
      );
      
      if (userSellActivities.length === 0) return;
      
      // Process stock positions
      try {
        const positionsKey = `positions_${userName}`;
        const positionsData = localStorage.getItem(positionsKey);
        
        if (positionsData) {
          const positions = JSON.parse(positionsData);
          if (Array.isArray(positions) && positions.length > 0) {
            // Check each position against sell activities
            const updatedPositions = positions.filter(position => {
              // Keep positions that haven't been fully sold
              const tickerSellActivities = userSellActivities.filter(
                activity => activity.ticker === position.ticker && activity.type === 'stock'
              );
              
              return tickerSellActivities.length === 0;
            });
            
            localStorage.setItem(positionsKey, JSON.stringify(updatedPositions));
          }
        }
      } catch (e) {
        console.error(`Error cleaning up positions for ${userName}:`, e);
      }
      
      // Process options
      try {
        const optionsKey = `options_${userName}`;
        const optionsData = localStorage.getItem(optionsKey);
        
        if (optionsData) {
          const options = JSON.parse(optionsData);
          if (Array.isArray(options) && options.length > 0) {
            // Check each option against sell activities
            const updatedOptions = options.filter(option => {
              // Keep options that haven't been sold
              const optionSellActivities = userSellActivities.filter(
                activity => 
                  activity.ticker === option.ticker && 
                  activity.type === 'option' && 
                  activity.optionType === option.type
              );
              
              return optionSellActivities.length === 0;
            });
            
            localStorage.setItem(optionsKey, JSON.stringify(updatedOptions));
          }
        }
      } catch (e) {
        console.error(`Error cleaning up options for ${userName}:`, e);
      }
    });
  } catch (e) {
    console.error('Error processing activity feed for cleanup:', e);
  }
};

// Special cleanup for Ofek's data to remove mock entries
const cleanupOfekMockData = () => {
  try {
    // Clean up positions
    const positionsKey = 'positions_Ofek';
    const positionsData = localStorage.getItem(positionsKey);
    if (positionsData) {
      const positions = JSON.parse(positionsData);
      if (Array.isArray(positions)) {
        // Remove any AAPL positions (mock data)
        const cleanedPositions = positions.filter(pos => pos && pos.ticker !== 'AAPL');
        localStorage.setItem(positionsKey, JSON.stringify(cleanedPositions));
      }
    }
    
    // Clean up options
    const optionsKey = 'options_Ofek';
    const optionsData = localStorage.getItem(optionsKey);
    if (optionsData) {
      const options = JSON.parse(optionsData);
      if (Array.isArray(options)) {
        // Remove any AAPL options or CLSK options (that are supposed to be sold)
        const cleanedOptions = options.filter(opt => 
          opt && (opt.ticker !== 'AAPL' && !(opt.ticker === 'CLSK' && opt.type === 'CALL'))
        );
        localStorage.setItem(optionsKey, JSON.stringify(cleanedOptions));
      }
    }
  } catch (e) {
    console.error('Error cleaning up Ofek data:', e);
  }
};

// Function to purge all mock data and ensure a clean state
const purgeAllMockData = () => {
  console.log('Purging all mock data...');
  const allAvailableUsers = ['Yanai', 'Ido', 'Ofek', 'Megi'];
  
  // Clean specific problematic data
  cleanupOfekMockData();
  
  // Remove any positions with AAPL ticker for all users (common mock data)
  allAvailableUsers.forEach(userName => {
    // Positions
    try {
      const positionsKey = `positions_${userName}`;
      const positionsData = localStorage.getItem(positionsKey);
      if (positionsData) {
        const positions = JSON.parse(positionsData);
        if (Array.isArray(positions)) {
          // Remove any AAPL positions (common mock data)
          const cleanedPositions = positions.filter(pos => 
            pos && pos.ticker !== 'AAPL' && pos.ticker !== 'MOCK'
          );
          localStorage.setItem(positionsKey, JSON.stringify(cleanedPositions));
        }
      }
    } catch (e) {
      console.error(`Error cleaning positions for ${userName}:`, e);
    }
    
    // Options
    try {
      const optionsKey = `options_${userName}`;
      const optionsData = localStorage.getItem(optionsKey);
      if (optionsData) {
        const options = JSON.parse(optionsData);
        if (Array.isArray(options)) {
          // Filter out suspicious mock options
          const cleanedOptions = options.filter(opt => 
            opt && opt.ticker !== 'AAPL' && 
            !(opt.premium > 100) && // Unrealistic premium values
            !(opt.contracts > 1000) // Unrealistic contract counts
          );
          localStorage.setItem(optionsKey, JSON.stringify(cleanedOptions));
        }
      }
    } catch (e) {
      console.error(`Error cleaning options for ${userName}:`, e);
    }
  });
  
  // Also clean up any sold items based on activity feed
  cleanupSoldItems();
  
  console.log('All mock data purged');
  return true;
};

// Export functions to window for access from other components
// IMPORTANT: Must be placed after function definitions to avoid initialization errors
window.cleanupOfekMockData = cleanupOfekMockData;
window.purgeAllMockData = purgeAllMockData;

// Custom hook to manage user's online status
function useOnlineStatus(username) {
  useEffect(() => {
    if (!username) return;

    // Create a unique reference for the user's online status
    const userStatusRef = ref(db, `userStatus/${username}`);
    
    // Set online status on connection
    const updateLastOnline = () => {
      // Store in localStorage to persist across browser sessions
      localStorage.setItem(`lastOnline_${username}`, new Date().toISOString());
      
      // Store in Firebase for universal access using server timestamp
      set(userStatusRef, {
        lastOnline: new Date().toISOString(),
        isOnline: true,
        lastUpdated: serverTimestamp() // Use Firebase server timestamp
      }).catch(error => {
        console.error("Error updating online status in Firebase:", error);
      });
      
      // Use sessionStorage to mark active status in current session
      sessionStorage.setItem('currentlyActive', 'true');
    };

    // Update on mount (when user enters site)
    updateLastOnline();

    // Set up interval to update timestamp more frequently while user is active
    const interval = setInterval(updateLastOnline, 15000); // Update every 15 seconds

    // Update on window focus
    const handleFocus = () => {
      updateLastOnline();
    };

    // Update before user leaves
    const handleBeforeUnload = () => {
      // When leaving, set isOnline to false but keep lastOnline time
      const timestamp = new Date().toISOString();
      set(userStatusRef, {
        lastOnline: timestamp,
        isOnline: false,
        lastUpdated: serverTimestamp() // Use Firebase server timestamp
      }).catch(error => {
        console.error("Error updating offline status in Firebase:", error);
      });
      
      // Also update localStorage
      localStorage.setItem(`lastOnline_${username}`, timestamp);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Set the user as offline when the component unmounts
      const timestamp = new Date().toISOString();
      set(userStatusRef, {
        lastOnline: timestamp,
        isOnline: false,
        lastUpdated: serverTimestamp() // Use Firebase server timestamp
      }).catch(error => {
        console.error("Error updating offline status in Firebase:", error);
      });
      
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [username]);
}

// Hook to get last online time for a user
export function useLastOnlineTime(username) {
  const [lastOnline, setLastOnline] = useState(null);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!username) return;
    
    // Set up a listener for this user's online status
    const statusRef = ref(db, `userStatus/${username}`);
    
    // Listen for changes to this user's status
    onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data && data.lastOnline) {
        setLastOnline(new Date(data.lastOnline));
        
        if (data.isOnline === true) {
          setIsOnline(true);
          setLastOnline(null);
        } else {
          // Check if last updated time is recent (within 3 minutes)
          // This handles the case where isOnline might be false but the user is actually active
          if (data.lastUpdated) {
            const lastUpdateTime = typeof data.lastUpdated === 'number' 
              ? data.lastUpdated 
              : new Date(data.lastUpdated).getTime();
            
            const isRecentlyActive = (Date.now() - lastUpdateTime) < 3 * 60 * 1000;
            setIsOnline(isRecentlyActive);
          } else {
            setIsOnline(false);
          }
        }
      } else {
        // No Firebase data, fall back to localStorage
        const localTimestamp = localStorage.getItem(`lastOnline_${username}`);
        if (localTimestamp) {
          setLastOnline(new Date(localTimestamp));
          // For localStorage, check if timestamp is recent (within 3 minutes)
          const isRecentlyActive = (new Date() - new Date(localTimestamp)) < 3 * 60 * 1000;
          setIsOnline(isRecentlyActive);
        } else {
          setLastOnline(null);
          setIsOnline(false);
        }
      }
    });
    
    // Cleanup listener on unmount
    return () => {
      off(statusRef, 'value');
    };
  }, [username]);

  return { lastOnline, isOnline };
}

// Helper function to format time since
export function formatTimeSince(date) {
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
    const results = {};
    for (const ticker of tickers) {
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
  const { lastOnline, isOnline } = useLastOnlineTime(friendName);
  const [friendOptions, setFriendOptions] = useState([]);
  const [totalOptionsValue, setTotalOptionsValue] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  
  // Force refresh data
  const refreshData = useCallback(() => {
    setRefreshKey(prevKey => prevKey + 1);
    setRefreshing(true);
    
    // Force a direct check of the friend's online status
    const friendStatusRef = ref(db, `userStatus/${friendName}`);
    get(friendStatusRef).then(snapshot => {
      const data = snapshot.val();
      
      // If we have data, update the timestamp to force a refresh
      if (!data) {
        // No data found, initialize with offline status
        const localTimestamp = localStorage.getItem(`lastOnline_${friendName}`);
        const timestamp = localTimestamp || new Date().toISOString();
        
        set(friendStatusRef, {
          lastOnline: timestamp,
          isOnline: false,
          lastUpdated: serverTimestamp()
        }).catch(error => {
          console.error(`Error initializing status for ${friendName}:`, error);
        });
      }
      
      setTimeout(() => setRefreshing(false), 1000);
    }).catch(error => {
      console.error(`Error manually refreshing status for ${friendName}:`, error);
      setRefreshing(false);
    });
  }, [friendName]);
  
  // Clean up data and refresh on mount or friendName change
  useEffect(() => {
    // Clean special case for Ofek
    if (friendName === 'Ofek') {
      cleanupOfekMockData();
    }
    refreshData();
  }, [friendName]);
  
  // Get friend's options
  useEffect(() => {
    try {
      const optionsKey = `options_${friendName}`;
      const optionsData = localStorage.getItem(optionsKey);
      if (optionsData) {
        const parsedOptions = JSON.parse(optionsData);
        if (Array.isArray(parsedOptions)) {
          // Filter out invalid options
          const validOptions = parsedOptions.filter(opt => 
            opt && opt.ticker && opt.contracts && opt.premium
          );
          setFriendOptions(validOptions);
          
          // Calculate total options value
          let optionsValue = 0;
          validOptions.forEach(option => {
            const contracts = Number(option.contracts || 0);
            const premium = Number(option.premium || 0);
            if (contracts > 0 && premium > 0) {
              optionsValue += contracts * premium * 100; // Each contract is 100 shares
            }
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
  }, [friendName, refreshKey]);
  
  // Calculate combined portfolio value including options
  const combinedValue = stats.hasLiveData ? stats.totalValue + totalOptionsValue : 0;
  
  return (
    <>
      <div className="friend-card" onClick={() => setShowModal(true)}>
        <div className="friend-header">
          <div className="friend-name">{friendName}</div>
          <div className="last-online">
            <button 
              className="status-refresh-button" 
              onClick={(e) => {
                e.stopPropagation();
                refreshData();
              }}
              title="Refresh status"
              disabled={refreshing}
            >
              {refreshing ? "⌛" : "↻"}
            </button>
            <span className="online-status">
              {isOnline ? '🟢' : '⚪'}
            </span>
            {lastOnline ? formatTimeSince(lastOnline) : 'Never'}
          </div>
        </div>
        
        <div className="friend-portfolio-summary">
          <div className="friend-total-value">
            <span className="value-label">Portfolio:</span>
            <span className="value-amount">
              {combinedValue > 0 ? formatCurrency(combinedValue) : '--'}
            </span>
          </div>
          
          {stats.biggestStock && (
            <div className="friend-biggest-holding">
              <span className="value-label">Top Holding:</span>
              <span className="value-ticker">{stats.biggestStock}</span>
            </div>
          )}
          
          {stats.totalPL !== 0 && (
            <div className="friend-portfolio-pl">
              <span className="value-label">Total P/L:</span>
              <span className={`value-amount ${getColor(stats.totalPL)}`}>
                {stats.totalPL > 0 ? '+' : ''}{formatCurrency(stats.totalPL)}
              </span>
            </div>
          )}
          
          {friendOptions.length > 0 && (
            <div className="friend-options-summary">
              <span className="value-label">Options:</span>
              <span className="value-amount">{friendOptions.length} contract(s)</span>
            </div>
          )}
        </div>
        
        <div className="view-portfolio-btn">
          Click to view portfolio
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

// FriendsPortfolios component needs to receive current user
const FriendsPortfolios = ({ friends, currentUser }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresh stats every 5 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      cleanupSoldItems(); // Clean up sold items first
      setRefreshKey(k => k + 1);
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = useCallback(() => {
    // Purge all mock data including sold items
    purgeAllMockData();
    // Re-initialize friend data
    ensureFriendDataInitialized();
    
    // Force update of current user's online status if available
    if (currentUser) {
      const timestamp = new Date().toISOString();
      const userStatusRef = ref(db, `userStatus/${currentUser}`);
      set(userStatusRef, {
        lastOnline: timestamp,
        isOnline: true,
        lastUpdated: serverTimestamp()
      }).catch(error => {
        console.error(`Error updating online status for current user:`, error);
      });
    }
    
    // Check online status for all friends by triggering Firebase reads
    friends.forEach(friendName => {
      const friendStatusRef = ref(db, `userStatus/${friendName}`);
      get(friendStatusRef).then(snapshot => {
        const data = snapshot.val();
        
        // If not in Firebase yet, initialize from localStorage
        if (!data) {
          const localTimestamp = localStorage.getItem(`lastOnline_${friendName}`);
          if (localTimestamp) {
            // Initialize in Firebase with data from localStorage
            set(friendStatusRef, {
              lastOnline: localTimestamp,
              isOnline: false,
              lastUpdated: serverTimestamp()
            }).catch(error => {
              console.error(`Error initializing status for ${friendName}:`, error);
            });
          }
        }
      }).catch(error => {
        console.error(`Error checking online status for ${friendName}:`, error);
      });
    });
    
    // Force a re-render by updating the refresh key
    setRefreshKey(prevKey => prevKey + 1);
  }, [friends, currentUser]);

  return (
    <>
      <div className="friends-header-actions">
        <button 
          className="refresh-button modern-button" 
          onClick={handleRefresh}
          title="Refresh friends' data"
        >
          <span className="refresh-icon">↻</span> Refresh
        </button>
      </div>
      <div className="friends-grid" key={refreshKey}>
        {friends.map((friend, idx) => (
          <FriendCard key={`${friend}-${refreshKey}-${idx}`} friendName={friend} />
        ))}
      </div>
    </>
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
  const { positions, takenPL: stockTakenPL } = useContext(PositionsContext);
  const { options, takenPL: optionsTakenPL } = useContext(OptionsContext);
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showNotificationButton, setShowNotificationButton] = useState(false);

  // Initialize friends' data if needed and clean up sold items
  useEffect(() => {
    // Purge all mock data on app startup
    purgeAllMockData();
    // Then initialize any missing data structures
    ensureFriendDataInitialized();
  }, []);
  
  // Check if notifications can be shown
  useEffect(() => {
    // Only show notification button if notifications are supported
    // and permission hasn't been permanently denied
    if ('Notification' in window && Notification.permission !== 'denied') {
      setShowNotificationButton(true);
    }
  }, []);
  
  // Track online status for current user
  useOnlineStatus(user);

  const handleLogout = () => {
    // Update last online time before logging out
    const timestamp = new Date().toISOString();
    localStorage.setItem(`lastOnline_${user}`, timestamp);
    
    // Set user as offline in Firebase
    const userStatusRef = ref(db, `userStatus/${user}`);
    set(userStatusRef, {
      lastOnline: timestamp,
      isOnline: false,
      lastUpdated: serverTimestamp()
    }).catch(error => {
      console.error("Error updating offline status in Firebase:", error);
    });
    
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
    <div className="hub-container pwa-container" key={refreshKey}>
      <div className="hub-padding-top" />
      <button className="logout-btn modern-button" onClick={handleLogout} title="Logout">⎋</button>
      {showNotificationButton && (
        <div className="notification-button-container">
          <NotificationButton />
        </div>
      )}
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
        <div className="summary-row">
          <div className="summary-block">
            <div className="summary-label">Stocks Taken P/L</div>
            <div className={`summary-value bold ${getColor(stockTakenPL)}`}>
              {`${stockTakenPL >= 0 ? '+' : ''}${formatCurrency(stockTakenPL)}`}
            </div>
          </div>
          <div className="summary-block">
            <div className="summary-label">Options Taken P/L</div>
            <div className={`summary-value bold ${getColor(optionsTakenPL)}`}>
              {`${optionsTakenPL >= 0 ? '+' : ''}${formatCurrency(optionsTakenPL)}`}
            </div>
          </div>
        </div>
        <div className="summary-row">
          <div className="summary-block">
            <div className="summary-label">Total Taken P/L</div>
            <div className={`summary-value bold ${getColor(stockTakenPL + optionsTakenPL)}`}>
              {`${(stockTakenPL + optionsTakenPL) >= 0 ? '+' : ''}${formatCurrency(stockTakenPL + optionsTakenPL)}`}
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
        <FriendsPortfolios friends={friends} currentUser={user} />
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