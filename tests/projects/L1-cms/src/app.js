const express = require('express');
const cors = require('cors');
const path = require('path');

// Route imports
const contentRoutes = require('./api/routes/content');
const mediaRoutes = require('./api/routes/media');
const userRoutes = require('./api/routes/users');
const searchRoutes = require('./api/routes/search');
const templateRoutes = require('./api/routes/templates');
const webhookRoutes = require('./api/routes/webhooks');

// Middleware imports
const { authenticate, optionalAuth } = require('./api/middleware/auth');
const { errorHandler } = require('./api/middleware/errorHandler');
const { requestLogger } = require('./api/middleware/logger');
const { rateLimiter } = require('./api/middleware/rateLimit');

// Services
const db = require('./storage/database');

const app = express();

// Global middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(requestLogger);
app.use(rateLimiter);

// Public routes
app.use('/api/content', optionalAuth, contentRoutes);
app.use('/api/search', optionalAuth, searchRoutes);

// Authenticated routes
app.use('/api/media', authenticate, mediaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/templates', authenticate, templateRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'healthy', version: '2.1.0' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy' });
  }
});

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CMS API on port ${PORT}`));

module.exports = app;
