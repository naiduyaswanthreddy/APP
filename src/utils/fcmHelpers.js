import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { getCurrentStudentRollNumber } from './studentIdentity';

// Firebase Cloud Messaging configuration
const vapidKey = process.env.REACT_APP_VAPID_KEY;

let messaging = null;

// Initialize FCM
export const initializeFCM = () => {
  try {
    if (!vapidKey) {
      console.error('VAPID key not found. Please set REACT_APP_VAPID_KEY in your environment variables.');
      return false;
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      messaging = getMessaging();
      
      // Register service worker if not already registered
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
          .then((registration) => {
            console.log('Service Worker registered successfully:', registration);
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error);
          });
      }
      
      return true;
    }
    console.warn('Push messaging is not supported in this browser');
    return false;
  } catch (error) {
    console.error('Error initializing FCM:', error);
    return false;
  }
};

// Request notification permission
export const requestNotificationPermission = async () => {
  try {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    throw error;
  }
};

// Get FCM token and subscribe to notifications
export const subscribeToNotifications = async () => {
  try {
    if (!messaging) {
      const initialized = initializeFCM();
      if (!initialized) {
        throw new Error('FCM not supported');
      }
    }

    if (!vapidKey) {
      throw new Error('VAPID key not configured');
    }

    // Check notification permission first
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    const currentToken = await getToken(messaging, { vapidKey });
    
    if (currentToken) {
      console.log('FCM token generated:', currentToken.substring(0, 20) + '...');
      // Save token to Firestore for server-side notifications
      await saveFCMToken(currentToken);
      return currentToken;
    } else {
      console.log('No registration token available. Make sure the app is authorized to receive notifications.');
      return null;
    }
  } catch (error) {
    console.error('An error occurred while retrieving token:', error);
    if (error.code === 'messaging/permission-blocked') {
      throw new Error('Notification permission is blocked. Please enable notifications in your browser settings.');
    } else if (error.code === 'messaging/token-unsubscribe-failed') {
      throw new Error('Failed to unsubscribe from notifications. Please try again.');
    }
    throw error;
  }
};

// Save FCM token to Firestore
const saveFCMToken = async (token) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('No authenticated user found, cannot save FCM token');
      return;
    }

    const roll = await getCurrentStudentRollNumber();
    const tokenData = {
      token,
      userId: user.uid,
      rollNumber: roll || null,
      userType: 'student',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      platform: 'web',
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }
    };

    // Use user ID as document ID to ensure one token per user
    await setDoc(doc(db, 'fcm_tokens', user.uid), tokenData);
    console.log('FCM token saved successfully for user:', user.uid);
  } catch (error) {
    console.error('Error saving FCM token:', error);
    throw error;
  }
};

// Set up foreground message listener
export const setupForegroundMessageListener = (callback) => {
  if (!messaging) {
    console.warn('Messaging not initialized, cannot set up foreground listener');
    return null;
  }

  return onMessage(messaging, (payload) => {
    console.log('Message received in foreground:', payload);
    
    // Show notification if browser is in focus and permission is granted
    if (document.visibilityState === 'visible' && Notification.permission === 'granted') {
      showNotification(payload);
    }
    
    // Call callback if provided
    if (callback) {
      callback(payload);
    }
  });
};

// Show browser notification
const showNotification = (payload) => {
  try {
    const { notification, data } = payload;
    
    if (Notification.permission === 'granted') {
      const notificationOptions = {
        body: notification?.body || '',
        icon: notification?.icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: data?.notificationId || 'default',
        data: data || {},
        requireInteraction: false,
        silent: false
      };

      const notif = new Notification(
        notification?.title || 'New Notification',
        notificationOptions
      );

      // Handle notification click
      notif.onclick = (event) => {
        event.preventDefault();
        window.focus();
        
        // Navigate to action link if provided
        if (data?.actionLink) {
          window.location.href = data.actionLink;
        }
        
        notif.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => {
        notif.close();
      }, 5000);
    }
  } catch (error) {
    console.error('Error showing notification:', error);
  }
};

// Send notification to specific user (for testing)
export const sendTestNotification = async (title, body, actionLink = null) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // This would typically be called from a Cloud Function
    // For testing, we can create a local notification
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        data: { actionLink }
      });

      if (actionLink) {
        notification.onclick = () => {
          window.location.href = actionLink;
          notification.close();
        };
      }
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    throw error;
  }
};

// Check if notifications are supported and enabled
export const isNotificationSupported = () => {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
};

export const getNotificationPermissionStatus = () => {
  if ('Notification' in window) {
    return Notification.permission;
  }
  return 'unsupported';
};
