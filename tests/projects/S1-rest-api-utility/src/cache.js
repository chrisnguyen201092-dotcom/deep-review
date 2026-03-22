/**
 * Simple in-memory cache with TTL support
 * Designed for low-traffic API caching
 */

const store = new Map();

/**
 * Get a cached value. Returns null if expired or missing.
 */
function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Set a cache value with TTL in seconds.
 */
function set(key, value, ttlSeconds) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Invalidate all keys matching a prefix pattern
 */
function invalidatePattern(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Clear entire cache
 */
function clear() {
  store.clear();
}

/**
 * Get current cache size (for monitoring)
 */
function size() {
  return store.size;
}

module.exports = { get, set, invalidatePattern, clear, size };
