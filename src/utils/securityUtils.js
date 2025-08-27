// Security utilities and best practices
import DOMPurify from 'dompurify';

class SecurityManager {
  constructor() {
    this.rateLimiters = new Map();
    this.blockedIPs = new Set();
    this.suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi
    ];
  }

  // Sanitize HTML content to prevent XSS
  sanitizeHTML(html) {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'target'],
      ALLOW_DATA_ATTR: false
    });
  }

  // Sanitize user input
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // Remove potentially dangerous characters
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  // Validate email format
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  // Validate phone number
  validatePhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  // Validate URL
  validateURL(url) {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  // Check for suspicious content
  detectSuspiciousContent(content) {
    if (typeof content !== 'string') return false;
    
    return this.suspiciousPatterns.some(pattern => pattern.test(content));
  }

  // Rate limiting implementation
  createRateLimiter(key, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!this.rateLimiters.has(key)) {
      this.rateLimiters.set(key, []);
    }
    
    const requests = this.rateLimiters.get(key);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    validRequests.push(now);
    this.rateLimiters.set(key, validRequests);
    return true;
  }

  // Secure API key storage
  storeAPIKey(key, value) {
    // Never store API keys in localStorage in production
    if (process.env.NODE_ENV === 'development') {
      sessionStorage.setItem(`secure_${key}`, btoa(value));
    } else {
      console.warn('API keys should not be stored client-side in production');
    }
  }

  getAPIKey(key) {
    if (process.env.NODE_ENV === 'development') {
      const stored = sessionStorage.getItem(`secure_${key}`);
      return stored ? atob(stored) : null;
    }
    return null;
  }

  // Content Security Policy helpers
  generateCSPNonce() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array));
  }

  // Secure headers for API requests
  getSecureHeaders(includeAuth = false) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    if (includeAuth) {
      const token = this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  // Secure token management
  setAuthToken(token) {
    // Use httpOnly cookies in production, sessionStorage for development
    if (process.env.NODE_ENV === 'production') {
      // This should be handled server-side with httpOnly cookies
      console.warn('Auth tokens should use httpOnly cookies in production');
    } else {
      sessionStorage.setItem('auth_token', token);
    }
  }

  getAuthToken() {
    return sessionStorage.getItem('auth_token');
  }

  clearAuthToken() {
    sessionStorage.removeItem('auth_token');
  }

  // Password strength validation
  validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const score = [
      password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar
    ].filter(Boolean).length;

    return {
      isValid: score >= 4,
      score,
      feedback: this.getPasswordFeedback(password, {
        minLength: password.length >= minLength,
        hasUpperCase,
        hasLowerCase,
        hasNumbers,
        hasSpecialChar
      })
    };
  }

  getPasswordFeedback(password, checks) {
    const feedback = [];
    
    if (!checks.minLength) {
      feedback.push('Password must be at least 8 characters long');
    }
    if (!checks.hasUpperCase) {
      feedback.push('Password must contain at least one uppercase letter');
    }
    if (!checks.hasLowerCase) {
      feedback.push('Password must contain at least one lowercase letter');
    }
    if (!checks.hasNumbers) {
      feedback.push('Password must contain at least one number');
    }
    if (!checks.hasSpecialChar) {
      feedback.push('Password must contain at least one special character');
    }

    return feedback;
  }

  // File upload security
  validateFileUpload(file, allowedTypes = [], maxSize = 5 * 1024 * 1024) {
    const errors = [];

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
    }

    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }

    // Check file extension
    const extension = file.name.split('.').pop().toLowerCase();
    const dangerousExtensions = ['exe', 'bat', 'cmd', 'scr', 'pif', 'vbs', 'js'];
    if (dangerousExtensions.includes(extension)) {
      errors.push('File type is not allowed for security reasons');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Secure random string generation
  generateSecureRandom(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Log security events
  logSecurityEvent(event, details = {}) {
    const securityLog = {
      event,
      details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ip: 'client-side' // Would be filled server-side
    };

    // Store locally for debugging, send to server in production
    const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
    logs.push(securityLog);
    
    // Keep only last 100 logs
    if (logs.length > 100) {
      logs.splice(0, logs.length - 100);
    }
    
    localStorage.setItem('security_logs', JSON.stringify(logs));

    // In production, send to security monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendToSecurityService(securityLog);
    }
  }

  async sendToSecurityService(logEntry) {
    try {
      await fetch('/api/security/log', {
        method: 'POST',
        headers: this.getSecureHeaders(),
        body: JSON.stringify(logEntry)
      });
    } catch (error) {
      console.error('Failed to send security log:', error);
    }
  }
}

// Create singleton instance
export const securityManager = new SecurityManager();

// React hooks for security
import { useState, useCallback } from 'react';

export const useSecureInput = (initialValue = '') => {
  const [value, setValue] = useState(initialValue);
  const [isValid, setIsValid] = useState(true);
  const [errors, setErrors] = useState([]);

  const updateValue = useCallback((newValue) => {
    const sanitized = securityManager.sanitizeInput(newValue);
    const isSuspicious = securityManager.detectSuspiciousContent(sanitized);
    
    if (isSuspicious) {
      securityManager.logSecurityEvent('suspicious_input', { 
        input: newValue,
        sanitized 
      });
      setIsValid(false);
      setErrors(['Input contains potentially dangerous content']);
    } else {
      setIsValid(true);
      setErrors([]);
    }
    
    setValue(sanitized);
  }, []);

  return { value, updateValue, isValid, errors };
};

export const useRateLimiter = (key, maxRequests = 10, windowMs = 60000) => {
  const checkRateLimit = useCallback(() => {
    return securityManager.createRateLimiter(key, maxRequests, windowMs);
  }, [key, maxRequests, windowMs]);

  return checkRateLimit;
};

// Security validation functions
export const validateInput = (input, type = 'text') => {
  switch (type) {
    case 'email':
      return securityManager.validateEmail(input);
    case 'phone':
      return securityManager.validatePhone(input);
    case 'url':
      return securityManager.validateURL(input);
    case 'password':
      return securityManager.validatePasswordStrength(input);
    default:
      return !securityManager.detectSuspiciousContent(input);
  }
};

export const sanitizeHTML = (html) => securityManager.sanitizeHTML(html);
export const sanitizeInput = (input) => securityManager.sanitizeInput(input);
export const validateFileUpload = (file, allowedTypes, maxSize) => 
  securityManager.validateFileUpload(file, allowedTypes, maxSize);
