/**
 * Simple in-memory cache with TTL
 */
class Cache {
  constructor(defaultTtl = 300) {
    this.store = new Map();
    this.defaultTtl = defaultTtl * 1000;
    // Cleanup every minute
    setInterval(() => this._cleanup(), 60000);
  }
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    return entry.value;
  }
  set(key, value, ttl) {
    this.store.set(key, { value, expiresAt: Date.now() + (ttl || this.defaultTtl) });
  }
  invalidate(pattern) {
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) this.store.delete(key);
    }
  }
  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}
module.exports = Cache;
