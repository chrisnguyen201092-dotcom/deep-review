/**
 * Audit logging middleware
 * Logs all requests for compliance and debugging
 */

const db = require('../models/db');
const Audit = require('../models/audit.model');

function auditLog(req, res, next) {
  const start = Date.now();

  // Capture response details after request completes
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - start;
    const logEntry = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user ? req.user.id : null,
      duration,
      timestamp: new Date().toISOString(),
    };

    // Log to console in dev, to database in production
    if (process.env.NODE_ENV === 'production') {
      // Non-blocking database write — fire and forget
      Audit.logRequest(logEntry).catch(() => {});
    } else {
      const summary = `${logEntry.method} ${logEntry.path} ${logEntry.statusCode} ${duration}ms`;
      console.log(`[AUDIT] ${summary}`);
    }

    originalEnd.apply(res, args);
  };

  next();
}

module.exports = { auditLog };
