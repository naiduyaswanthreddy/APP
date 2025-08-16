import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, updateDoc, doc, onSnapshot, Timestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { db, enablePushNotifications, onForegroundMessage } from '../../firebase';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, User, Briefcase, AlertTriangle, Building } from 'lucide-react';
import Loader from '../../loading'; // Add this import at the top


const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const navigate = useNavigate();

  // Notification type mapping with icons and styles
  const notificationTypes = {
    student_event: { 
      icon: <User size={20} />, 
      label: 'Student Activity',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    job_event: { 
      icon: <Briefcase size={20} />, 
      label: 'Job Updates',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    system_alert: { 
      icon: <AlertTriangle size={20} />, 
      label: 'System Alerts',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    company_action: { 
      icon: <Building size={20} />, 
      label: 'Company Actions',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  };

  useEffect(() => {
    // Set up real-time listener for notifications
    const setupNotificationsListener = () => {
      // Base query for admin notifications
      const baseQuery = query(
        collection(db, 'notifications'),
        where('recipientType', '==', 'admin'),
        orderBy('timestamp', 'desc')
      );
  
      // Set up listener with error handling
      const unsubscribe = onSnapshot(
        baseQuery,
        (snapshot) => {
          let notificationsList = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              // Handle both isRead and read fields
              isRead: data.isRead !== undefined ? data.isRead : (data.read !== undefined ? data.read : false),
              // Map job type to expected types
              type: data.type === 'job' ? 'job_event' : data.type,
              timestamp: data.timestamp?.toDate() || new Date()
            };
          });
          
          // Apply filters in memory instead of in the query
          if (filter !== 'all') {
            notificationsList = notificationsList.filter(notification => 
              notification.type === filter
            );
          }
          
          if (timeFilter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            notificationsList = notificationsList.filter(notification => 
              notification.timestamp >= today
            );
          } else if (timeFilter === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            notificationsList = notificationsList.filter(notification => 
              notification.timestamp >= weekAgo
            );
          } else if (timeFilter === 'unread') {
            notificationsList = notificationsList.filter(notification => 
              !notification.isRead
            );
          }
          
          setNotifications(notificationsList);
          setLoading(false);
  
          // Suppress auto toast on page open/new items
        },
        (error) => {
          console.error('Error in notifications listener:', error);
          setLoading(false);
        }
      );
  
      return unsubscribe;
    };

    const unsubscribe = setupNotificationsListener();
    return () => { unsubscribe(); };
  }, [filter, timeFilter]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true,  // Update the field that's actually in the database
        isRead: true // Keep this for backward compatibility
      });
      
      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notification =>
          notification.id === notificationId
            ? { ...notification, isRead: true, read: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      const unreadNotifications = notifications.filter(n => !n.isRead);
      
      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        batch.update(notificationRef, { 
          read: true,
          isRead: true 
        });
      });
      
      await batch.commit();
      
      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notification => ({
          ...notification,
          isRead: true,
          read: true
        }))
      );
      
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read when clicked
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    
    // Navigate to action link if provided
    if (notification.actionLink) {
      navigate(notification.actionLink);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getTimeFilterLabel = (filter) => {
    const labels = {
      all: 'All Time',
      today: 'Today',
      week: 'This Week',
      unread: 'Unread'
    };
    return labels[filter] || 'All Time';
  };

  const getNotificationTypeLabel = (type) => {
    return notificationTypes[type]?.label || 'Notification';
  };

  const getNotificationStyle = (type) => {
    return `${notificationTypes[type]?.bgColor || 'bg-gray-50'} ${notificationTypes[type]?.borderColor || 'border-gray-200'}`;
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    
    // Less than a day
    if (diff < 86400000) {
      return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Less than a week
    else if (diff < 604800000) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[timestamp.getDay()];
    }
    // Otherwise show full date
    else {
      return timestamp.toLocaleDateString();
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        
        <div className="flex space-x-2">
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-md py-2 pl-3 pr-10 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="unread">Unread Only</option>
            </select>
          </div>
          
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Mark All as Read
          </button>
          {notifications.length > 0 && (
            <button
              onClick={async () => {
                try {
                  const batch = writeBatch(db);
                  // Clear all admin notifications (recipientType == 'admin')
                  const qAdmin = query(collection(db, 'notifications'), where('recipientType', '==', 'admin'));
                  const sAdmin = await getDocs(qAdmin);
                  sAdmin.forEach(d => batch.delete(doc(db, 'notifications', d.id)));
                  await batch.commit();
                  setNotifications([]);
                  toast.success('All notifications cleared');
                } catch (e) {
                  console.error('Error clearing notifications:', e);
                  toast.error('Failed to clear notifications');
                }
              }}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm"
            >
              Clear All
            </button>
          )}
        </div>
      </div>
      
      <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md text-sm ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
        >
          All
        </button>
        {Object.entries(notificationTypes).map(([type, data]) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-2 rounded-md text-sm flex items-center ${filter === type ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            <span className="mr-2">{data.icon}</span>
            {data.label}
          </button>
        ))}
      </div>
      
      {loading ? (
        <div className="fixed top-0 left-[20%] right-0 bottom-0 bg-gray-200 bg-opacity-10 flex items-center justify-center z-50">
        <Loader />
        </div>      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <Bell size={40} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No notifications</h3>
          <p className="text-gray-500">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map(notification => (
            <div 
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`p-4 border rounded-lg shadow-sm cursor-pointer transition-all hover:shadow ${getNotificationStyle(notification.type)} ${!notification.isRead ? 'border-l-4 border-l-blue-500' : ''}`}
            >
              <div className="flex items-start">
                <div className="mr-4">
                  {notificationTypes[notification.type]?.icon || <Bell size={20} />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className={`font-medium ${!notification.isRead ? 'font-bold' : ''}`}>
                      {notification.title}
                      {!notification.isRead && (
                        <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notification.id); }}
                        className="text-green-600 hover:text-green-800"
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        ✓
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(notification.id); }}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                        aria-label="Delete"
                      >
                        🗑
                      </button>
                      <span className="text-xs text-gray-500">{formatTimestamp(notification.timestamp)}</span>
                    </div>
                  </div>
                  <p className="text-gray-600 mt-1">{notification.message}</p>
                  {notification.actionLink && (
                    <a 
                      href="#"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(notification.actionLink);
                      }}
                      className="text-blue-600 hover:underline text-sm mt-2 inline-block"
                    >
                      View Details →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
