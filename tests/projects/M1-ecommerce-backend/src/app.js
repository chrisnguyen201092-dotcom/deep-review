const express = require('express');
const cors = require('cors');
const productsRouter = require('./routes/products');
const cartRouter = require('./routes/cart');
const checkoutRouter = require('./routes/checkout');
const usersRouter = require('./routes/users');
const { authMiddleware } = require('./middleware/auth');
const { validateRequest } = require('./middleware/validate');
const { rateLimiter } = require('./middleware/rateLimit');
const db = require('./models/db');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(rateLimiter);

// Public routes
app.use('/api/products', productsRouter);

// Authenticated routes
app.use('/api/cart', authMiddleware, cartRouter);
app.use('/api/checkout', authMiddleware, checkoutRouter);
app.use('/api/users', usersRouter);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`E-Commerce API running on port ${PORT}`));

module.exports = app;
