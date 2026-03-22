class RateLimiter {
  constructor(config = {}) {
    this.windowMs = config.windowMs || 60000;
    this.maxRequests = config.maxRequests || 100;
    this.store = new Map();
    setInterval(() => this._cleanup(), 30000);
  }
  check(req) {
    const key = this._getKey(req);
    const now = Date.now();
    const record = this.store.get(key) || { count: 0, resetAt: now + this.windowMs };
    if (now > record.resetAt) { record.count = 0; record.resetAt = now + this.windowMs; }
    record.count++;
    this.store.set(key, record);
    if (record.count > this.maxRequests) {
      return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
    }
    return { allowed: true, remaining: this.maxRequests - record.count };
  }
  _getKey(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  }
  _cleanup() {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetAt) this.store.delete(key);
    }
  }
}
module.exports = { RateLimiter };
