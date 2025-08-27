import { 
  createNotification,
  createJobPostingNotification,
  createStatusUpdateNotification,
  createInterviewNotification,
  createAnnouncementNotification
} from './notificationHelpers';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Helper to get all eligible students for a job
const getEligibleStudents = async (jobData) => {
  try {
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    const eligibleStudents = [];

    for (const studentDoc of studentsSnapshot.docs) {
      const studentData = studentDoc.data();
      const studentId = studentDoc.id;
      
      // Check eligibility criteria
      const isEligible = checkJobEligibility(studentData, jobData);
      
      if (isEligible) {
        eligibleStudents.push({
          id: studentId,
          rollNumber: studentData.rollNumber,
          ...studentData
        });
      }
    }

    return eligibleStudents;
  } catch (error) {
    console.error('Error getting eligible students:', error);
    return [];
  }
};

// Helper function to check job eligibility
const checkJobEligibility = (studentData, jobData) => {
  try {
    // CGPA check
    const studentCGPA = parseFloat(studentData.cgpa) || 0;
    const requiredCGPA = parseFloat(jobData.minCGPA) || 0;
    if (studentCGPA < requiredCGPA) return false;

    // Skills check
    const studentSkills = (studentData.skills || []).map(skill => skill.toLowerCase());
    const requiredSkills = (jobData.skills || []).map(skill => skill.toLowerCase());
    if (requiredSkills.length > 0) {
      const hasRequiredSkills = requiredSkills.some(skill => studentSkills.includes(skill));
      if (!hasRequiredSkills) return false;
    }

    // Batch check
    const studentBatch = String(studentData.batch || '').toLowerCase();
    const eligibleBatches = (jobData.eligibleBatch || []).map(batch => String(batch).toLowerCase());
    if (eligibleBatches.length > 0) {
      const isBatchEligible = eligibleBatches.some(batch => 
        studentBatch.includes(batch) || batch.includes(studentBatch)
      );
      if (!isBatchEligible) return false;
    }

    // Gender check
    const studentGender = (studentData.gender || '').toLowerCase();
    const genderPref = (jobData.genderPreference || 'any').toLowerCase();
    if (genderPref !== 'any' && genderPref !== studentGender) return false;

    // Arrears check
    const studentCurrentArrears = parseInt(studentData.currentArrears || 0);
    const maxCurrentArrears = parseInt(jobData.maxCurrentArrears || 0);
    if (maxCurrentArrears > 0 && studentCurrentArrears > maxCurrentArrears) return false;

    const studentHistoryArrears = parseInt(studentData.historyArrears || 0);
    const maxHistoryArrears = parseInt(jobData.maxHistoryArrears || 0);
    if (maxHistoryArrears > 0 && studentHistoryArrears > maxHistoryArrears) return false;

    return true;
  } catch (error) {
    console.error('Error checking job eligibility:', error);
    return false;
  }
};

// Admin action: Job posted
export const notifyJobPosted = async (jobData) => {
  try {
    console.log('Sending job posting notifications...');
    const eligibleStudents = await getEligibleStudents(jobData);
    
    const notifications = eligibleStudents.map(student => 
      createJobPostingNotification(student.rollNumber || student.id, jobData, true)
    );
    
    await Promise.allSettled(notifications);
    console.log(`Job posting notifications sent to ${eligibleStudents.length} eligible students`);
    
    return eligibleStudents.length;
  } catch (error) {
    console.error('Error sending job posting notifications:', error);
    throw error;
  }
};

// Admin action: Application status updated
export const notifyApplicationStatusUpdate = async (applicationData, studentId) => {
  try {
    console.log('Sending application status update notification...');
    await createStatusUpdateNotification(studentId, applicationData, true);
    console.log('Application status notification sent successfully');
  } catch (error) {
    console.error('Error sending application status notification:', error);
    throw error;
  }
};

// Admin action: Interview scheduled
export const notifyInterviewScheduled = async (interviewData, studentId) => {
  try {
    console.log('Sending interview notification...');
    await createInterviewNotification(studentId, interviewData, true);
    console.log('Interview notification sent successfully');
  } catch (error) {
    console.error('Error sending interview notification:', error);
    throw error;
  }
};

// Admin action: Bulk status update (for recruitment rounds)
export const notifyBulkStatusUpdate = async (applications, newStatus) => {
  try {
    console.log(`Sending bulk status update notifications for ${applications.length} applications...`);
    
    const notifications = applications.map(application => 
      createStatusUpdateNotification(
        application.student_id, 
        { ...application, status: newStatus }, 
        true
      )
    );
    
    await Promise.allSettled(notifications);
    console.log(`Bulk status update notifications sent for ${applications.length} students`);
    
    return applications.length;
  } catch (error) {
    console.error('Error sending bulk status notifications:', error);
    throw error;
  }
};

// Admin action: Student selected/placed
export const notifyStudentSelection = async (studentId, jobData, offerDetails = null) => {
  try {
    console.log('Sending selection notification...');
    
    const notificationData = {
      title: '🎉 Congratulations! You have been selected!',
      message: `You have been selected for ${jobData.position} at ${jobData.company}. ${offerDetails ? `Offer details: ${offerDetails}` : 'Please check your applications for more details.'}`,
      type: 'job_selection',
      recipientId: studentId,
      isGeneral: false,
      recipientType: 'student',
      actionLink: '/student/applications',
      job: jobData,
      offerDetails
    };
    
    await createNotification(notificationData, true);
    console.log('Selection notification sent successfully');
  } catch (error) {
    console.error('Error sending selection notification:', error);
    throw error;
  }
};

