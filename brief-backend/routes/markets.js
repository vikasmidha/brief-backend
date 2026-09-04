const express = require('express');
const fetch = require('node-fetch');
const cache = require('../cache');

const router = express.Router();

// Twelve Data symbols for the indices/stocks the app tracks.
// NIFTY/SENSEX use their NSE/BSE-style symbols; adjust to whatever your
// data plan actually grants access to (free tier covers most global equities
// and major indices, but Indian index coverage can vary by plan).
const SYMBOLS = {
  nifty: 'NIFTY50.NSE',
  sensex: 'SENSEX.BSE',
  banknifty: 'BANKNIFTY.NSE',
  nasdaq: 'IXIC',
  reliance: 'RELIANCE.NSE',
  dmart: 'DMART.NSE',
};

async function fetchQuote(symbolKey) {
  const key = process.env.TWELVEDATA_KEY;
  if (!key || key.includes('your_twelvedata_key')) {
    throw new Error('TWELVEDATA_KEY not configured — add a real key to .env');
  }
  const symbol = SYMBOLS[symbolKey];
  if (!symbol) throw new Error(`Unknown symbol key: ${symbolKey}`);

  const cacheKey = `quote:${symbolKey}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status === 'error') {
    throw new Error(`Twelve Data error: ${data.message}`);
  }

  const mapped = {
    symbol: symbolKey,
    name: data.name || symbolKey,
    price: parseFloat(data.close),
    changePercent: parseFloat(data.percent_change),
  };

  cache.set(cacheKey, mapped, 60); // 1 min cache — markets move fast, quota is limited
  return mapped;
}

router.get('/', async (req, res) => {
  try {
    const keys = Object.keys(SYMBOLS);
    const quotes = await Promise.all(
      keys.map((k) => fetchQuote(k).catch((err) => ({ symbol: k, error: err.message })))
    );
    res.json({ quotes });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
