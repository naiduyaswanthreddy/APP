import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  orderBy,
  limit,
  doc,
  getDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

/**
 * Task Notification System Integration
 * Handles automated reminders and notifications for tasks and assessments
 */

// Initialize cloud function
const sendNotification = httpsCallable(functions, 'sendNotification');

/**
 * Send task reminder notifications to students
 */
export const sendTaskReminders = async (taskId, reminderType = 'deadline') => {
  try {
    // Get task details
    const taskRef = doc(db, 'tasks', taskId);
    const taskDoc = await getDoc(taskRef);
    
    if (!taskDoc.exists()) {
      throw new Error('Task not found');
    }
    
    const task = { id: taskDoc.id, ...taskDoc.data() };
    
    // Get target students
    let targetStudents = [];
    
    if (task.targetType === 'all') {
      const studentsRef = collection(db, 'students');
      const studentsSnapshot = await getDocs(studentsRef);
      targetStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else if (task.targetType === 'branch') {
      const studentsRef = collection(db, 'students');
      const q = query(studentsRef, where('branch', 'in', task.targetBranches));
      const studentsSnapshot = await getDocs(q);
      targetStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else if (task.targetType === 'selected') {
      const studentsRef = collection(db, 'students');
      const studentsSnapshot = await getDocs(studentsRef);
      targetStudents = studentsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(student => task.targetStudents.includes(student.id));
    }
    
    // Get existing submissions to filter out completed students
    const submissionsRef = collection(db, 'task_submissions');
    const submissionsQuery = query(submissionsRef, where('taskId', '==', taskId));
    const submissionsSnapshot = await getDocs(submissionsQuery);
    const completedStudentIds = submissionsSnapshot.docs
      .map(doc => doc.data().studentId)
      .filter(id => id);
    
    // Filter to only pending students
    const pendingStudents = targetStudents.filter(student => 
      !completedStudentIds.includes(student.id)
    );
    
    if (pendingStudents.length === 0) {
      return { success: true, message: 'No pending students found', sentCount: 0 };
    }
    
    // Prepare notification content
    const notificationContent = getNotificationContent(task, reminderType);
    
    let sentCount = 0;
    const errors = [];
    
    // Send notifications to each pending student
    for (const student of pendingStudents) {
      try {
        // Send push notification
        if (student.fcmToken) {
          await sendNotification({
            token: student.fcmToken,
            title: notificationContent.pushTitle,
            body: notificationContent.pushBody,
            data: {
              type: 'task_reminder',
              taskId: task.id,
              taskType: task.type,
              reminderType
            }
          });
        }
        
        // Send email notification
        if (student.email) {
          await sendNotification({
            email: student.email,
            subject: notificationContent.emailSubject,
            html: notificationContent.emailBody,
            type: 'email'
          });
        }
        
        // Log notification in database
        await addDoc(collection(db, 'notifications'), {
          type: 'task_reminder',
          taskId: task.id,
          studentId: student.id,
          title: notificationContent.pushTitle,
          message: notificationContent.pushBody,
          sentAt: serverTimestamp(),
          reminderType,
          read: false
        });
        
        sentCount++;
      } catch (error) {
        console.error(`Error sending notification to student ${student.id}:`, error);
        errors.push({ studentId: student.id, error: error.message });
      }
    }
    
    return {
      success: true,
      message: `Sent ${sentCount} notifications`,
      sentCount,
      totalPending: pendingStudents.length,
      errors
    };
    
  } catch (error) {
    console.error('Error sending task reminders:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to send reminders'
    };
  }
};

/**
 * Generate notification content based on task and reminder type
 */
const getNotificationContent = (task, reminderType) => {
  const deadline = task.endDate?.toDate?.()?.toLocaleDateString() || 'No deadline';
  const timeRemaining = getTimeRemaining(task.endDate);
  
  switch (reminderType) {
    case 'deadline':
      return {
        pushTitle: `📋 Task Reminder: ${task.title}`,
        pushBody: `Don't forget to complete your ${task.type}. ${timeRemaining}`,
        emailSubject: `Reminder: ${task.title} - Due ${deadline}`,
        emailBody: generateEmailTemplate(task, 'deadline', timeRemaining)
      };
      
    case 'urgent':
      return {
        pushTitle: `⚠️ Urgent: ${task.title}`,
        pushBody: `Task due soon! ${timeRemaining}`,
        emailSubject: `Urgent: ${task.title} - Due ${deadline}`,
        emailBody: generateEmailTemplate(task, 'urgent', timeRemaining)
      };
      
    case 'new_task':
      return {
        pushTitle: `📝 New Task: ${task.title}`,
        pushBody: `A new ${task.type} has been assigned to you. Due ${deadline}`,
        emailSubject: `New Task Assigned: ${task.title}`,
        emailBody: generateEmailTemplate(task, 'new_task', timeRemaining)
      };
      
    default:
      return {
        pushTitle: `📋 Task Update: ${task.title}`,
        pushBody: `Check your task: ${task.title}`,
        emailSubject: `Task Update: ${task.title}`,
        emailBody: generateEmailTemplate(task, 'general', timeRemaining)
      };
  }
};

/**
 * Generate HTML email template
 */
const generateEmailTemplate = (task, type, timeRemaining) => {
  const deadline = task.endDate?.toDate?.()?.toLocaleDateString() || 'No deadline';
  const taskTypeIcon = getTaskTypeIcon(task.type);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Task Notification</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .task-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .urgent { border-left-color: #ef4444; }
            .urgent .button { background: #ef4444; }
            .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${taskTypeIcon} ${getEmailTitle(type)}</h1>
            </div>
            <div class="content">
                <div class="task-info ${type === 'urgent' ? 'urgent' : ''}">
                    <h2>${task.title}</h2>
                    <p><strong>Type:</strong> ${task.type.charAt(0).toUpperCase() + task.type.slice(1)}</p>
                    <p><strong>Description:</strong> ${task.description || 'No description provided'}</p>
                    <p><strong>Deadline:</strong> ${deadline}</p>
                    <p><strong>Time Remaining:</strong> ${timeRemaining}</p>
                    ${task.settings?.maxMarks ? `<p><strong>Total Marks:</strong> ${task.settings.maxMarks}</p>` : ''}
                    ${task.settings?.timeLimit ? `<p><strong>Time Limit:</strong> ${task.settings.timeLimit} minutes</p>` : ''}
                </div>
                
                ${getEmailMessage(type)}
                
                <a href="${getTaskUrl(task.id)}" class="button">
                    ${getButtonText(type)}
                </a>
                
                <div class="footer">
                    <p>This is an automated notification from the Placement Portal.</p>
                    <p>If you have any questions, please contact your administrator.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

/**
 * Helper functions for email template
 */
const getTaskTypeIcon = (type) => {
  switch (type) {
    case 'feedback': return '📝';
    case 'survey': return '📊';
    case 'quiz': return '📋';
    case 'assignment': return '📎';
    case 'reading': return '📖';
    default: return '📄';
  }
};

const getEmailTitle = (type) => {
  switch (type) {
    case 'new_task': return 'New Task Assigned';
    case 'urgent': return 'Urgent Task Reminder';
    case 'deadline': return 'Task Deadline Reminder';
    default: return 'Task Notification';
  }
};

const getEmailMessage = (type) => {
  switch (type) {
    case 'new_task':
      return '<p>A new task has been assigned to you. Please review the details above and complete it before the deadline.</p>';
    case 'urgent':
      return '<p><strong>⚠️ This task is due soon!</strong> Please complete it as soon as possible to avoid missing the deadline.</p>';
    case 'deadline':
      return '<p>This is a friendly reminder about your pending task. Please make sure to complete it before the deadline.</p>';
    default:
      return '<p>Please check your task and complete it if you haven\'t already.</p>';
  }
};

const getButtonText = (type) => {
  switch (type) {
    case 'new_task': return 'View New Task';
    case 'urgent': return 'Complete Now';
    default: return 'View Task';
  }
};

const getTaskUrl = (taskId) => {
  // In production, this would be your actual domain
  return `${window.location.origin}/student/tasks/${taskId}/attempt`;
};

/**
 * Calculate time remaining until deadline
 */
const getTimeRemaining = (deadline) => {
  if (!deadline) return 'No deadline set';
  
  const now = new Date();
  const deadlineDate = deadline?.toDate?.() || new Date(deadline);
  const diff = deadlineDate - now;
  
  if (diff < 0) return 'Overdue';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} remaining`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
  return 'Due very soon';
};

/**
 * Schedule automatic reminders for a task
 */
export const scheduleTaskReminders = async (taskId) => {
  try {
    const taskRef = doc(db, 'tasks', taskId);
    const taskDoc = await getDoc(taskRef);
    
    if (!taskDoc.exists()) {
      throw new Error('Task not found');
    }
    
    const task = { id: taskDoc.id, ...taskDoc.data() };
    const deadline = task.endDate?.toDate?.() || new Date(task.endDate);
    const now = new Date();
    
    // Schedule reminders at different intervals
    const reminderSchedule = [
      { hours: 24, type: 'deadline' },  // 1 day before
      { hours: 2, type: 'urgent' },    // 2 hours before
    ];
    
    for (const reminder of reminderSchedule) {
      const reminderTime = new Date(deadline.getTime() - (reminder.hours * 60 * 60 * 1000));
      
      if (reminderTime > now) {
        // In a real implementation, you would use a job scheduler like Cloud Tasks
        // For now, we'll just log the scheduled reminder
        console.log(`Reminder scheduled for ${reminderTime.toISOString()}: ${reminder.type}`);
        
        // Store reminder schedule in database
        await addDoc(collection(db, 'scheduled_reminders'), {
          taskId: task.id,
          reminderType: reminder.type,
          scheduledFor: reminderTime,
          status: 'scheduled',
          createdAt: serverTimestamp()
        });
      }
    }
    
    return { success: true, message: 'Reminders scheduled successfully' };
  } catch (error) {
    console.error('Error scheduling reminders:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification when task is created
 */
export const notifyTaskCreated = async (taskId) => {
  return await sendTaskReminders(taskId, 'new_task');
};

/**
 * Send bulk reminders for all active tasks
 */
export const sendBulkReminders = async () => {
  try {
    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, where('status', '==', 'active'));
    const tasksSnapshot = await getDocs(q);
    
    const results = [];
    
    for (const taskDoc of tasksSnapshot.docs) {
      const task = { id: taskDoc.id, ...taskDoc.data() };
      const deadline = task.endDate?.toDate?.() || new Date(task.endDate);
      const now = new Date();
      const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);
      
      // Send reminders based on time remaining
      let reminderType = 'deadline';
      if (hoursUntilDeadline <= 2) {
        reminderType = 'urgent';
      } else if (hoursUntilDeadline <= 24) {
        reminderType = 'deadline';
      } else {
        continue; // Skip if more than 24 hours remaining
      }
      
      const result = await sendTaskReminders(task.id, reminderType);
      results.push({ taskId: task.id, taskTitle: task.title, ...result });
    }
    
    return {
      success: true,
      message: `Processed ${results.length} tasks`,
      results
    };
  } catch (error) {
    console.error('Error sending bulk reminders:', error);
    return { success: false, error: error.message };
  }
};
