import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, onMessage, getToken, isSupported } from 'firebase/messaging';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyAJuJ8DKdnn75WgvyXnKV3PJwp4BbwMvCc",
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "trail-f142f.firebaseapp.com",
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "trail-f142f",
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "trail-f142f.firebasestorage.app",
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "472625893135",
    appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:472625893135:web:0096c358c7589df975f87a",
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-8NTM6KGK8J"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(firebaseApp);
export const messaging = await (async () => {
  try {
    if (await isSupported()) {
      return getMessaging(firebaseApp);
    }
  } catch {}
  return null;
})();

// Cloud Functions for FCM token management
export const saveFCMToken = httpsCallable(functions, 'saveFCMToken');
export const cleanupFCMToken = httpsCallable(functions, 'cleanupFCMToken');
export const sendJobNotificationToEligibleStudents = httpsCallable(functions, 'sendJobNotificationToEligibleStudents');
export const sendNotificationToAdmins = httpsCallable(functions, 'sendNotificationToAdmins');
export const sendNotificationToSpecificUsers = httpsCallable(functions, 'sendNotificationToSpecificUsers');
export const retryFailedEmails = httpsCallable(functions, 'retryFailedEmails');

export async function enablePushNotifications() {
  try {
    if (!messaging) return null;
    const vapidKey = process.env.REACT_APP_VAPID_KEY;
    const token = await getToken(messaging, { vapidKey });
    return token;
  } catch {
    return null;
  }
}

export function onForegroundMessage(handler) {
  if (!messaging) return () => {};
  return onMessage(messaging, handler);
}

// Enhanced FCM token management
export async function saveFCMTokenToDatabase(token, enabled = true) {
  try {
    const result = await saveFCMToken({ fcmToken: token, enabled });
    return result.data;
  } catch (error) {
    console.error('Error saving FCM token to database:', error);
    throw error;
  }
}

export async function updatePushNotificationSettings(enabled) {
  try {
    const result = await cleanupFCMToken({ enabled });
    return result.data;
  } catch (error) {
    console.error('Error updating push notification settings:', error);
    throw error;
  }
}

// Initialize persistence in a separate file or after auth usage
// to avoid circular dependencies