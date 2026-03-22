/**
 * Rate limiting middleware
 * Simple in-memory rate limiter based on IP address
 */

const requestCounts = new Map();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  const record = requestCounts.get(ip);

  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + WINDOW_MS;
    return next();
  }

  record.count++;

  if (record.count > MAX_REQUESTS) {
    res.setHeader('Retry-After', Math.ceil((record.resetAt - now) / 1000));
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    });
  }

  next();
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetAt) {
      requestCounts.delete(ip);
    }
  }
}, 60 * 1000);

module.exports = { rateLimiter };
