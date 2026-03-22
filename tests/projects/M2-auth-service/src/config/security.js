/**
 * Security configuration
 * Centralizes all security-related settings
 */

module.exports = {
  // JWT secrets — MUST be set via environment variables in production
  jwtSecret: process.env.JWT_SECRET || 'dev-access-secret-32chars-min!!',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-32chars-min!',
  jwtResetSecret: process.env.JWT_RESET_SECRET || 'dev-reset-secret-32chars-minimum',

  // Password hashing
  saltRounds: 12,

  // Rate limiting
  rateLimiting: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    loginMaxAttempts: 5,
    loginWindowMs: 30 * 60 * 1000,
  },

  // Session
  session: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxSessions: 5,
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
};
