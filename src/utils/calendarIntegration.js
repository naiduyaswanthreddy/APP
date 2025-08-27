import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Creates a calendar event for a task
 * @param {string} taskId - The task ID
 * @param {Object} taskData - Task data including title, description, dates
 * @param {Array} targetStudentIds - Array of student IDs to add event for
 * @returns {Promise<string>} - Returns the created event ID
 */
export const createTaskCalendarEvent = async (taskId, taskData, targetStudentIds) => {
  try {
    const eventData = {
      title: `Task: ${taskData.title}`,
      description: taskData.description || '',
      type: 'task',
      taskId: taskId,
      taskType: taskData.type,
      startDate: taskData.startDate ? new Date(taskData.startDate) : new Date(),
      endDate: new Date(taskData.endDate),
      allDay: false,
      participants: targetStudentIds,
      createdAt: serverTimestamp(),
      createdBy: 'admin',
      status: 'active',
      reminders: [
        {
          type: 'notification',
          minutesBefore: 1440 // 24 hours before
        },
        {
          type: 'notification', 
          minutesBefore: 60 // 1 hour before
        }
      ],
      metadata: {
        priority: getPriorityFromTaskType(taskData.type),
        category: 'academic',
        isRecurring: false
      }
    };

    // Add to calendar events collection
    const eventRef = await addDoc(collection(db, 'calendar_events'), eventData);
    
    // Create individual calendar entries for each student
    const calendarPromises = targetStudentIds.map(studentId => 
      addDoc(collection(db, 'student_calendars'), {
        studentId: studentId,
        eventId: eventRef.id,
        taskId: taskId,
        title: eventData.title,
        description: eventData.description,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        type: 'task',
        status: 'pending',
        createdAt: serverTimestamp(),
        reminders: eventData.reminders
      })
    );

    await Promise.all(calendarPromises);
    
    console.log(`Calendar event created for task ${taskId} with ${targetStudentIds.length} participants`);
    return eventRef.id;
    
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
};

/**
 * Updates a task calendar event
 * @param {string} eventId - The calendar event ID
 * @param {Object} updates - Updates to apply
 */
export const updateTaskCalendarEvent = async (eventId, updates) => {
  try {
    const eventRef = doc(db, 'calendar_events', eventId);
    await updateDoc(eventRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Calendar event ${eventId} updated`);
  } catch (error) {
    console.error('Error updating calendar event:', error);
    throw error;
  }
};

/**
 * Deletes a task calendar event
 * @param {string} eventId - The calendar event ID
 */
export const deleteTaskCalendarEvent = async (eventId) => {
  try {
    // Delete main event
    await deleteDoc(doc(db, 'calendar_events', eventId));
    
    // Delete student calendar entries
    const studentCalendarQuery = query(
      collection(db, 'student_calendars'),
      where('eventId', '==', eventId)
    );
    
    const snapshot = await getDocs(studentCalendarQuery);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    console.log(`Calendar event ${eventId} and related entries deleted`);
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    throw error;
  }
};

/**
 * Gets priority level based on task type
 * @param {string} taskType - The task type
 * @returns {string} - Priority level
 */
const getPriorityFromTaskType = (taskType) => {
  const priorityMap = {
    'quiz': 'high',
    'assignment': 'high', 
    'survey': 'medium',
    'feedback': 'low',
    'reading': 'medium'
  };
  
  return priorityMap[taskType] || 'medium';
};

/**
 * Creates a reminder event for upcoming task deadline
 * @param {string} taskId - The task ID
 * @param {Object} taskData - Task data
 * @param {Array} targetStudentIds - Student IDs
 * @param {Date} reminderDate - When to send reminder
 */
export const createTaskReminderEvent = async (taskId, taskData, targetStudentIds, reminderDate) => {
  try {
    const reminderEventData = {
      title: `Reminder: ${taskData.title} Due Soon`,
      description: `Don't forget! Your ${taskData.type} "${taskData.title}" is due soon.`,
      type: 'reminder',
      taskId: taskId,
      startDate: reminderDate,
      endDate: reminderDate,
      allDay: false,
      participants: targetStudentIds,
      createdAt: serverTimestamp(),
      status: 'scheduled',
      metadata: {
        priority: 'high',
        category: 'reminder',
        originalTaskDeadline: new Date(taskData.endDate)
      }
    };

    const reminderRef = await addDoc(collection(db, 'calendar_events'), reminderEventData);
    
    // Create individual reminder entries
    const reminderPromises = targetStudentIds.map(studentId => 
      addDoc(collection(db, 'student_calendars'), {
        studentId: studentId,
        eventId: reminderRef.id,
        taskId: taskId,
        title: reminderEventData.title,
        description: reminderEventData.description,
        startDate: reminderEventData.startDate,
        endDate: reminderEventData.endDate,
        type: 'reminder',
        status: 'scheduled',
        createdAt: serverTimestamp()
      })
    );

    await Promise.all(reminderPromises);
    
    console.log(`Reminder event created for task ${taskId}`);
    return reminderRef.id;
    
  } catch (error) {
    console.error('Error creating reminder event:', error);
    throw error;
  }
};
