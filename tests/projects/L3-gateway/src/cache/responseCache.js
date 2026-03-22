class ResponseCache {
  constructor() { this.cache = new Map(); }
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.cache.delete(key); return null; }
    return entry.data;
  }
  set(key, data, ttlSeconds = 60) { this.cache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 }); }
  invalidate(pattern) { for (const key of this.cache.keys()) { if (key.includes(pattern)) this.cache.delete(key); } }
  clear() { this.cache.clear(); }
  stats() { return { size: this.cache.size }; }
}
module.exports = { ResponseCache };
