import { messaging, saveFCMTokenToDatabase, updatePushNotificationSettings } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';

class FCMTokenManager {
  constructor() {
    this.currentToken = null;
    this.isInitialized = false;
    this.onTokenRefreshCallback = null;
    this.onMessageCallback = null;
  }

  /**
   * Initialize FCM token management
   * @param {Function} onTokenRefresh - Callback when token is refreshed
   * @param {Function} onMessage - Callback when foreground message is received
   */
  async initialize(onTokenRefresh = null, onMessage = null) {
    if (this.isInitialized) return;

    try {
      this.onTokenRefreshCallback = onTokenRefresh;
      this.onMessageCallback = onMessage;

      // Check if messaging is supported
      if (!messaging) {
        console.warn('Firebase messaging is not supported in this environment');
        return false;
      }

      // Set up message listener for foreground messages
      if (onMessage) {
        this.setupMessageListener();
      }

      // Get initial token
      await this.refreshToken();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize FCM token manager:', error);
      return false;
    }
  }

  /**
   * Refresh FCM token
   * @param {boolean} saveToDatabase - Whether to save token to database
   * @returns {string|null} The new token or null if failed
   */
  async refreshToken(saveToDatabase = true) {
    try {
      if (!messaging) return null;

      const vapidKey = process.env.REACT_APP_VAPID_KEY;
      const token = await getToken(messaging, { vapidKey });

      if (token) {
        this.currentToken = token;
        
        if (saveToDatabase) {
          await this.saveTokenToDatabase(token);
        }

        // Call callback if provided
        if (this.onTokenRefreshCallback) {
          this.onTokenRefreshCallback(token);
        }

        return token;
      } else {
        console.warn('No registration token available');
        return null;
      }
    } catch (error) {
      console.error('Error refreshing FCM token:', error);
      return null;
    }
  }

  /**
   * Save FCM token to database
   * @param {string} token - The FCM token to save
   * @param {boolean} enabled - Whether push notifications are enabled
   */
  async saveTokenToDatabase(token, enabled = true) {
    try {
      await saveFCMTokenToDatabase(token, enabled);
      console.log('FCM token saved to database successfully');
    } catch (error) {
      console.error('Failed to save FCM token to database:', error);
      throw error;
    }
  }

  /**
   * Update push notification settings
   * @param {boolean} enabled - Whether to enable/disable push notifications
   */
  async updatePushNotificationSettings(enabled) {
    try {
      await updatePushNotificationSettings(enabled);
      
      if (!enabled) {
        this.currentToken = null;
      }
      
      console.log(`Push notifications ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to update push notification settings:', error);
      throw error;
    }
  }

  /**
   * Setup message listener for foreground messages
   */
  setupMessageListener() {
    if (!messaging || !this.onMessageCallback) return;

    onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      this.onMessageCallback(payload);
    });
  }

  /**
   * Get current FCM token
   * @returns {string|null} Current token or null if not available
   */
  getCurrentToken() {
    return this.currentToken;
  }

  /**
   * Check if FCM is supported and initialized
   * @returns {boolean} True if FCM is supported and initialized
   */
  isSupported() {
    return messaging !== null && this.isInitialized;
  }

  /**
   * Request notification permission
   * @returns {Promise<string>} Permission status
   */
  async requestPermission() {
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission;
      } else {
        throw new Error('Notifications not supported');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      throw error;
    }
  }

  /**
   * Check notification permission status
   * @returns {string} Permission status
   */
  getPermissionStatus() {
    if ('Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.currentToken = null;
    this.isInitialized = false;
    this.onTokenRefreshCallback = null;
    this.onMessageCallback = null;
  }
}

// Create singleton instance
const fcmTokenManager = new FCMTokenManager();

export default fcmTokenManager;

// Export individual methods for convenience
export const {
  initialize,
  refreshToken,
  saveTokenToDatabase,
  updatePushNotificationSettings,
  getCurrentToken,
  isSupported,
  requestPermission,
  getPermissionStatus,
  cleanup
} = fcmTokenManager;

