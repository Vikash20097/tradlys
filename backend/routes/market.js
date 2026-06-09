const express = require('express');
const router = express.Router();
const { apiLimiter } = require('../middleware/rateLimit');
const { fetchLiveMarketData, fetchNews, getTrendingLists, getSafeFallbackMarketContext } = require('../services/marketService');

const isValidSymbol = (symbol) => typeof symbol === 'string' && /^[A-Z0-9 .\-]{2,20}$/i.test(symbol);

router.get('/live', apiLimiter, async (req, res) => {
  try {
    const marketData = await fetchLiveMarketData();
    const newsData = await fetchNews();
    res.json({
      success: true,
      data: marketData,
      news: newsData,
      currency: 'INR',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Market error:', error);
    res.status(200).json({
      success: true,
      data: [
        {
          symbol: 'NIFTY 50',
          name: 'NIFTY 50',
          ltp: 22045,
          change: 125.4,
          changePercent: 0.57,
          open: 21900,
          high: 22120,
          low: 21880,
          prevClose: 21919.6,
          exchange: 'NSE',
          currency: 'INR'
        }
      ],
      news: {
        headlines: [
          {
            title: 'Market service unavailable; showing safe fallback sample.',
            sentiment: 'Neutral',
            source: 'Tradlys System',
            time: Date.now()
          }
        ],
        marketImpact: 'Market API offline, using fallback.'
      },
      currency: 'INR',
      timestamp: new Date().toISOString(),
      fallback: true
    });
  }
});

router.get('/demo', (req, res) => {
  res.json({
    success: true,
    market: 'NIFTY 50',
    price: '₹22045.00',
    currency: 'INR'
  });
});

router.get('/trending', apiLimiter, async (req, res) => {
  try {
    const lists = await getTrendingLists();
    res.status(200).json({
      success: true,
      gainers: lists.gainers || [],
      losers: lists.losers || [],
      trending: lists.trending || [],
      currency: 'INR',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Trending error:', error);
    const fallback = {
      success: true,
      gainers: [],
      losers: [],
      trending: [],
      currency: 'INR',
      fallback: true,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(fallback);
  }
});

router.get('/:symbol', apiLimiter, async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!isValidSymbol(symbol)) {
      return res.status(200).json(getSafeFallbackMarketContext(symbol));
    }
    const data = await fetchLiveMarketData();
    const item = data.find((entry) => String(entry.symbol || '').toUpperCase() === String(symbol).toUpperCase());
    const context = getSafeFallbackMarketContext(symbol);
    if (!item) {
      return res.status(200).json({
        success: true,
        symbol,
        found: false,
        context,
        fallback: true
      });
    }
    res.status(200).json({
      success: true,
      symbol: item.symbol,
      name: item.name,
      ltp: item.ltp,
      change: item.change,
      changePercent: item.changePercent,
      currency: item.currency || 'INR',
      found: true
    });
  } catch (error) {
    console.error('Symbol market error:', error);
    res.status(200).json(getSafeFallbackMarketContext(req.params?.symbol || 'NIFTY 50'));
  }
});

module.exports = router;
