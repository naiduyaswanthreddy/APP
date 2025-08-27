import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Bell, Send, Smartphone, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { 
  requestNotificationPermission, 
  subscribeToNotifications, 
  sendTestNotification,
  isNotificationSupported,
  getNotificationPermissionStatus
} from '../../utils/fcmHelpers';
import { 
  notifyJobPosted,
  notifyApplicationStatusUpdate,
  notifyInterviewScheduled,
  notifyGeneralAnnouncement,
  notifyStudentSelection
} from '../../utils/adminNotificationHelpers';
import { auth } from '../../firebase';

const NotificationTester = () => {
  const [permissionStatus, setPermissionStatus] = useState('default');
  const [fcmSupported, setFcmSupported] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState([]);

  useEffect(() => {
    checkNotificationSupport();
    checkPermissionStatus();
  }, []);

  const checkNotificationSupport = () => {
    setFcmSupported(isNotificationSupported());
  };

  const checkPermissionStatus = () => {
    setPermissionStatus(getNotificationPermissionStatus());
  };

  const addTestResult = (test, success, message) => {
    setTestResults(prev => [...prev, {
      id: Date.now(),
      test,
      success,
      message,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const handleRequestPermission = async () => {
    try {
      setTesting(true);
      const permission = await requestNotificationPermission();
      setPermissionStatus(permission);
      
      if (permission === 'granted') {
        addTestResult('Permission Request', true, 'Notification permission granted successfully');
        toast.success('Notification permission granted!');
      } else {
        addTestResult('Permission Request', false, `Permission ${permission}. Please enable in browser settings.`);
        toast.error(`Permission ${permission}`);
      }
    } catch (error) {
      addTestResult('Permission Request', false, error.message);
      toast.error('Failed to request permission');
    } finally {
      setTesting(false);
    }
  };

  const handleSubscribeToNotifications = async () => {
    try {
      setTesting(true);
      const token = await subscribeToNotifications();
      
      if (token) {
        addTestResult('FCM Subscription', true, `Token generated: ${token.substring(0, 20)}...`);
        toast.success('Successfully subscribed to push notifications!');
      } else {
        addTestResult('FCM Subscription', false, 'No token received');
        toast.error('Failed to get FCM token');
      }
    } catch (error) {
      addTestResult('FCM Subscription', false, error.message);
      toast.error('Subscription failed: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  const handleTestLocalNotification = async () => {
    try {
      setTesting(true);
      await sendTestNotification(
        '🧪 Test Notification',
        'This is a local test notification to verify your browser can display notifications.',
        '/student/notifications'
      );
      addTestResult('Local Notification', true, 'Local notification sent successfully');
      toast.success('Local test notification sent!');
    } catch (error) {
      addTestResult('Local Notification', false, error.message);
      toast.error('Local notification failed');
    } finally {
      setTesting(false);
    }
  };

  const handleTestJobNotification = async () => {
    try {
      setTesting(true);
      const mockJobData = {
        id: 'test-job-' + Date.now(),
        position: 'Software Engineer',
        company: 'Test Company',
        salary: '₹8-12 LPA',
        skills: ['JavaScript', 'React'],
        minCGPA: 7.0,
        eligibleBatch: ['2024', '2025'],
        genderPreference: 'any',
        maxCurrentArrears: 0,
        maxHistoryArrears: 0
      };

      const count = await notifyJobPosted(mockJobData);
      addTestResult('Job Posting Notification', true, `Sent to ${count} eligible students`);
      toast.success(`Job notification sent to ${count} students!`);
    } catch (error) {
      addTestResult('Job Posting Notification', false, error.message);
      toast.error('Job notification failed');
    } finally {
      setTesting(false);
    }
  };

  const handleTestStatusUpdate = async () => {
    try {
      setTesting(true);
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      await notifyApplicationStatusUpdate({
        job: { position: 'Test Position', company: 'Test Company' },
        status: 'shortlisted'
      }, user.uid);

      addTestResult('Status Update Notification', true, 'Status update notification sent');
      toast.success('Status update notification sent!');
    } catch (error) {
      addTestResult('Status Update Notification', false, error.message);
      toast.error('Status update notification failed');
    } finally {
      setTesting(false);
    }
  };

  const handleTestAnnouncement = async () => {
    try {
      setTesting(true);
      await notifyGeneralAnnouncement(
        '📢 Test Announcement',
        'This is a test announcement to verify push notifications are working correctly on your device.',
        '/student/notifications'
      );
      addTestResult('General Announcement', true, 'Announcement notification sent');
      toast.success('Announcement sent!');
    } catch (error) {
      addTestResult('General Announcement', false, error.message);
      toast.error('Announcement failed');
    } finally {
      setTesting(false);
    }
  };

  const getPermissionStatusColor = () => {
    switch (permissionStatus) {
      case 'granted': return 'text-green-600 bg-green-50';
      case 'denied': return 'text-red-600 bg-red-50';
      default: return 'text-yellow-600 bg-yellow-50';
    }
  };

  const getPermissionStatusIcon = () => {
    switch (permissionStatus) {
      case 'granted': return <CheckCircle size={20} />;
      case 'denied': return <AlertCircle size={20} />;
      default: return <Info size={20} />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="text-blue-600" size={28} />
            <h2 className="text-2xl font-semibold">Push Notification Tester</h2>
          </div>
          <p className="text-gray-600">
            Test push notifications on your mobile device to ensure they're working correctly.
          </p>
        </div>

        {/* Status Section */}
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold mb-4">Current Status</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg border">
              <Smartphone className="text-blue-600" size={24} />
              <div>
                <div className="font-medium">Browser Support</div>
                <div className={`text-sm ${fcmSupported ? 'text-green-600' : 'text-red-600'}`}>
                  {fcmSupported ? 'Supported' : 'Not Supported'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 rounded-lg border">
              <div className={`p-2 rounded-full ${getPermissionStatusColor()}`}>
                {getPermissionStatusIcon()}
              </div>
              <div>
                <div className="font-medium">Permission Status</div>
                <div className={`text-sm capitalize ${getPermissionStatusColor().split(' ')[0]}`}>
                  {permissionStatus}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Test Actions */}
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold mb-4">Test Actions</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={handleRequestPermission}
              disabled={testing || permissionStatus === 'granted'}
              className="p-4 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="font-medium text-blue-600 mb-1">1. Request Permission</div>
              <div className="text-sm text-gray-600">Ask for notification permission</div>
            </button>

            <button
              onClick={handleSubscribeToNotifications}
              disabled={testing || permissionStatus !== 'granted'}
              className="p-4 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="font-medium text-green-600 mb-1">2. Subscribe to FCM</div>
              <div className="text-sm text-gray-600">Generate FCM token</div>
            </button>

            <button
              onClick={handleTestLocalNotification}
              disabled={testing || permissionStatus !== 'granted'}
              className="p-4 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="font-medium text-purple-600 mb-1">3. Test Local</div>
              <div className="text-sm text-gray-600">Send local notification</div>
            </button>

            <button
              onClick={handleTestJobNotification}
              disabled={testing}
              className="p-4 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="font-medium text-orange-600 mb-1">Test Job Posting</div>
              <div className="text-sm text-gray-600">Send job notification</div>
            </button>

            <button
              onClick={handleTestStatusUpdate}
              disabled={testing}
              className="p-4 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="font-medium text-indigo-600 mb-1">Test Status Update</div>
              <div className="text-sm text-gray-600">Send status notification</div>
            </button>

            <button
              onClick={handleTestAnnouncement}
              disabled={testing}
              className="p-4 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="font-medium text-pink-600 mb-1">Test Announcement</div>
              <div className="text-sm text-gray-600">Send announcement</div>
            </button>
          </div>
        </div>

        {/* Test Results */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Test Results</h3>
            {testResults.length > 0 && (
              <button
                onClick={clearResults}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Results
              </button>
            )}
          </div>
          
          {testResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Send size={48} className="mx-auto mb-3 opacity-50" />
              <p>No tests run yet. Click a test button above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {testResults.map((result) => (
                <div
                  key={result.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    result.success 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <AlertCircle size={16} className="text-red-600" />
                      )}
                      <span className="font-medium">{result.test}</span>
                    </div>
                    <span className="text-sm text-gray-500">{result.timestamp}</span>
                  </div>
                  <p className={`text-sm mt-1 ${
                    result.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {result.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="p-6 bg-blue-50 border-t">
          <h4 className="font-medium text-blue-800 mb-2">📱 Mobile Testing Instructions</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Open this page on your mobile device</li>
            <li>• Follow the test steps in order (1, 2, 3)</li>
            <li>• Check if notifications appear on your device</li>
            <li>• Test both foreground and background notifications</li>
            <li>• Verify notification clicks navigate correctly</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NotificationTester;
