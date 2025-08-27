// Lightweight analytics service used by performanceMonitor
// Default export must provide a track(metric) function.

const QUEUE_KEY = 'analytics_queue';
const MAX_QUEUE = 20;
const FLUSH_INTERVAL_MS = 60_000; // 1 minute

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

function setQueue(q) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch (_) {
    // ignore
  }
}

async function flushQueue() {
  const queue = getQueue();
  if (!queue.length) return;
  try {
    const res = await fetch('/api/analytics/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics: queue })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setQueue([]);
  } catch (e) {
    // Keep queue for retry
    // Optionally limit size to avoid unbounded growth
    const trimmed = queue.slice(-200);
    setQueue(trimmed);
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('Analytics flush failed, will retry later:', e);
    }
  }
}

// Auto flush periodically in the background
if (typeof window !== 'undefined') {
  setInterval(() => {
    flushQueue();
  }, FLUSH_INTERVAL_MS);
}

const analyticsService = {
  track(metric) {
    try {
      // In dev, just log to console for visibility
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[analytics] metric', metric);
      }
      const queue = getQueue();
      queue.push(metric);
      setQueue(queue);
      if (queue.length >= MAX_QUEUE) {
        flushQueue();
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to track metric:', e);
    }
  }
};

export default analyticsService;
