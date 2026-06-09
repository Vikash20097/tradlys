const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/authMiddleware');

const memoryWatchlist = new Map();

const getUserKey = (req) => {
  return req.user?.uid || 'anonymous';
};

const getUserWatchlist = (userId) => {
  if (!memoryWatchlist.has(userId)) {
    memoryWatchlist.set(userId, []);
  }
  return memoryWatchlist.get(userId);
};

router.get('/', optionalAuth, (req, res) => {
  try {
    const userId = getUserKey(req);
    const raw = req.query.symbols;
    let list = getUserWatchlist(userId);
    if (typeof raw === 'string' && raw.trim().length > 0) {
      const requested = raw.split(',').map(s => s.trim()).filter(Boolean);
      if (requested.length > 0) {
        const current = getUserWatchlist(userId);
        requested.forEach(sym => {
          const upper = sym.toUpperCase();
          if (!current.includes(upper)) {
            current.push(upper);
          }
        });
        memoryWatchlist.set(userId, current);
        list = current;
      }
    }
    res.json({ symbols: list, userId });
  } catch (error) {
    console.error('Watchlist fetch error:', error);
    res.status(200).json({ symbols: [], userId: getUserKey(req) });
  }
});

router.post('/add', optionalAuth, (req, res) => {
  try {
    const userId = getUserKey(req);
    const { symbol } = req.body;
    const value = String(symbol || '').trim().toUpperCase();
    if (!value) {
      return res.status(400).json({ message: 'symbol is required' });
    }
    const list = getUserWatchlist(userId);
    if (!list.includes(value)) {
      list.push(value);
    }
    res.json({ symbols: list, userId, added: value });
  } catch (error) {
    console.error('Watchlist add error:', error);
    res.status(500).json({ message: 'Failed to add symbol' });
  }
});

router.delete('/:symbol', optionalAuth, (req, res) => {
  try {
    const userId = getUserKey(req);
    const symbol = String(req.params.symbol || '').trim().toUpperCase();
    if (!symbol) {
      return res.status(400).json({ message: 'symbol is required' });
    }
    let list = getUserWatchlist(userId);
    list = list.filter(item => item !== symbol);
    memoryWatchlist.set(userId, list);
    res.json({ symbols: list, userId, removed: symbol });
  } catch (error) {
    console.error('Watchlist remove error:', error);
    res.status(500).json({ message: 'Failed to remove symbol' });
  }
});

router.delete('/', optionalAuth, (req, res) => {
  try {
    const userId = getUserKey(req);
    memoryWatchlist.set(userId, []);
    res.json({ symbols: [], userId });
  } catch (error) {
    console.error('Watchlist clear error:', error);
    res.status(500).json({ message: 'Failed to clear watchlist' });
  }
});

module.exports = router;