// Admin action: General announcement
export const notifyGeneralAnnouncement = async (title, message, actionLink = null) => {
  try {
    console.log('Sending general announcement...');
    await createAnnouncementNotification(title, message, actionLink, true);
    console.log('General announcement sent successfully');
  } catch (error) {
    console.error('Error sending general announcement:', error);
    throw error;
  }
};

// Admin action: Deadline reminder
export const notifyDeadlineReminder = async (jobData, hoursRemaining) => {
  try {
    console.log('Sending deadline reminder notifications...');
    
    // Get students who have applied to this job
    const applicationsSnapshot = await getDocs(
      query(collection(db, 'applications'), where('jobId', '==', jobData.id))
    );
    
    const notifications = [];
    
    for (const applicationDoc of applicationsSnapshot.docs) {
      const applicationData = applicationDoc.data();
      const studentId = applicationData.student_id;
      
      const notificationData = {
        title: `⏰ Application Deadline Reminder`,
        message: `Only ${hoursRemaining} hours left to apply for ${jobData.position} at ${jobData.company}. Don't miss out!`,
        type: 'reminder',
        recipientId: studentId,
        isGeneral: false,
        recipientType: 'student',
        actionLink: '/student/jobpost',
        job: jobData,
        hoursRemaining
      };
      
      notifications.push(createNotification(notificationData, true));
    }
    
    await Promise.allSettled(notifications);
    console.log(`Deadline reminder notifications sent to ${notifications.length} students`);
    
    return notifications.length;
  } catch (error) {
    console.error('Error sending deadline reminder notifications:', error);
    throw error;
  }
};

// Admin action: Task/Assessment assigned
export const notifyTaskAssigned = async (taskData, targetStudents = null) => {
  try {
    console.log('Sending task assignment notifications...');
    
    let students = [];
    
    if (targetStudents) {
      students = targetStudents;
    } else {
      // Get all students or apply filters based on task criteria
      let studentsQuery = collection(db, 'students');
      const studentsSnapshot = await getDocs(studentsQuery);
      
      students = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Apply task filters
      if (taskData.targetBatch) {
        students = students.filter(student => student.batch === taskData.targetBatch);
      }
      if (taskData.targetDepartment) {
        students = students.filter(student => student.department === taskData.targetDepartment);
      }
    }
    
    const notifications = students.map(student => {
      const notificationData = {
        title: `📝 New Task: ${taskData.title}`,
        message: `A new task has been assigned to you. ${taskData.description ? taskData.description.substring(0, 100) + '...' : 'Please check your tasks page for details.'}`,
        type: 'task_added',
        recipientId: student.id,
        isGeneral: false,
        recipientType: 'student',
        actionLink: '/student/tasks',
        task: taskData
      };
      
      return createNotification(notificationData, true);
    });
    
    await Promise.allSettled(notifications);
    console.log(`Task assignment notifications sent to ${students.length} students`);
    
    return students.length;
  } catch (error) {
    console.error('Error sending task assignment notifications:', error);
    throw error;
  }
};

// Admin action: Gallery item added
export const notifyGalleryUpdate = async (galleryData) => {
  try {
    console.log('Sending gallery update notification...');
    
    const notificationData = {
      title: `📸 ${galleryData.title || 'New Gallery Item'}`,
      message: galleryData.description || 'A new item has been added to the gallery. Check it out!',
      type: 'gallery_update',
      recipientId: null,
      isGeneral: true,
      recipientType: 'student',
      actionLink: '/student/gallery',
      gallery: galleryData
    };
    
    await createNotification(notificationData, false); // Don't send email for gallery updates by default
    console.log('Gallery update notification sent successfully');
  } catch (error) {
    console.error('Error sending gallery update notification:', error);
    throw error;
  }
};

// Admin action: Event/Calendar update
export const notifyEventUpdate = async (eventData, isNewEvent = true) => {
  try {
    console.log('Sending event update notification...');
    
    const title = isNewEvent ? `📅 New Event: ${eventData.title}` : `📅 Event Updated: ${eventData.title}`;
    const message = `${eventData.description || 'Check your calendar for details.'} Date: ${new Date(eventData.date).toLocaleDateString()}`;
    
    const notificationData = {
      title,
      message,
      type: 'announcement',
      recipientId: null,
      isGeneral: true,
      recipientType: 'student',
      actionLink: '/student/calendar',
      event: eventData
    };
    
    await createNotification(notificationData, true);
    console.log('Event update notification sent successfully');
  } catch (error) {
    console.error('Error sending event update notification:', error);
    throw error;
  }
};

// Admin action: Resource added/updated
export const notifyResourceUpdate = async (resourceData, isNewResource = true) => {
  try {
    console.log('Sending resource update notification...');
    
    const title = isNewResource ? `📚 New Resource: ${resourceData.title}` : `📚 Resource Updated: ${resourceData.title}`;
    const message = resourceData.description || 'A new learning resource has been added. Check it out!';
    
    const notificationData = {
      title,
      message,
      type: 'announcement',
      recipientId: null,
      isGeneral: true,
      recipientType: 'student',
      actionLink: '/student/resources',
      resource: resourceData
    };
    
    await createNotification(notificationData, false); // Don't send email for resource updates by default
    console.log('Resource update notification sent successfully');
  } catch (error) {
    console.error('Error sending resource update notification:', error);
    throw error;
  }
};
