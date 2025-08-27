// Performance monitoring and analytics

import { useEffect, useRef } from 'react';  
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.isEnabled = process.env.NODE_ENV === 'production';
  }

  // Initialize performance monitoring
  init() {
    if (!this.isEnabled) return;

    this.setupWebVitals();
    this.setupResourceObserver();
    this.setupNavigationObserver();
    this.setupLongTaskObserver();
    this.setupMemoryMonitoring();
  }

  // Core Web Vitals monitoring
  setupWebVitals() {
    // Largest Contentful Paint (LCP)
    this.observeMetric('largest-contentful-paint', (entry) => {
      this.recordMetric('LCP', entry.startTime, {
        element: entry.element?.tagName,
        url: entry.url
      });
    });

    // First Input Delay (FID)
    this.observeMetric('first-input', (entry) => {
      this.recordMetric('FID', entry.processingStart - entry.startTime, {
        eventType: entry.name
      });
    });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    this.observeMetric('layout-shift', (entry) => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
        this.recordMetric('CLS', clsValue);
      }
    });
  }

  // Resource loading performance
  setupResourceObserver() {
    this.observeMetric('resource', (entry) => {
      if (entry.duration > 1000) { // Log slow resources (>1s)
        this.recordMetric('SlowResource', entry.duration, {
          name: entry.name,
          type: entry.initiatorType,
          size: entry.transferSize
        });
      }
    });
  }

  // Navigation timing
  setupNavigationObserver() {
    this.observeMetric('navigation', (entry) => {
      this.recordMetric('PageLoad', entry.loadEventEnd - entry.fetchStart, {
        domContentLoaded: entry.domContentLoadedEventEnd - entry.fetchStart,
        firstPaint: entry.responseEnd - entry.fetchStart
      });
    });
  }

  // Long task detection
  setupLongTaskObserver() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.recordMetric('LongTask', entry.duration, {
              startTime: entry.startTime,
              attribution: entry.attribution?.[0]?.name
            });
          });
        });
        observer.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', observer);
      } catch (e) {
        console.warn('Long task observer not supported');
      }
    }
  }

  // Memory usage monitoring
  setupMemoryMonitoring() {
    if (performance.memory) {
      setInterval(() => {
        const memory = performance.memory;
        this.recordMetric('MemoryUsage', memory.usedJSHeapSize, {
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
          percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
        });
      }, 30000); // Every 30 seconds
    }
  }

  // Generic metric observer
  observeMetric(type, callback) {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(callback);
      });
      observer.observe({ entryTypes: [type] });
      this.observers.set(type, observer);
    } catch (e) {
      console.warn(`Performance observer for ${type} not supported`);
    }
  }

  // Record performance metric
  recordMetric(name, value, metadata = {}) {
    const metric = {
      name,
      value,
      timestamp: Date.now(),
      url: window.location.pathname,
      userAgent: navigator.userAgent,
      connection: this.getConnectionInfo(),
      ...metadata
    };

    // Store locally
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push(metric);

    // Send to analytics service
    this.sendToAnalytics(metric);

    // Log warnings for poor performance
    this.checkPerformanceThresholds(name, value);
  }

  // Get connection information
  getConnectionInfo() {
    if ('connection' in navigator) {
      const conn = navigator.connection;
      return {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData
      };
    }
    return null;
  }

  // Check performance thresholds and warn
  checkPerformanceThresholds(name, value) {
    const thresholds = {
      LCP: 2500, // 2.5s
      FID: 100,  // 100ms
      CLS: 0.1,  // 0.1
      PageLoad: 3000, // 3s
      LongTask: 50,   // 50ms
      SlowResource: 2000 // 2s
    };

    if (thresholds[name] && value > thresholds[name]) {
      console.warn(`Performance warning: ${name} (${value}) exceeded threshold (${thresholds[name]})`);
    }
  }

  // Send metrics to analytics service with code splitting optimization
  sendToAnalytics(metric) {
    // Implement lazy loading for analytics to improve initial load time
    this.loadAnalyticsLazily().then(analytics => {
      analytics.track(metric);
    }).catch(error => {
      console.error('Analytics loading failed:', error);
    });
    
    // Batch and send to localStorage for debugging
    try {
      const batch = JSON.parse(localStorage.getItem('performance_batch') || '[]');
      batch.push(metric);
      
      // Send batch when it reaches 10 metrics or every 5 minutes
      if (batch.length >= 10) {
        this.flushBatch(batch);
        localStorage.removeItem('performance_batch');
      } else {
        localStorage.setItem('performance_batch', JSON.stringify(batch));
      }
    } catch (e) {
      console.error('Failed to batch performance metric:', e);
    }
  }

  // Lazy load analytics to improve initial performance
  async loadAnalyticsLazily() {
    if (!this.analyticsModule) {
      // Dynamic import for code splitting
      this.analyticsModule = await import('../analytics/analyticsService');
    }
    return this.analyticsModule.default;
  }

  // Flush metrics batch to server
  async flushBatch(batch) {
    try {
      // Replace with your actual analytics endpoint
      const response = await fetch('/api/analytics/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metrics: batch })
      });

      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send performance metrics:', error);
      // Store failed batch for retry
      const failedBatches = JSON.parse(localStorage.getItem('failed_performance_batches') || '[]');
      failedBatches.push(batch);
      localStorage.setItem('failed_performance_batches', JSON.stringify(failedBatches));
    }
  }

  // Get performance summary
  getPerformanceSummary() {
    const summary = {};
    
    this.metrics.forEach((values, name) => {
      const recentValues = values.slice(-10); // Last 10 measurements
      summary[name] = {
        count: values.length,
        latest: recentValues[recentValues.length - 1]?.value,
        average: recentValues.reduce((sum, m) => sum + m.value, 0) / recentValues.length,
        max: Math.max(...recentValues.map(m => m.value)),
        min: Math.min(...recentValues.map(m => m.value))
      };
    });

    return summary;
  }

  // Component performance tracking
  trackComponentRender(componentName, renderTime) {
    this.recordMetric('ComponentRender', renderTime, {
      component: componentName
    });
  }

  // API call performance tracking
  trackAPICall(endpoint, duration, status) {
    this.recordMetric('APICall', duration, {
      endpoint,
      status,
      success: status >= 200 && status < 300
    });
  }

  // User interaction tracking
  trackUserInteraction(action, element, duration = 0) {
    this.recordMetric('UserInteraction', duration, {
      action,
      element: element?.tagName || element,
      timestamp: Date.now()
    });
  }

  // Bundle size tracking with optimization recommendations
  trackBundleSize() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.name.includes('.js') || entry.name.includes('.css')) {
            const compressionRatio = entry.encodedBodySize / entry.decodedBodySize;
            const isLarge = entry.transferSize > 1024 * 1024; // > 1MB
            
            this.recordMetric('BundleSize', entry.transferSize, {
              name: entry.name,
              type: entry.name.includes('.js') ? 'javascript' : 'css',
              compressed: entry.encodedBodySize,
              uncompressed: entry.decodedBodySize,
              compressionRatio,
              isLarge,
              recommendation: isLarge ? 'Consider code splitting or lazy loading' : null
            });
            
            // Log performance warnings for large bundles
            if (isLarge) {
              console.warn(`Large bundle detected: ${entry.name} (${Math.round(entry.transferSize / 1024)}KB)`);
            }
          }
        });
      });
      observer.observe({ entryTypes: ['resource'] });
    }
  }

  // Enhanced cleanup with performance optimization
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    
    // Clear performance data to free memory
    this.metrics.clear();
    
    // Send any remaining batched data
    const remainingBatch = JSON.parse(localStorage.getItem('performance_batch') || '[]');
    if (remainingBatch.length > 0) {
      this.flushBatch(remainingBatch);
      localStorage.removeItem('performance_batch');
    }
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for component performance tracking


export const usePerformanceTracking = (componentName) => {
  const renderStart = useRef();

  useEffect(() => {
    renderStart.current = performance.now();
  });

  useEffect(() => {
    if (renderStart.current) {
      const renderTime = performance.now() - renderStart.current;
      performanceMonitor.trackComponentRender(componentName, renderTime);
    }
  });

  const trackInteraction = (action, element) => {
    performanceMonitor.trackUserInteraction(action, element);
  };

  return { trackInteraction };
};

// Higher-order component for performance tracking
export const withPerformanceTracking = (WrappedComponent, componentName) => {
  return function PerformanceTrackedComponent(props) {
    const renderStart = performance.now();
    
    useEffect(() => {
      const renderTime = performance.now() - renderStart;
      performanceMonitor.trackComponentRender(componentName, renderTime);
    });

    return <WrappedComponent {...props} />;
  };
};
