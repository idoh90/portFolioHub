import { useEffect, useState, useRef, useCallback } from "react";
import { getQuote } from "./quote";

const TTL = 5 * 60 * 1000; // 5 minutes
const GLOBAL_CACHE = new Map(); // { TICKER: { price, lastFetch, timer, listeners } }

function subscribe(ticker, setState) {
  let entry = GLOBAL_CACHE.get(ticker);
  if (!entry) {
    entry = { price: null, lastFetch: null, timer: null, listeners: new Set() };
    GLOBAL_CACHE.set(ticker, entry);
  }
  entry.listeners.add(setState);
  return () => {
    entry.listeners.delete(setState);
  };
}

function notify(ticker) {
  const entry = GLOBAL_CACHE.get(ticker);
  if (entry) {
    entry.listeners.forEach(fn => fn({ price: entry.price, lastFetch: entry.lastFetch }));
  }
}

function scheduleNext(ticker, fetchPrice) {
  const entry = GLOBAL_CACHE.get(ticker);
  if (!entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  const elapsed = Date.now() - (entry.lastFetch || 0);
  const left = Math.max(TTL - elapsed, 0);
  entry.timer = setTimeout(() => fetchPrice(ticker), left);
}

async function fetchPrice(ticker) {
  let entry = GLOBAL_CACHE.get(ticker);
  if (!entry) {
    entry = { price: null, lastFetch: null, timer: null, listeners: new Set() };
    GLOBAL_CACHE.set(ticker, entry);
  }
  const price = await getQuote(ticker);
  entry.price = price;
  entry.lastFetch = Date.now();
  notify(ticker);
  scheduleNext(ticker, fetchPrice);
}

export function useQuote(ticker) {
  const [state, setState] = useState(() => {
    const entry = GLOBAL_CACHE.get(ticker);
    return {
      price: entry ? entry.price : null,
      lastFetch: entry ? entry.lastFetch : null,
    };
  });
  const [loading, setLoading] = useState(!state.price);
  const [timeLeft, setTimeLeft] = useState(TTL);

  useEffect(() => {
    const unsub = subscribe(ticker, setState);
    let entry = GLOBAL_CACHE.get(ticker);
    if (!entry || !entry.lastFetch || Date.now() - entry.lastFetch > TTL) {
      fetchPrice(ticker);
    } else {
      scheduleNext(ticker, fetchPrice);
    }
    return () => {
      unsub();
    };
  }, [ticker]);

  useEffect(() => {
    setLoading(!state.price);
    if (!state.lastFetch) return;
    let timer;
    function update() {
      const elapsed = Date.now() - state.lastFetch;
      const left = Math.max(TTL - elapsed, 0);
      setTimeLeft(left);
      if (left > 0) {
        timer = setTimeout(update, 1000);
      }
    }
    update();
    return () => clearTimeout(timer);
  }, [state.lastFetch]);

  const refetch = useCallback(() => fetchPrice(ticker), [ticker]);

  return { price: state.price, loading, lastFetch: state.lastFetch, timeLeft, refetch };
} 