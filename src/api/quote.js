/* Finnhub quote fetcher */
const CACHE = new Map();           // { TICKER: { price, ts } }
const TTL   = 5 * 60 * 1000;       // 5 minutes
const FINNHUB_API_KEY = "d0m6f11r01qpni32sk6gd0m6f11r01qpni32sk70";

export async function getQuote(ticker) {
  ticker = ticker.toUpperCase();
  const now = Date.now();

  const cached = CACHE.get(ticker);
  if (cached && now - cached.ts < TTL) return cached.price;

  const url =
    `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`HTTP error for ${ticker}:`, res.status, res.statusText);
      return null;
    }

    const json = await res.json();
    console.log(`Finnhub API response for ${ticker}:`, JSON.stringify(json, null, 2));

    // Finnhub returns { c: current, h: high, l: low, o: open, pc: prev close, t: timestamp }
    if (typeof json.c !== 'number') {
      console.error(`No price data for ${ticker}:`, json);
      return null;
    }

    const price = json.c;
    CACHE.set(ticker, { price, ts: now });
    return price;
  } catch (error) {
    console.error(`Error fetching quote for ${ticker}:`, error);
    return null;
  }
} 