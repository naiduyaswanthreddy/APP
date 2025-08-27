import { useState, useEffect, useRef } from 'react';

// Simple in-memory cache with TTL (Time To Live)
class ApiCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  set(key, data, ttl = 300000) { // Default 5 minutes TTL
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set data in cache
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Set expiration timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);

    this.timers.set(key, timer);
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.delete(key);
      return null;
    }

    return item.data;
  }

  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  clear() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.cache.clear();
    this.timers.clear();
  }

  has(key) {
    return this.cache.has(key) && this.get(key) !== null;
  }
}

// Global cache instance
const globalCache = new ApiCache();

// Custom hook for API caching
export const useApiCache = (key, fetchFunction, options = {}) => {
  const {
    ttl = 300000, // 5 minutes default
    enabled = true,
    dependencies = [],
    staleWhileRevalidate = false
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  
  const fetchRef = useRef(fetchFunction);
  const abortControllerRef = useRef(null);

  // Update fetch function ref
  useEffect(() => {
    fetchRef.current = fetchFunction;
  }, [fetchFunction]);

  // Generate cache key including dependencies
  const cacheKey = `${key}_${JSON.stringify(dependencies)}`;

  const fetchData = async (useCache = true, markAsStale = false) => {
    if (!enabled) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Check cache first
    if (useCache && globalCache.has(cacheKey)) {
      const cachedData = globalCache.get(cacheKey);
      setData(cachedData);
      setError(null);
      setIsStale(markAsStale);
      
      if (!markAsStale) {
        setLoading(false);
        return cachedData;
      }
    }

    setLoading(true);
    setError(null);

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      const result = await fetchRef.current(abortControllerRef.current.signal);
      
      // Only update if request wasn't aborted
      if (!abortControllerRef.current.signal.aborted) {
        setData(result);
        setError(null);
        setIsStale(false);
        
        // Cache the result
        globalCache.set(cacheKey, result, ttl);
      }
      
      return result;
    } catch (err) {
      if (!abortControllerRef.current.signal.aborted) {
        setError(err);
        console.error(`API Error for ${key}:`, err);
      }
      throw err;
    } finally {
      if (!abortControllerRef.current.signal.aborted) {
        setLoading(false);
      }
    }
  };

  // Initial fetch and dependency-based refetch
  useEffect(() => {
    if (enabled) {
      fetchData();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, cacheKey]);

  // Stale-while-revalidate logic
  useEffect(() => {
    if (!staleWhileRevalidate || !enabled) return;

    const checkStale = () => {
      if (globalCache.has(cacheKey)) {
        const item = globalCache.cache.get(cacheKey);
        const age = Date.now() - item.timestamp;
        const staleThreshold = item.ttl * 0.8; // Consider stale at 80% of TTL

        if (age > staleThreshold) {
          fetchData(true, true); // Fetch in background, mark as stale
        }
      }
    };

    const interval = setInterval(checkStale, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [cacheKey, staleWhileRevalidate, enabled]);

  const refetch = () => fetchData(false);
  const invalidate = () => {
    globalCache.delete(cacheKey);
    return fetchData(false);
  };

  return {
    data,
    loading,
    error,
    isStale,
    refetch,
    invalidate,
    isCached: globalCache.has(cacheKey)
  };
};

// Hook for manual cache management
export const useCache = () => {
  return {
    set: (key, data, ttl) => globalCache.set(key, data, ttl),
    get: (key) => globalCache.get(key),
    delete: (key) => globalCache.delete(key),
    clear: () => globalCache.clear(),
    has: (key) => globalCache.has(key)
  };
};

// Preload data into cache
export const preloadData = async (key, fetchFunction, ttl = 300000) => {
  try {
    const data = await fetchFunction();
    globalCache.set(key, data, ttl);
    return data;
  } catch (error) {
    console.error(`Preload failed for ${key}:`, error);
    throw error;
  }
};

export default useApiCache;
