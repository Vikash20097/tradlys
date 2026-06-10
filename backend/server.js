require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/auth');
const analyzeRoutes = require('./routes/analyze');
const historyRoutes = require('./routes/history');
const marketRoutes = require('./routes/market');

const watchlistRoutes = require('./routes/watchlist');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

const PORT = process.env.PORT || 5000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"]
    }
  }
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Tradlys backend is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/analyze', analyzeRoutes);

// History API: GET /api/history/:userId (never 404)
app.use('/api/history', historyRoutes);

app.use('/api/market', marketRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => console.log(`Tradlys server running on port ${PORT}`));
}

module.exports = app;
