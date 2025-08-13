import React, { useState, useEffect } from 'react';
import { auth, db, sendJobNotificationToEligibleStudents, sendNotificationToAdmins, sendNotificationToSpecificUsers } from '../../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { Bell, Users, Target, Send, Filter, Building, GraduationCap } from 'lucide-react';

const PushNotificationManager = () => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [admins, setAdmins] = useState([]);
  
  // Form states
  const [notificationType, setNotificationType] = useState('job');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [jobId, setJobId] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [minCGPA, setMinCGPA] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userType, setUserType] = useState('student');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch departments and batches from students
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const deptSet = new Set();
      const batchSet = new Set();
      const studentsList = [];

      studentsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.department) deptSet.add(data.department);
        if (data.batch) batchSet.add(data.batch);
        if (data.pushNotificationsEnabled && data.fcmToken) {
          studentsList.push({
            id: doc.id,
            name: data.name || 'Unknown',
            department: data.department || 'Unknown',
            batch: data.batch || 'Unknown',
            cgpa: data.cgpa || 0
          });
        }
      });

      // Fetch admins
      const adminsSnapshot = await getDocs(collection(db, 'admins'));
      const adminsList = [];
      adminsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.pushNotificationsEnabled && data.fcmToken) {
          adminsList.push({
            id: doc.id,
            name: data.name || 'Unknown',
            email: data.email || 'Unknown'
          });
        }
      });

      setDepartments(Array.from(deptSet).sort());
      setBatches(Array.from(batchSet).sort());
      setStudents(studentsList);
      setAdmins(adminsList);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Please fill in both title and message');
      return;
    }

    try {
      setSending(true);

      let result;
      switch (notificationType) {
        case 'job':
          const criteria = {};
          if (selectedDepartment) criteria.department = selectedDepartment;
          if (selectedBatch) criteria.batch = selectedBatch;
          if (minCGPA) criteria.minCGPA = parseFloat(minCGPA);

          result = await sendJobNotificationToEligibleStudents({
            jobId,
            title,
            message,
            criteria
          });
          break;

        case 'admin':
          result = await sendNotificationToAdmins({
            title,
            message,
            type: 'admin_notification'
          });
          break;

        case 'targeted':
          if (selectedUserIds.length === 0) {
            toast.error('Please select at least one user');
            return;
          }
          result = await sendNotificationToSpecificUsers({
            userIds: selectedUserIds,
            title,
            message,
            type: 'targeted_notification',
            userType
          });
          break;

        default:
          toast.error('Invalid notification type');
          return;
      }

      if (result.success) {
        toast.success(result.message);
        // Reset form
        setTitle('');
        setMessage('');
        setJobId('');
        setSelectedDepartment('');
        setSelectedBatch('');
        setMinCGPA('');
        setSelectedUserIds([]);
      }

    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const handleUserSelection = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
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
        <Bell className="w-6 h-6 text-blue-600 mr-3" />
        <h2 className="text-xl font-semibold text-gray-900">Push Notification Manager</h2>
      </div>

      {/* Notification Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notification Type
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => setNotificationType('job')}
            className={`p-3 border rounded-lg text-center transition-colors ${
              notificationType === 'job' 
                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Target className="w-5 h-5 mx-auto mb-2" />
            <span className="text-sm font-medium">Job Notifications</span>
            <p className="text-xs text-gray-500 mt-1">Send to eligible students</p>
          </button>

          <button
            onClick={() => setNotificationType('admin')}
            className={`p-3 border rounded-lg text-center transition-colors ${
              notificationType === 'admin' 
                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Building className="w-5 h-5 mx-auto mb-2" />
            <span className="text-sm font-medium">Admin Notifications</span>
            <p className="text-xs text-gray-500 mt-1">Send to all admins</p>
          </button>

          <button
            onClick={() => setNotificationType('targeted')}
            className={`p-3 border rounded-lg text-center transition-colors ${
              notificationType === 'targeted' 
                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Users className="w-5 h-5 mx-auto mb-2" />
            <span className="text-sm font-medium">Targeted Notifications</span>
            <p className="text-xs text-gray-500 mt-1">Send to specific users</p>
          </button>
        </div>
      </div>

      {/* Notification Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter notification title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message *
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter notification message"
          />
        </div>

        {/* Job-specific fields */}
        {notificationType === 'job' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job ID (Optional)
              </label>
              <input
                type="text"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter job ID for tracking"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch
                </label>
                <select
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Batches</option>
                  {batches.map(batch => (
                    <option key={batch} value={batch}>{batch}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum CGPA
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={minCGPA}
                  onChange={(e) => setMinCGPA(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 7.5"
                />
              </div>
            </div>
          </>
        )}

        {/* Targeted notification fields */}
        {notificationType === 'targeted' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Type
              </label>
              <select
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="student">Students</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Users *
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2">
                {(userType === 'student' ? students : admins).map(user => (
                  <label key={user.id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => handleUserSelection(user.id)}
                      className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {user.name}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        {userType === 'student' ? `${user.department} - ${user.batch}` : user.email}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Selected: {selectedUserIds.length} users
              </p>
            </div>
          </>
        )}
      </div>

      {/* Send Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSendNotification}
          disabled={sending || !title.trim() || !message.trim()}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
            sending || !title.trim() || !message.trim()
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          }`}
        >
          {sending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send Notification
            </>
          )}
        </button>
      </div>

      {/* Statistics */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <GraduationCap className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-blue-900">Students with Push</p>
                <p className="text-2xl font-bold text-blue-600">{students.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Building className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-green-900">Admins with Push</p>
                <p className="text-2xl font-bold text-green-600">{admins.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Bell className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-purple-900">Total Users</p>
                <p className="text-2xl font-bold text-purple-600">{students.length + admins.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationManager;

