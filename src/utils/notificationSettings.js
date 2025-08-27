import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { getCurrentStudentRollNumber } from './studentIdentity';

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS = {
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
  discussions: {}, // Per-discussion overrides: { [discussionId]: { notificationsEnabled: boolean } }
  pushNotifications: true,
  emailNotifications: true,
  updatedAt: null
};

// Get notification settings for current user
export const getNotificationSettings = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return DEFAULT_NOTIFICATION_SETTINGS;

    const roll = await getCurrentStudentRollNumber();
    const settingsId = roll || user.uid;
    
    const settingsDoc = await getDoc(doc(db, 'notification_settings', settingsId));
    
    if (settingsDoc.exists()) {
      const settings = settingsDoc.data();
      // Merge with defaults to ensure all categories are present
      return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...settings,
        categories: {
          ...DEFAULT_NOTIFICATION_SETTINGS.categories,
          ...settings.categories
        }
      };
    }
    
    return DEFAULT_NOTIFICATION_SETTINGS;
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

// Update notification settings for current user
export const updateNotificationSettings = async (newSettings) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const roll = await getCurrentStudentRollNumber();
    const settingsId = roll || user.uid;
    
    const settingsData = {
      ...newSettings,
      userId: user.uid,
      rollNumber: roll || null,
      updatedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'notification_settings', settingsId), settingsData, { merge: true });
    return settingsData;
  } catch (error) {
    console.error('Error updating notification settings:', error);
    throw error;
  }
};

// Check if a specific notification category is enabled
export const isCategoryEnabled = async (category) => {
  try {
    const settings = await getNotificationSettings();
    return settings.categories[category] !== false;
  } catch (error) {
    console.error('Error checking category enabled:', error);
    return true; // Default to enabled if error
  }
};

// Check if notifications are enabled for a specific discussion
export const isDiscussionNotificationEnabled = async (discussionId) => {
  try {
    const settings = await getNotificationSettings();
    const discussionSettings = settings.discussions[discussionId];
    
    if (discussionSettings !== undefined) {
      return discussionSettings.notificationsEnabled;
    }
    
    // Default to enabled if no specific setting
    return settings.categories.chat_message !== false;
  } catch (error) {
    console.error('Error checking discussion notification enabled:', error);
    return true; // Default to enabled if error
  }
};

// Update discussion notification setting
export const updateDiscussionNotificationSetting = async (discussionId, enabled) => {
  try {
    const currentSettings = await getNotificationSettings();
    const updatedSettings = {
      ...currentSettings,
      discussions: {
        ...currentSettings.discussions,
        [discussionId]: { notificationsEnabled: enabled }
      }
    };
    
    await updateNotificationSettings(updatedSettings);
    return updatedSettings;
  } catch (error) {
    console.error('Error updating discussion notification setting:', error);
    throw error;
  }
};

// Get notification category display names
export const NOTIFICATION_CATEGORY_LABELS = {
  job_posting: 'New Job Postings',
  job_update: 'Job Updates',
  status_update: 'Application Status Updates',
  chat_message: 'Chat Messages',
  task_added: 'New Tasks',
  task_reminder: 'Task Reminders',
  gallery_update: 'Gallery Updates',
  announcement: 'Announcements',
  interview: 'Interview Notifications'
};

// Get notification category descriptions
export const NOTIFICATION_CATEGORY_DESCRIPTIONS = {
  job_posting: 'Notifications when new jobs matching your skills are posted',
  job_update: 'Notifications when job details are updated (deadline, requirements, etc.)',
  status_update: 'Notifications when your application status changes',
  chat_message: 'Notifications for new messages in job discussions',
  task_added: 'Notifications when new tasks or assessments are assigned',
  task_reminder: 'Reminder notifications for upcoming deadlines',
  gallery_update: 'Notifications when new items are added to the gallery',
  announcement: 'General announcements from the placement team',
  interview: 'Interview scheduling and reminder notifications'
};
