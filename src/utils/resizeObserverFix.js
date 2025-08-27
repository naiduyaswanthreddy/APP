// ResizeObserver loop error fix
// This suppresses the common "ResizeObserver loop completed with undelivered notifications" error

export const suppressResizeObserverError = () => {
  // Store the original error handler
  const originalErrorHandler = window.onerror;
  const originalConsoleError = console.error;
  
  window.onerror = function(message, source, lineno, colno, error) {
    // Check if the error is a ResizeObserver loop error
    if (message.includes('ResizeObserver loop completed with undelivered notifications')) {
      console.warn('ResizeObserver loop error suppressed:', message);
      return true; // Prevent the error from being logged
    }
    
    // Call the original error handler for other errors
    if (originalErrorHandler) {
      return originalErrorHandler.call(this, message, source, lineno, colno, error);
    }
    
    return false;
  };

  // Also handle unhandled promise rejections
  const originalRejectionHandler = window.onunhandledrejection;
  
  window.onunhandledrejection = function(event) {
    if (event.reason && event.reason.message && 
        event.reason.message.includes('ResizeObserver loop completed with undelivered notifications')) {
      console.warn('ResizeObserver loop error suppressed in promise:', event.reason.message);
      event.preventDefault();
      return;
    }
    
    if (originalRejectionHandler) {
      return originalRejectionHandler.call(this, event);
    }
  };

  // Some environments dispatch an ErrorEvent that bypasses window.onerror
  const roErrorListener = (event) => {
    const msg = event?.message || event?.error?.message || '';
    if (typeof msg === 'string' && msg.includes('ResizeObserver loop completed with undelivered notifications')) {
      console.warn('ResizeObserver loop error suppressed via event listener');
      event.stopImmediatePropagation?.();
      event.preventDefault?.();
    }
  };
  window.addEventListener('error', roErrorListener, true);

  // Promise-based ResizeObserver errors may surface here too
  const roRejectionListener = (event) => {
    const reason = event?.reason;
    const msg = reason?.message || (typeof reason === 'string' ? reason : '');
    if (typeof msg === 'string' && msg.includes('ResizeObserver loop completed with undelivered notifications')) {
      console.warn('ResizeObserver loop error suppressed via unhandledrejection');
      event.preventDefault?.();
    }
  };
  window.addEventListener('unhandledrejection', roRejectionListener);

  // Filter noisy console.error for this specific message (keep others intact)
  console.error = function(...args) {
    try {
      const combined = args.map(a => (a && a.stack) ? a.stack : a).join(' ');
      if (typeof combined === 'string' && combined.includes('ResizeObserver loop completed with undelivered notifications')) {
        console.warn('ResizeObserver loop error suppressed via console.error filter');
        return;
      }
    } catch (_) { /* noop */ }
    return originalConsoleError.apply(console, args);
  };
};

// Utility function to safely use ResizeObserver with cleanup
export const createSafeResizeObserver = (callback) => {
  let resizeObserver;
  
  try {
    resizeObserver = new ResizeObserver((entries) => {
      // Use requestAnimationFrame to prevent loop errors
      window.requestAnimationFrame(() => {
        if (entries.length > 0) {
          callback(entries);
        }
      });
    });
  } catch (error) {
    console.warn('ResizeObserver not supported:', error);
    return null;
  }
  
  return resizeObserver;
};
