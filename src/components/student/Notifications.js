import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy, where, updateDoc, doc, onSnapshot, writeBatch, serverTimestamp, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { getCurrentStudentRollNumber } from '../../utils/studentIdentity';
import { getNotificationSettings } from '../../utils/notificationSettings';
import { toast } from 'react-toastify';
import { Bell, Briefcase, CheckCircle, AlertCircle, Calendar, FileText, MessageSquare, Settings, Trash2, Undo2 } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import Loader from '../../loading';


// Notification icon component based on notification type
const NotificationIcon = ({ type }) => {
  const iconMap = {
    job_posting: <Briefcase size={20} />,
    job_update: <Briefcase size={20} />,
    status_update: <CheckCircle size={20} />,
    chat_message: <MessageSquare size={20} />,
    task_added: <FileText size={20} />,
    task_reminder: <AlertCircle size={20} />,
    gallery_update: <FileText size={20} />,
    announcement: <MessageSquare size={20} />,
    interview: <Calendar size={20} />,
    reminder: <AlertCircle size={20} />
  };

  const iconClasses = {
    job_posting: "bg-blue-100 text-blue-600",
    job_update: "bg-blue-100 text-blue-500",
    status_update: "bg-green-100 text-green-600",
    chat_message: "bg-indigo-100 text-indigo-600",
    task_added: "bg-purple-100 text-purple-600",
    task_reminder: "bg-orange-100 text-orange-600",
    gallery_update: "bg-pink-100 text-pink-600",
    announcement: "bg-yellow-100 text-yellow-600",
    interview: "bg-red-100 text-red-600",
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
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [lastClearedAt, setLastClearedAt] = useState(null);
  const [pendingDeletes, setPendingDeletes] = useState(new Map());
  // Keep a ref in sync to access latest state inside toast onClose
  const pendingDeletesRef = useRef(new Map());
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  useEffect(() => {
    pendingDeletesRef.current = pendingDeletes;
  }, [pendingDeletes]);

  // Load notification settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getNotificationSettings();
        setNotificationSettings(settings);
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    };
    loadSettings();
  }, []);

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

    const handleNotificationsUpdate = async (snapshot, source) => {
      // In the handleNotificationsUpdate function
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const newNotifications = await Promise.all(snapshot.docs.map(async (snapDoc) => {
        const data = snapDoc.data();
        let isRead = data.isRead !== undefined ? data.isRead : (data.read !== undefined ? !data.read : false);

        // For general notifications, check user-specific read and hidden status
        if (data.isGeneral) {
          try {
            const [readStatusDoc, hiddenStatusDoc] = await Promise.all([
              getDoc(doc(db, 'notification_read_status', `${snapDoc.id}_${userId}`)),
              getDoc(doc(db, 'notification_hidden_status', `${snapDoc.id}_${userId}`))
            ]);
            if (readStatusDoc.exists()) {
              isRead = readStatusDoc.data().isRead;
            }
            if (hiddenStatusDoc.exists() && hiddenStatusDoc.data()?.hidden) {
              // Return null to indicate this notification should be hidden for this user
              return null;
            }
            // If lastClearedAt is set, hide any general notifications older than this timestamp
            if (lastClearedAt && (data.timestamp?.toDate?.() || new Date(0)) <= lastClearedAt) {
              return null;
            }
          } catch (error) {
            console.error('Error checking read/hidden status:', error);
          }
        }

        return {
          id: snapDoc.id,
          ...data,
          isRead: isRead,
          // Map job type to expected types
          type: data.type === 'job' ? 'job_posting' : data.type,
          timestamp: data.timestamp?.toDate() || new Date()
        };
      }));

      // Merge notifications from both sources and sort by timestamp
      const cleanedNotifications = newNotifications.filter(Boolean);
      if (source === 'user') {
        setNotifications(prevNotifications => {
          const generalNotifications = prevNotifications.filter(n => n.isGeneral);
          return [...cleanedNotifications, ...generalNotifications].sort((a, b) => b.timestamp - a.timestamp);
        });
      } else {
        setNotifications(prevNotifications => {
          const userNotifications = prevNotifications.filter(n => !n.isGeneral);
          return [...userNotifications, ...cleanedNotifications].sort((a, b) => b.timestamp - a.timestamp);
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
    { label: 'Job Updates', value: 'job_update' },
    { label: 'Status Updates', value: 'status_update' },
    { label: 'Chat Messages', value: 'chat_message' },
    { label: 'Tasks', value: 'task_added' },
    { label: 'Reminders', value: 'task_reminder' },
    { label: 'Gallery', value: 'gallery_update' },
    { label: 'Announcements', value: 'announcement' },
    { label: 'Interviews', value: 'interview' }
  ];

  // Filter notifications based on selected filter and settings
  const filteredNotifications = (() => {
    let filtered = notifications;
    
    // Apply category filter
    if (filter !== 'all') {
      filtered = filtered.filter(n => n.type === filter);
    }
    
    // Apply settings filter (hide disabled categories)
    if (notificationSettings) {
      filtered = filtered.filter(n => {
        const categoryEnabled = notificationSettings.categories[n.type];
        return categoryEnabled !== false;
      });
    }
    
    // Hide pending deletes
    filtered = filtered.filter(n => !pendingDeletes.has(n.id));
    
    return filtered;
  })();

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

  // Handle swipe gestures
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (notificationId) => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isRightSwipe) {
      // Swipe right to delete
      handleSwipeDelete(notificationId);
    }
  };

  // Handle swipe-to-delete with undo
  const handleSwipeDelete = (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;

    // Add to pending deletes
    setPendingDeletes(prev => new Map(prev.set(notificationId, notification)));
    
    // Show undo toast
    const toastId = toast(
      <div className="flex items-center justify-between">
        <span>Notification deleted</span>
        <button
          onClick={() => handleUndoDelete(notificationId, toastId)}
          className="ml-2 px-2 py-1 bg-blue-500 text-white rounded text-sm"
        >
          Undo
        </button>
      </div>,
      {
        autoClose: 3000,
        closeOnClick: false,
        // Only confirm delete if it's still pending (not undone)
        onClose: () => {
          if (pendingDeletesRef.current.has(notificationId)) {
            confirmDelete(notificationId);
          }
        }
      }
    );
  };

  // Undo delete
  const handleUndoDelete = (notificationId, toastId) => {
    // Remove from pending deletes
    setPendingDeletes(prev => {
      const newMap = new Map(prev);
      newMap.delete(notificationId);
      return newMap;
    });
    
    // Dismiss the toast immediately to prevent onClose auto-delete later
    if (toastId) {
      toast.dismiss(toastId);
    }

    toast.success('Notification restored');
  };

  // Confirm permanent deletion
  const confirmDelete = async (notificationId) => {
    try {
      const notification = pendingDeletes.get(notificationId);
      if (!notification) return;

      if (notification.isGeneral) {
        // For general notifications, create a hidden marker
        const userId = auth.currentUser?.uid;
        if (userId) {
          await setDoc(doc(db, 'notification_hidden_status', `${notificationId}_${userId}`), {
            notificationId,
            userId,
            hidden: true,
            hiddenAt: serverTimestamp()
          });
        }
      } else {
        // For user-specific notifications, delete the document
        await deleteDoc(doc(db, 'notifications', notificationId));
      }
      
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setPendingDeletes(prev => {
        const newMap = new Map(prev);
        newMap.delete(notificationId);
        return newMap;
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const deleteNotification = async (notificationId) => {
    handleSwipeDelete(notificationId);
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
          <button
            onClick={() => window.location.href = '/student/notification-settings'}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors flex items-center gap-1"
          >
            <Settings size={14} />
            Settings
          </button>
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
                  // Clean up any existing per-user markers (optional housekeeping)
                  const readMarkersQ = query(collection(db, 'notification_read_status'), where('userId', '==', userId));
                  const hiddenMarkersQ = query(collection(db, 'notification_hidden_status'), where('userId', '==', userId));
                  const [readMarkersS, hiddenMarkersS] = await Promise.all([
                    getDocs(readMarkersQ),
                    getDocs(hiddenMarkersQ)
                  ]);
                  readMarkersS.forEach(d => batch.delete(doc(db, 'notification_read_status', d.id)));
                  hiddenMarkersS.forEach(d => batch.delete(doc(db, 'notification_hidden_status', d.id)));
                  // Update per-user state to mark the time of clearing
                  const userStateRef = doc(db, 'notification_user_state', userId);
                  batch.set(userStateRef, { lastClearedAt: serverTimestamp() }, { merge: true });
                  await batch.commit();
                  // Update local UI
                  setNotifications([]);
                  setLastClearedAt(new Date());
                  toast.success('All notifications cleared');
                } catch (e) {
                  console.error('Error clearing notifications:', e);
                  toast.error('Failed to clear all notifications');
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
              className={`p-4 rounded-lg shadow border ${getNotificationStyle(notification.type, notification.isRead)} touch-pan-y select-none`}
              onClick={() => !notification.isRead && markAsRead(notification.id)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => handleTouchEnd(notification.id)}
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
                        className="text-green-600 hover:text-green-800 p-1"
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
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
                  <div className="mt-2 text-xs text-gray-400">
                    💡 Swipe right to delete
                  </div>
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