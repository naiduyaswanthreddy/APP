// Enhanced Error Logging and User-Friendly Error Handling
import { toast } from 'react-toastify';

class ErrorLogger {
  constructor() {
    this.logLevel = process.env.NODE_ENV === 'production' ? 'error' : 'debug';
    this.maxLogs = 100;
    this.logs = [];
  }

  // Log error with context
  logError(error, context = {}) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      stack: error.stack,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: context.userId || 'anonymous'
    };

    this.logs.push(errorLog);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error logged:', errorLog);
    }

    // Send to Firebase for production monitoring
    if (process.env.NODE_ENV === 'production') {
      this.sendToFirebase(errorLog);
    }

    return errorLog;
  }

  // Send error logs to Firebase
  async sendToFirebase(errorLog) {
    try {
      const { db } = await import('../firebase');
      const { collection, addDoc } = await import('firebase/firestore');
      
      await addDoc(collection(db, 'errorLogs'), errorLog);
    } catch (fbError) {
      console.error('Failed to send error to Firebase:', fbError);
    }
  }

  // Show user-friendly error messages
  showUserError(error, context = {}) {
    const userMessage = this.getUserFriendlyMessage(error, context);
    toast.error(userMessage, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
    
    this.logError(error, context);
  }

  // Convert technical errors to user-friendly messages
  getUserFriendlyMessage(error, context) {
    const errorMessage = error.message?.toLowerCase() || '';
    
    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'Connection issue. Please check your internet and try again.';
    }
    
    // Firebase Auth errors
    if (errorMessage.includes('auth/user-not-found')) {
      return 'Account not found. Please check your email or sign up.';
    }
    if (errorMessage.includes('auth/wrong-password')) {
      return 'Incorrect password. Please try again.';
    }
    if (errorMessage.includes('auth/email-already-in-use')) {
      return 'Email already registered. Try logging in instead.';
    }
    if (errorMessage.includes('auth/weak-password')) {
      return 'Password too weak. Use at least 6 characters.';
    }
    if (errorMessage.includes('auth/invalid-email')) {
      return 'Invalid email format. Please check and try again.';
    }
    
    // Firestore errors
    if (errorMessage.includes('permission-denied')) {
      return 'Access denied. Please check your permissions.';
    }
    if (errorMessage.includes('not-found')) {
      return 'Requested data not found. It may have been deleted.';
    }
    
    // Resume builder specific errors
    if (context.component === 'resumeBuilder') {
      return 'Resume builder error. Your changes have been saved locally.';
    }
    
    // Job application errors
    if (context.component === 'jobApplication') {
      return 'Application submission failed. Please try again.';
    }
    
    // File upload errors
    if (errorMessage.includes('storage') || context.component === 'fileUpload') {
      return 'File upload failed. Please check file size and format.';
    }
    
    // Default message
    return 'Something went wrong. Our team has been notified.';
  }

  // Get recent logs for debugging
  getRecentLogs(count = 10) {
    return this.logs.slice(-count);
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
  }
}

// Create singleton instance
const errorLogger = new ErrorLogger();

// Enhanced error boundary hook
export const useErrorHandler = () => {
  const handleError = (error, context = {}) => {
    errorLogger.showUserError(error, context);
  };

  const handleAsyncError = async (asyncFunction, context = {}) => {
    try {
      return await asyncFunction();
    } catch (error) {
      handleError(error, context);
      throw error; // Re-throw for component-level handling
    }
  };

  return { handleError, handleAsyncError };
};

export default errorLogger;
