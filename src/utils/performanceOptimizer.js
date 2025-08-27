// Performance optimization utilities
import { debounce, throttle } from 'lodash';

// Debounced search function
export const createDebouncedSearch = (searchFunction, delay = 300) => {
  return debounce(searchFunction, delay);
};

// Throttled scroll handler
export const createThrottledScroll = (scrollFunction, delay = 100) => {
  return throttle(scrollFunction, delay);
};

// Image lazy loading with intersection observer
export const createImageLazyLoader = () => {
  if (!('IntersectionObserver' in window)) {
    return null;
  }

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.remove('lazy');
        observer.unobserve(img);
      }
    });
  });

  return {
    observe: (img) => imageObserver.observe(img),
    disconnect: () => imageObserver.disconnect()
  };
};

// Memory usage monitor
export const memoryMonitor = {
  logMemoryUsage: () => {
    if (performance.memory) {
      console.log('Memory Usage:', {
        used: Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB',
        total: Math.round(performance.memory.totalJSHeapSize / 1048576) + ' MB',
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) + ' MB'
      });
    }
  },
  
  checkMemoryPressure: () => {
    if (performance.memory) {
      const usage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
      return usage > 0.8; // Return true if using more than 80% of available memory
    }
    return false;
  }
};

// Bundle analyzer helper
export const bundleAnalyzer = {
  logLargestComponents: () => {
    const components = [];
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'measure' && entry.name.includes('React')) {
          components.push({
            name: entry.name,
            duration: entry.duration
          });
        }
      });
    });
    observer.observe({ entryTypes: ['measure'] });
    
    setTimeout(() => {
      observer.disconnect();
      components.sort((a, b) => b.duration - a.duration);
      console.log('Slowest React Components:', components.slice(0, 10));
    }, 5000);
  }
};

// Performance metrics collector
export const performanceMetrics = {
  measureComponentRender: (componentName, renderFunction) => {
    const start = performance.now();
    const result = renderFunction();
    const end = performance.now();
    
    if (end - start > 16) { // Log if render takes more than 16ms (60fps threshold)
      console.warn(`Slow render detected: ${componentName} took ${(end - start).toFixed(2)}ms`);
    }
    
    return result;
  },

  measureAsyncOperation: async (operationName, asyncFunction) => {
    const start = performance.now();
    try {
      const result = await asyncFunction();
      const end = performance.now();
      console.log(`${operationName} completed in ${(end - start).toFixed(2)}ms`);
      return result;
    } catch (error) {
      const end = performance.now();
      console.error(`${operationName} failed after ${(end - start).toFixed(2)}ms:`, error);
      throw error;
    }
  }
};

// Cache management
export const cacheManager = {
  set: (key, data, ttl = 300000) => { // Default 5 minutes TTL
    const item = {
      data,
      timestamp: Date.now(),
      ttl
    };
    localStorage.setItem(`cache_${key}`, JSON.stringify(item));
  },

  get: (key) => {
    const item = localStorage.getItem(`cache_${key}`);
    if (!item) return null;

    const { data, timestamp, ttl } = JSON.parse(item);
    if (Date.now() - timestamp > ttl) {
      localStorage.removeItem(`cache_${key}`);
      return null;
    }
    return data;
  },

  clear: (pattern) => {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('cache_') && (!pattern || key.includes(pattern))) {
        localStorage.removeItem(key);
      }
    });
  },

  clearExpired: () => {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('cache_')) {
        const item = localStorage.getItem(key);
        if (item) {
          const { timestamp, ttl } = JSON.parse(item);
          if (Date.now() - timestamp > ttl) {
            localStorage.removeItem(key);
          }
        }
      }
    });
  }
};
