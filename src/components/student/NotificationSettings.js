import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Bell, Settings, Save, RefreshCw } from 'lucide-react';
import { 
  getNotificationSettings, 
  updateNotificationSettings, 
  NOTIFICATION_CATEGORY_LABELS, 
  NOTIFICATION_CATEGORY_DESCRIPTIONS 
} from '../../utils/notificationSettings';
import { requestNotificationPermission, subscribeToNotifications } from '../../utils/fcmHelpers';
import Loader from '../../loading';

const NotificationSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fcmSupported, setFcmSupported] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default');

  useEffect(() => {
    loadSettings();
    checkFCMSupport();
    checkNotificationPermission();
  }, []);

  const loadSettings = async () => {
    try {
      const currentSettings = await getNotificationSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const checkFCMSupport = () => {
    setFcmSupported('serviceWorker' in navigator && 'PushManager' in window);
  };

  const checkNotificationPermission = () => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  };

  const handleCategoryToggle = (category) => {
    setSettings(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: !prev.categories[category]
      }
    }));
  };

  const handlePushNotificationToggle = async () => {
    if (!settings.pushNotifications) {
      // Enabling push notifications
      try {
        const permission = await requestNotificationPermission();
        if (permission === 'granted') {
          await subscribeToNotifications();
          setSettings(prev => ({ ...prev, pushNotifications: true }));
          setNotificationPermission('granted');
          toast.success('Push notifications enabled');
        } else {
          toast.error('Push notification permission denied');
        }
      } catch (error) {
        console.error('Error enabling push notifications:', error);
        toast.error('Failed to enable push notifications');
      }
    } else {
      // Disabling push notifications
      setSettings(prev => ({ ...prev, pushNotifications: false }));
    }
  };

  const handleEmailNotificationToggle = () => {
    setSettings(prev => ({ ...prev, emailNotifications: !prev.emailNotifications }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await updateNotificationSettings(settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSettings({
      categories: {
        job_posting: true,
        job_update: true,
        status_update: true,
        chat_message: true,
        task_added: true,
        task_reminder: true,
        gallery_update: true,
        announcement: true,
        interview: true
      },
      discussions: {},
      pushNotifications: true,
      emailNotifications: true
    });
    toast.info('Settings reset to defaults');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-200 bg-opacity-10 flex items-center justify-center z-50">
        <Loader />
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-6 py-6 pb-24 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="text-blue-600" size={28} />
          <h2 className="text-2xl font-semibold">Notification Settings</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetToDefaults}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors flex items-center gap-1"
          >
            <RefreshCw size={14} />
            Reset
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Global Settings */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell size={20} />
          Global Notification Settings
        </h3>
        
        <div className="space-y-4">
          {/* Push Notifications */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium">Push Notifications</h4>
              <p className="text-sm text-gray-600">
                Receive real-time notifications in your browser
                {!fcmSupported && ' (Not supported in this browser)'}
              </p>
              {notificationPermission === 'denied' && (
                <p className="text-sm text-red-600 mt-1">
                  Permission denied. Please enable in browser settings.
                </p>
              )}
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.pushNotifications || false}
                onChange={handlePushNotificationToggle}
                disabled={!fcmSupported || notificationPermission === 'denied'}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium">Email Notifications</h4>
              <p className="text-sm text-gray-600">
                Receive notifications via email for important updates
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.emailNotifications || false}
                onChange={handleEmailNotificationToggle}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Category Settings */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Notification Categories</h3>
        <p className="text-gray-600 mb-6">
          Choose which types of notifications you want to receive. These settings apply to both push and email notifications.
        </p>
        
        <div className="grid gap-4">
          {Object.entries(NOTIFICATION_CATEGORY_LABELS).map(([category, label]) => (
            <div key={category} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex-1">
                <h4 className="font-medium">{label}</h4>
                <p className="text-sm text-gray-600">
                  {NOTIFICATION_CATEGORY_DESCRIPTIONS[category]}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={settings?.categories[category] || false}
                  onChange={() => handleCategoryToggle(category)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2">💡 Tips</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Changes are saved automatically when you click "Save Settings"</li>
          <li>• Push notifications require browser permission</li>
          <li>• You can swipe right on notifications to delete them</li>
          <li>• Email notifications are sent to your registered email address</li>
        </ul>
      </div>
    </div>
  );
};

export default NotificationSettings;
