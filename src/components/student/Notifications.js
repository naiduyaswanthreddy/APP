import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, updateDoc, doc, onSnapshot, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { getCurrentStudentRollNumber } from '../../utils/studentIdentity';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Bell, Briefcase, CheckCircle, AlertCircle, Calendar, FileText, MessageSquare } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import Loader from '../../loading'; // Add this import at the top


// Notification icon component based on notification type
const NotificationIcon = ({ type }) => {
  const iconMap = {
    job_posting: <Briefcase size={20} />,
    status_update: <CheckCircle size={20} />,
    announcement: <MessageSquare size={20} />,
    interview: <Calendar size={20} />,
    reminder: <AlertCircle size={20} />
  };

  const iconClasses = {
    job_posting: "bg-blue-100 text-blue-600",
    status_update: "bg-green-100 text-green-600",
    announcement: "bg-yellow-100 text-yellow-600",
    interview: "bg-purple-100 text-purple-600",
    reminder: "bg-orange-100 text-orange-600"
  };

  return (
    <div className={`p-2 rounded-full ${iconClasses[type] || 'bg-gray-100 text-gray-600'}`}>
      {iconMap[type] || <Bell size={20} />}
    </div>
  );
};

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    // Set up real-time listener for notifications
    const setupNotificationsListener = () => {
      // Query for user-specific notifications (by rollNumber primary, uid fallback)
      const setupUserQuery = async () => {
        const roll = await getCurrentStudentRollNumber();
        if (roll) {
          return query(
            collection(db, 'notifications'),
            where('recipientRoll', '==', roll),
            orderBy('timestamp', 'desc')
          );
        }
        console.warn('Notifications: rollNumber missing, listening by uid');
        return query(
          collection(db, 'notifications'),
          where('recipientId', '==', userId),
          orderBy('timestamp', 'desc')
        );
      };

      // Query for general student notifications
      const generalNotificationsQuery = query(
        collection(db, 'notifications'),
        where('isGeneral', '==', true),
        where('recipientType', '==', 'student'),
        orderBy('timestamp', 'desc')
      );

      // Set up listeners
      let userUnsubscribe = () => {};
      (async () => {
        const qUser = await setupUserQuery();
        userUnsubscribe = onSnapshot(qUser, (snapshot) => {
          handleNotificationsUpdate(snapshot, 'user');
        });
      })();

      const generalUnsubscribe = onSnapshot(generalNotificationsQuery, (snapshot) => {
        handleNotificationsUpdate(snapshot, 'general');
      });

      return () => {
        userUnsubscribe();
        generalUnsubscribe();
      };
    };

    const handleNotificationsUpdate = (snapshot, source) => {
      // In the handleNotificationsUpdate function
      const newNotifications = snapshot.docs.map(doc => {
        const data = doc.data();
        // Suppress auto toasts on page
        
        return {
          id: doc.id,
          ...data,
          // Handle both isRead and read fields
          isRead: data.isRead !== undefined ? data.isRead : (data.read !== undefined ? !data.read : false),
          // Map job type to expected types
          type: data.type === 'job' ? 'job_posting' : data.type,
          timestamp: data.timestamp?.toDate() || new Date()
        };
      });

      // Merge notifications from both sources and sort by timestamp
      if (source === 'user') {
        setNotifications(prevNotifications => {
          const generalNotifications = prevNotifications.filter(n => n.isGeneral);
          return [...newNotifications, ...generalNotifications].sort((a, b) => b.timestamp - a.timestamp);
        });
      } else {
        setNotifications(prevNotifications => {
          const userNotifications = prevNotifications.filter(n => !n.isGeneral);
          return [...userNotifications, ...newNotifications].sort((a, b) => b.timestamp - a.timestamp);
        });
      }
      
      setLoading(false);
    };

    const unsubscribe = setupNotificationsListener();
    return unsubscribe;
  }, []);

  // Update unread count whenever notifications change
  useEffect(() => {
    const count = notifications.filter(notification => !notification.isRead).length;
    setUnreadCount(count);
    
    // Update the count in localStorage for the navbar bell icon
    localStorage.setItem('unreadNotificationsCount', count.toString());
    
    // Dispatch an event so other components can react to the change
    window.dispatchEvent(new CustomEvent('unreadNotificationsUpdated', { detail: { count } }));
  }, [notifications]);

  const getNotificationStyle = (type, isRead) => {
    const baseStyle = isRead ? 'opacity-75 ' : '';
    const styles = {
      job_posting: baseStyle + 'border-blue-200 bg-blue-50',
      status_update: baseStyle + 'border-green-200 bg-green-50',
      announcement: baseStyle + 'border-yellow-200 bg-yellow-50',
      interview: baseStyle + 'border-purple-200 bg-purple-50',
      reminder: baseStyle + 'border-orange-200 bg-orange-50'
    };
    return styles[type] || baseStyle + 'border-gray-200 bg-gray-50';
  };

  const filterButtons = [
    { label: 'All', value: 'all' },
    { label: 'Job Postings', value: 'job_posting' },
    { label: 'Status Updates', value: 'status_update' },
    { label: 'Announcements', value: 'announcement' },
    { label: 'Interviews', value: 'interview' },
    { label: 'Reminders', value: 'reminder' }
  ];

  // Filter notifications based on selected filter
  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === filter);

  // Sort notifications to show unread first
  const sortedNotifications = [...filteredNotifications].sort((a, b) => {
    // First sort by read status (unread first)
    if (a.isRead !== b.isRead) {
      return a.isRead ? 1 : -1;
    }
    // Then sort by timestamp (newest first)
    return b.timestamp - a.timestamp;
  });

  const markAsRead = async (notificationId) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { isRead: true, read: true });
      
      // Update local state
      setNotifications(notifications.map(notification => 
        notification.id === notificationId 
          ? { ...notification, isRead: true } 
          : notification
      ));
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
        batch.update(notificationRef, { isRead: true, read: true });
      });
      
      await batch.commit();
      
      // Update local state
      setNotifications(notifications.map(notification => ({ ...notification, isRead: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-200 bg-opacity-10 flex items-center justify-center z-50">
        <Loader />
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-6 py-6 pb-24 relative">
      <ToastContainer />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm hover:bg-blue-600 transition-colors"
            >
              Mark all as read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={async () => {
                try {
                  const batch = writeBatch(db);
                  const userId = auth.currentUser?.uid;
                  if (!userId) return;
                  // Delete user-specific notifications
                  const roll = await getCurrentStudentRollNumber();
                  if (roll) {
                    const qRoll = query(collection(db, 'notifications'), where('recipientRoll', '==', roll));
                    const sRoll = await getDocs(qRoll);
                    sRoll.forEach(d => batch.delete(doc(db, 'notifications', d.id)));
                  } else {
                    const qUid = query(collection(db, 'notifications'), where('recipientId', '==', userId));
                    const sUid = await getDocs(qUid);
                    sUid.forEach(d => batch.delete(doc(db, 'notifications', d.id)));
                  }
                  // Mark general student notifications as read (don't delete global messages)
                  const qGen = query(collection(db, 'notifications'), where('isGeneral', '==', true), where('recipientType', '==', 'student'));
                  const sGen = await getDocs(qGen);
                  sGen.forEach(d => batch.update(doc(db, 'notifications', d.id), { isRead: true, read: true }));
                  await batch.commit();
                  // Update local UI
                  setNotifications([]);
                } catch (e) {
                  console.error('Error clearing notifications:', e);
                }
              }}
              className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-sm hover:bg-gray-300 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {filterButtons.map(button => (
          <button
            key={button.value}
            onClick={() => setFilter(button.value)}
            className={`px-3 py-1 rounded-full text-sm ${
              filter === button.value
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {button.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {sortedNotifications.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No notifications found</p>
        ) : (
          sortedNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg shadow border ${getNotificationStyle(notification.type, notification.isRead)}`}
              onClick={() => !notification.isRead && markAsRead(notification.id)}
            >
              <div className="flex items-start gap-4">
                <NotificationIcon type={notification.type} />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className={`font-medium ${!notification.isRead ? 'font-bold' : ''}`}>
                      {notification.title}
                      {!notification.isRead && (
                        <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                        className="text-green-600 hover:text-green-800"
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        ✓
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                        aria-label="Delete"
                      >
                        🗑
                      </button>
                      <p className="text-sm text-gray-400">
                        {notification.timestamp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-600 mt-1">{notification.message}</p>
                  {notification.actionLink && (
                    <a 
                      href={notification.actionLink}
                      className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                    >
                      View Details →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;