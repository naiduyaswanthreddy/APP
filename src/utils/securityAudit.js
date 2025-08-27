// Security Audit and Enhancement Utilities
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

class SecurityAudit {
  constructor() {
    this.rateLimitMap = new Map();
    this.suspiciousActivityLog = [];
  }

  // Input sanitization for user-generated content
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  // Rate limiting for API calls
  checkRateLimit(userId, action, maxAttempts = 10, windowMs = 60000) {
    const key = `${userId}-${action}`;
    const now = Date.now();
    
    if (!this.rateLimitMap.has(key)) {
      this.rateLimitMap.set(key, []);
    }
    
    const attempts = this.rateLimitMap.get(key);
    const validAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
    
    if (validAttempts.length >= maxAttempts) {
      this.logSuspiciousActivity(userId, action, 'Rate limit exceeded');
      return false;
    }
    
    validAttempts.push(now);
    this.rateLimitMap.set(key, validAttempts);
    return true;
  }

  // Log suspicious activities
  logSuspiciousActivity(userId, action, reason) {
    const activity = {
      userId,
      action,
      reason,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      ip: 'client-side' // Would need server-side for real IP
    };
    
    this.suspiciousActivityLog.push(activity);
    console.warn('Suspicious activity detected:', activity);
  }

  // Validate file uploads
  validateFileUpload(file, allowedTypes = [], maxSize = 5 * 1024 * 1024) {
    const errors = [];
    
    if (!file) {
      errors.push('No file selected');
      return { valid: false, errors };
    }
    
    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit`);
    }
    
    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
    
    // Check for suspicious file extensions
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    const fileName = file.name.toLowerCase();
    const hasSuspiciousExtension = suspiciousExtensions.some(ext => fileName.endsWith(ext));
    
    if (hasSuspiciousExtension) {
      errors.push('File type not allowed for security reasons');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Validate user permissions
  async validateUserPermission(userId, requiredRole, action) {
    try {
      const userDoc = await getDoc(doc(db, 'students', userId));
      let userData = userDoc.data();
      
      // Try admin collection if not found in students
      if (!userData) {
        const adminDoc = await getDoc(doc(db, 'admins', userId));
        userData = adminDoc.data();
      }
      
      if (!userData) {
        this.logSuspiciousActivity(userId, action, 'User not found in database');
        return false;
      }
      
      const userRole = userData.role || 'student';
      
      // Define role hierarchy
      const roleHierarchy = {
        'student': 1,
        'admin': 2,
        'superadmin': 3
      };
      
      const userLevel = roleHierarchy[userRole] || 0;
      const requiredLevel = roleHierarchy[requiredRole] || 999;
      
      if (userLevel < requiredLevel) {
        this.logSuspiciousActivity(userId, action, `Insufficient permissions: ${userRole} < ${requiredRole}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Permission validation error:', error);
      return false;
    }
  }

  // Session validation
  validateSession() {
    const user = auth.currentUser;
    if (!user) return false;
    
    // Check if token is expired (Firebase handles this automatically)
    // Additional custom validation can be added here
    
    return true;
  }

  // CORS validation for API calls
  validateOrigin(allowedOrigins = []) {
    const currentOrigin = window.location.origin;
    
    if (allowedOrigins.length === 0) return true; // No restriction
    
    return allowedOrigins.includes(currentOrigin);
  }

  // Get security report
  getSecurityReport() {
    return {
      suspiciousActivities: this.suspiciousActivityLog.slice(-50), // Last 50 activities
      rateLimitStatus: Object.fromEntries(this.rateLimitMap),
      sessionValid: this.validateSession(),
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const securityAudit = new SecurityAudit();

// Security middleware for Firebase Functions (to be used in functions/index.js)
export const securityMiddleware = {
  // Validate request origin
  validateOrigin: (req, allowedOrigins = []) => {
    const origin = req.headers.origin;
    if (allowedOrigins.length === 0) return true;
    return allowedOrigins.includes(origin);
  },
  
  // Rate limiting for cloud functions
  rateLimitCloudFunction: (() => {
    const requestCounts = new Map();
    
    return (userId, maxRequests = 10, windowMs = 60000) => {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      if (!requestCounts.has(userId)) {
        requestCounts.set(userId, []);
      }
      
      const userRequests = requestCounts.get(userId);
      const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
      
      if (validRequests.length >= maxRequests) {
        return false;
      }
      
      validRequests.push(now);
      requestCounts.set(userId, validRequests);
      return true;
    };
  })()
};

export default securityAudit;
