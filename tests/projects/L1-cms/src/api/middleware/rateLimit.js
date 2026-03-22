const rateStore = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX = 200;

function rateLimiter(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const record = rateStore.get(ip) || { count: 0, resetAt: now + WINDOW };
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + WINDOW; }
  record.count++;
  rateStore.set(ip, record);
  if (record.count > MAX) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  next();
}
module.exports = { rateLimiter };
