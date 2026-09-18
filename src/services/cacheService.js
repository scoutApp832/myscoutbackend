const NodeCache = require('node-cache');

// Create cache instance with default TTL of 5 minutes
const cache = new NodeCache({ 
  stdTTL: 300, 
  checkperiod: 120 
});

/**
 * Get cached data
 */
const get = (key) => {
  return cache.get(key);
};

/**
 * Set cache data
 */
const set = (key, value, ttl = 300) => {
  return cache.set(key, value, ttl);
};

/**
 * Delete cached data
 */
const del = (key) => {
  return cache.del(key);
};

/**
 * Clear all cache
 */
const flush = () => {
  return cache.flushAll();
};

/**
 * Get cache stats
 */
const getStats = () => {
  return cache.getStats();
};

/**
 * Cache middleware for routes
 */
const cacheMiddleware = (ttl = 300, keyPrefix = 'route') => {
  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = `${keyPrefix}:${req.user?.id || 'anon'}:${req.originalUrl}`;
    
    // Try to get cached data
    const cachedData = get(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    // Store original send method
    const originalSend = res.json.bind(res);
    
    // Override send to cache response
    res.json = function(data) {
      // Only cache successful responses
      if (data && data.success !== false) {
        set(cacheKey, data, ttl);
      }
      return originalSend(data);
    };

    next();
  };
};

module.exports = {
  get,
  set,
  del,
  flush,
  getStats,
  cacheMiddleware
};