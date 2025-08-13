import React, { useState, useEffect } from 'react';
import { auth, db, saveFCMTokenToDatabase, updatePushNotificationSettings, enablePushNotifications } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { Bell, BellOff, Settings, Smartphone } from 'lucide-react';

const PushNotificationSettings = () => {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);

  useEffect(() => {
    fetchPushNotificationSettings();
  }, []);

  const fetchPushNotificationSettings = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (user) {
        const studentRef = doc(db, "students", user.uid);
        const studentSnap = await getDoc(studentRef);
        
        if (studentSnap.exists()) {
          const data = studentSnap.data();
          setPushEnabled(data.pushNotificationsEnabled || false);
          setFcmToken(data.fcmToken || null);
        }
      }
    } catch (error) {
      console.error("Error fetching push notification settings:", error);
      toast.error("Failed to load push notification settings");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePushNotifications = async () => {
    try {
      setSaving(true);
      const newState = !pushEnabled;
      
      if (newState) {
        // Enable push notifications
        const token = await enablePushNotifications();
        if (token) {
          // Save token to database
          await saveFCMTokenToDatabase(token, true);
          setFcmToken(token);
          setPushEnabled(true);
          toast.success("Push notifications enabled successfully!");
        } else {
          toast.error("Failed to get FCM token. Please check your browser permissions.");
          return;
        }
      } else {
        // Disable push notifications
        await updatePushNotificationSettings(false);
        setPushEnabled(false);
        setFcmToken(null);
        toast.success("Push notifications disabled successfully!");
      }
    } catch (error) {
      console.error("Error updating push notification settings:", error);
      toast.error("Failed to update push notification settings");
    } finally {
      setSaving(false);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          toast.success("Notification permission granted!");
          // Try to enable push notifications
          await handleTogglePushNotifications();
        } else if (permission === 'denied') {
          toast.error("Notification permission denied. Please enable it in your browser settings.");
        }
      } else {
        toast.error("This browser doesn't support notifications");
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast.error("Failed to request notification permission");
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-6">
        <Settings className="w-6 h-6 text-blue-600 mr-3" />
        <h2 className="text-xl font-semibold text-gray-900">Push Notification Settings</h2>
      </div>

      {/* Push Notifications Toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {pushEnabled ? (
                <Bell className="w-6 h-6 text-green-600" />
              ) : (
                <BellOff className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-gray-900">
                Push Notifications
              </h3>
              <p className="text-sm text-gray-500">
                {pushEnabled 
                  ? "Receive push notifications for job updates, interviews, and important announcements"
                  : "Push notifications are currently disabled"
                }
              </p>
            </div>
          </div>
          <button
            onClick={handleTogglePushNotifications}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              pushEnabled ? 'bg-blue-600' : 'bg-gray-200'
            } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                pushEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* FCM Token Status */}
      <div className="mb-6">
        <div className="flex items-center p-4 border border-gray-200 rounded-lg">
          <Smartphone className="w-6 h-6 text-blue-600 mr-3" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">Device Registration</h3>
            <p className="text-sm text-gray-500">
              {fcmToken 
                ? "Your device is registered for push notifications"
                : "Your device is not registered for push notifications"
              }
            </p>
            {fcmToken && (
              <p className="text-xs text-gray-400 mt-1 font-mono">
                Token: {fcmToken.substring(0, 20)}...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Permission Request */}
      {!pushEnabled && (
        <div className="mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <Bell className="w-5 h-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Enable Push Notifications
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    To receive push notifications, you need to:
                  </p>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Grant notification permission to this website</li>
                    <li>Enable push notifications in your settings</li>
                  </ol>
                </div>
                <div className="mt-4">
                  <button
                    onClick={requestNotificationPermission}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Grant Permission
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Information */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">About Push Notifications</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Job application status updates</li>
          <li>• Interview schedules and reminders</li>
          <li>• New job postings matching your profile</li>
          <li>• Important announcements and events</li>
          <li>• Chat messages from recruiters</li>
        </ul>
        <p className="text-xs text-gray-500 mt-3">
          You can change these settings at any time. Disabling push notifications will remove your device registration.
        </p>
      </div>
    </div>
  );
};

export default PushNotificationSettings;
