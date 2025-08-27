// Centralized error handling and retry logic
import { toast } from 'react-toastify';
import React, { useState, useEffect, useContext } from 'react';


class ErrorHandler {
  constructor() {
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.retryDelay = 1000; // Base delay in ms
  }

  // Exponential backoff retry logic
  async withRetry(operation, operationName, maxRetries = this.maxRetries) {
    const attemptKey = `${operationName}_${Date.now()}`;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        this.retryAttempts.delete(attemptKey);
        return result;
      } catch (error) {
        console.error(`Attempt ${attempt} failed for ${operationName}:`, error);
        
        if (attempt === maxRetries) {
          this.handleError(error, operationName);
          throw error;
        }
        
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
  }

  // Handle different types of errors
  handleError(error, context = 'Unknown') {
    const errorInfo = {
      message: error.message,
      code: error.code,
      context,
      timestamp: new Date().toISOString(),
      stack: error.stack
    };

    // Log to console for debugging
    console.error('Error handled:', errorInfo);

    // Send to monitoring service (implement based on your monitoring solution)
    this.logToMonitoring(errorInfo);

    // Show user-friendly message
    this.showUserMessage(error, context);
  }

  // Show appropriate user message based on error type
  showUserMessage(error, context) {
    let message = 'An unexpected error occurred. Please try again.';
    
    if (error.code === 'permission-denied') {
      message = 'You don\'t have permission to perform this action.';
    } else if (error.code === 'network-request-failed') {
      message = 'Network error. Please check your connection and try again.';
    } else if (error.code === 'quota-exceeded') {
      message = 'Service temporarily unavailable. Please try again later.';
    } else if (error.code === 'unauthenticated') {
      message = 'Please log in again to continue.';
    } else if (context.includes('fetch')) {
      message = 'Failed to load data. Please refresh the page.';
    } else if (context.includes('save') || context.includes('update')) {
      message = 'Failed to save changes. Please try again.';
    }

    toast.error(message);
  }

  // Log errors to monitoring service
  logToMonitoring(errorInfo) {
    // Implement your monitoring service integration here
    // Examples: Sentry, LogRocket, DataDog, etc.
    
    // For now, store in localStorage for debugging
    try {
      const errors = JSON.parse(localStorage.getItem('error_logs') || '[]');
      errors.push(errorInfo);
      
      // Keep only last 100 errors
      if (errors.length > 100) {
        errors.splice(0, errors.length - 100);
      }
      
      localStorage.setItem('error_logs', JSON.stringify(errors));
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  }

  // Utility function for delays
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Rate limiting for API calls
  createRateLimiter(maxCalls, timeWindow) {
    const calls = [];
    
    return async (operation) => {
      const now = Date.now();
      
      // Remove old calls outside the time window
      while (calls.length > 0 && calls[0] < now - timeWindow) {
        calls.shift();
      }
      
      // Check if we've exceeded the rate limit
      if (calls.length >= maxCalls) {
        const waitTime = calls[0] + timeWindow - now;
        await this.sleep(waitTime);
        return this.createRateLimiter(maxCalls, timeWindow)(operation);
      }
      
      calls.push(now);
      return operation();
    };
  }

  // Firebase-specific error handling
  handleFirebaseError(error, operation) {
    const firebaseErrors = {
      'permission-denied': 'Access denied. Please check your permissions.',
      'not-found': 'The requested data was not found.',
      'already-exists': 'This item already exists.',
      'resource-exhausted': 'Service temporarily unavailable due to high demand.',
      'failed-precondition': 'Operation cannot be completed due to current state.',
      'aborted': 'Operation was aborted. Please try again.',
      'out-of-range': 'Invalid input parameters.',
      'unimplemented': 'This feature is not yet available.',
      'internal': 'Internal server error. Please try again later.',
      'unavailable': 'Service temporarily unavailable.',
      'data-loss': 'Data corruption detected. Please contact support.',
      'unauthenticated': 'Authentication required. Please log in again.'
    };

    const message = firebaseErrors[error.code] || error.message;
    console.error(`Firebase ${operation} error:`, error);
    toast.error(message);
    
    this.logToMonitoring({
      type: 'firebase_error',
      operation,
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }

  // Network error handling
  handleNetworkError(error, operation) {
    console.error(`Network error in ${operation}:`, error);
    
    if (!navigator.onLine) {
      toast.error('You appear to be offline. Please check your connection.');
    } else {
      toast.error('Network error. Please try again.');
    }
    
    this.logToMonitoring({
      type: 'network_error',
      operation,
      online: navigator.onLine,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Convenience functions
export const withRetry = (operation, operationName, maxRetries) => 
  errorHandler.withRetry(operation, operationName, maxRetries);

export const handleError = (error, context) => 
  errorHandler.handleError(error, context);

export const handleFirebaseError = (error, operation) => 
  errorHandler.handleFirebaseError(error, operation);

export const handleNetworkError = (error, operation) => 
  errorHandler.handleNetworkError(error, operation);

export const createRateLimiter = (maxCalls, timeWindow) => 
  errorHandler.createRateLimiter(maxCalls, timeWindow);

// Global error boundary component
export class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    errorHandler.logToMonitoring({
      type: 'react_error_boundary',
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="mt-4 text-center">
              <h3 className="text-lg font-medium text-gray-900">Something went wrong</h3>
              <p className="mt-2 text-sm text-gray-500">
                We're sorry, but something unexpected happened. Please refresh the page and try again.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
