const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { logger } = require('firebase-functions');

const db = getFirestore();

// Helper function to get notification settings for a user
const getNotificationSettings = async (userId, rollNumber = null) => {
  try {
    const settingsId = rollNumber || userId;
    const settingsDoc = await db.collection('notification_settings').doc(settingsId).get();
    
    if (settingsDoc.exists) {
      return settingsDoc.data();
    }
    
    // Return default settings if none exist
    return {
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
      pushNotifications: true,
      emailNotifications: true
    };
  } catch (error) {
    logger.error('Error getting notification settings:', error);
    return null;
  }
};

// Helper function to get FCM token for a user
const getFCMToken = async (userId) => {
  try {
    const tokenDoc = await db.collection('fcm_tokens').doc(userId).get();
    return tokenDoc.exists ? tokenDoc.data().token : null;
  } catch (error) {
    logger.error('Error getting FCM token:', error);
    return null;
  }
};

// Helper function to send push notification
const sendPushNotification = async (token, title, body, data = {}) => {
  try {
    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: data.actionLink || ''
      },
      token
    };

    const response = await getMessaging().send(message);
    logger.info('Push notification sent successfully:', response);
    return response;
  } catch (error) {
    logger.error('Error sending push notification:', error);
    throw error;
  }
};

// Helper function to create notification document with idempotent ID
const createNotificationWithId = async (notificationId, notificationData) => {
  try {
    await db.collection('notifications').doc(notificationId).set({
      ...notificationData,
      isRead: false,
      timestamp: new Date()
    });
    return notificationId;
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
};

// Trigger: New job posted
exports.onJobCreated = onDocumentCreated('jobs/{jobId}', async (event) => {
  try {
    const jobData = event.data.data();
    const jobId = event.params.jobId;
    
    logger.info('New job created:', jobId);

    // Get all students to check eligibility
    const studentsSnapshot = await db.collection('students').get();
    
    for (const studentDoc of studentsSnapshot.docs) {
      const studentData = studentDoc.data();
      const studentId = studentDoc.id;
      
      // Check if student is eligible for this job
      const isEligible = checkJobEligibility(studentData, jobData);
      
      if (isEligible) {
        // Check notification settings
        const settings = await getNotificationSettings(studentId, studentData.rollNumber);
        
        if (settings && settings.categories.job_posting) {
          const recipientKey = studentData.rollNumber || studentId;
          const notificationId = `${recipientKey}_${jobId}_job_posting`;
          
          // Create notification
          await createNotificationWithId(notificationId, {
            title: `New Job: ${jobData.position} at ${jobData.company}`,
            message: `A new job opportunity matching your skills is available. Salary: ${jobData.salary || 'Not specified'}`,
            type: 'job_posting',
            recipientId: studentId,
            recipientRoll: studentData.rollNumber || null,
            isGeneral: false,
            recipientType: 'student',
            actionLink: '/student/jobpost',
            job: jobData,
            uniqueKey: notificationId
          });

          // Send push notification if enabled
          if (settings.pushNotifications) {
            const fcmToken = await getFCMToken(studentId);
            if (fcmToken) {
              await sendPushNotification(
                fcmToken,
                `New Job: ${jobData.position}`,
                `${jobData.company} - ${jobData.salary || 'Salary not specified'}`,
                {
                  type: 'job_posting',
                  jobId: jobId,
                  actionLink: '/student/jobpost'
                }
              );
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error in onJobCreated trigger:', error);
  }
});

// Trigger: Job updated
exports.onJobUpdated = onDocumentUpdated('jobs/{jobId}', async (event) => {
  try {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const jobId = event.params.jobId;
    
    // Determine what changed
    const changes = [];
    if (beforeData.deadline !== afterData.deadline) changes.push('deadline');
    if (JSON.stringify(beforeData.eligibilityCriteria) !== JSON.stringify(afterData.eligibilityCriteria)) changes.push('eligibility');
    if (beforeData.interviewDateTime !== afterData.interviewDateTime) changes.push('interview');
    if (beforeData.status !== afterData.status) changes.push('status');
    
    if (changes.length === 0) return; // No relevant changes
    
    logger.info('Job updated:', jobId, 'Changes:', changes);

    // Get students who applied to this job
    const applicationsSnapshot = await db.collection('applications')
      .where('jobId', '==', jobId)
      .get();
    
    for (const applicationDoc of applicationsSnapshot.docs) {
      const applicationData = applicationDoc.data();
      const studentId = applicationData.student_id;
      
      // Get student data
      const studentDoc = await db.collection('students').doc(studentId).get();
      if (!studentDoc.exists) continue;
      
      const studentData = studentDoc.data();
      
      // Check notification settings
      const settings = await getNotificationSettings(studentId, studentData.rollNumber);
      
      if (settings && settings.categories.job_update) {
        const recipientKey = studentData.rollNumber || studentId;
        const updateType = changes[0]; // Use first change as primary type
        const notificationId = `${recipientKey}_${jobId}_job_update_${updateType}`;
        
        const updateMessages = {
          deadline: 'The application deadline has been updated.',
          eligibility: 'The eligibility criteria have been updated.',
          interview: 'Interview details have been updated.',
          status: 'The job status has been updated.'
        };
        
        // Create notification
        await createNotificationWithId(notificationId, {
          title: `Job Updated: ${afterData.position} at ${afterData.company}`,
          message: updateMessages[updateType] || 'Job details have been updated.',
          type: 'job_update',
          recipientId: studentId,
          recipientRoll: studentData.rollNumber || null,
          isGeneral: false,
          recipientType: 'student',
          actionLink: '/student/jobpost',
          job: afterData,
          updateType,
          uniqueKey: notificationId
        });

        // Send push notification if enabled
        if (settings.pushNotifications) {
          const fcmToken = await getFCMToken(studentId);
          if (fcmToken) {
            await sendPushNotification(
              fcmToken,
              `Job Updated: ${afterData.position}`,
              updateMessages[updateType] || 'Job details have been updated.',
              {
                type: 'job_update',
                jobId: jobId,
                actionLink: '/student/jobpost'
              }
            );
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error in onJobUpdated trigger:', error);
  }
});

// Trigger: Application status updated
exports.onApplicationUpdated = onDocumentUpdated('applications/{applicationId}', async (event) => {
  try {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    
    // Check if status changed
    if (beforeData.status === afterData.status) return;
    
    const studentId = afterData.student_id;
    const applicationId = event.params.applicationId;
    
    logger.info('Application status updated:', applicationId, 'New status:', afterData.status);

    // Get student data
    const studentDoc = await db.collection('students').doc(studentId).get();
    if (!studentDoc.exists) return;
    
    const studentData = studentDoc.data();
    
    // Check notification settings
    const settings = await getNotificationSettings(studentId, studentData.rollNumber);
    
    if (settings && settings.categories.status_update) {
      const recipientKey = studentData.rollNumber || studentId;
      const notificationId = `${recipientKey}_${applicationId}_status_update`;
      
      const statusMessages = {
        under_review: 'Your application is now under review.',
        shortlisted: 'Congratulations! You have been shortlisted.',
        interview_scheduled: 'You have been scheduled for an interview.',
        selected: 'Congratulations! You have been selected for the position.',
        rejected: 'We regret to inform you that your application was not selected.',
        waitlisted: 'You have been waitlisted for the position.'
      };
      
      // Create notification
      await createNotificationWithId(notificationId, {
        title: `Application Status Update: ${afterData.job?.position || 'Unknown Position'}`,
        message: statusMessages[afterData.status] || 'Your application status has been updated.',
        type: 'status_update',
        recipientId: studentId,
        recipientRoll: studentData.rollNumber || null,
        isGeneral: false,
        recipientType: 'student',
        actionLink: '/student/applications',
        job: afterData.job,
        status: afterData.status,
        uniqueKey: notificationId
      });

      // Send push notification if enabled
      if (settings.pushNotifications) {
        const fcmToken = await getFCMToken(studentId);
        if (fcmToken) {
          await sendPushNotification(
            fcmToken,
            `Application Update: ${afterData.job?.position || 'Job'}`,
            statusMessages[afterData.status] || 'Your application status has been updated.',
            {
              type: 'status_update',
              applicationId: applicationId,
              actionLink: '/student/applications'
            }
          );
        }
      }
    }
  } catch (error) {
    logger.error('Error in onApplicationUpdated trigger:', error);
  }
});

// Trigger: New task created
exports.onTaskCreated = onDocumentCreated('tasks/{taskId}', async (event) => {
  try {
    const taskData = event.data.data();
    const taskId = event.params.taskId;
    
    logger.info('New task created:', taskId);

    // Get target students (could be all students or specific batch/department)
    let studentsQuery = db.collection('students');
    
    // Apply filters if specified in task
    if (taskData.targetBatch) {
      studentsQuery = studentsQuery.where('batch', '==', taskData.targetBatch);
    }
    if (taskData.targetDepartment) {
      studentsQuery = studentsQuery.where('department', '==', taskData.targetDepartment);
    }
    
    const studentsSnapshot = await studentsQuery.get();
    
    for (const studentDoc of studentsSnapshot.docs) {
      const studentData = studentDoc.data();
      const studentId = studentDoc.id;
      
      // Check notification settings
      const settings = await getNotificationSettings(studentId, studentData.rollNumber);
      
      if (settings && settings.categories.task_added) {
        const recipientKey = studentData.rollNumber || studentId;
        const notificationId = `${recipientKey}_${taskId}_task_added`;
        
        // Create notification
        await createNotificationWithId(notificationId, {
          title: `New Task: ${taskData.title || 'Task Added'}`,
          message: `A new task has been assigned to you. ${taskData.description ? taskData.description.substring(0, 100) + '...' : ''}`,
          type: 'task_added',
          recipientId: studentId,
          recipientRoll: studentData.rollNumber || null,
          isGeneral: false,
          recipientType: 'student',
          actionLink: '/student/tasks',
          task: taskData,
          uniqueKey: notificationId
        });

        // Send push notification if enabled
        if (settings.pushNotifications) {
          const fcmToken = await getFCMToken(studentId);
          if (fcmToken) {
            await sendPushNotification(
              fcmToken,
              `New Task: ${taskData.title || 'Task'}`,
              taskData.description ? taskData.description.substring(0, 100) + '...' : 'A new task has been assigned.',
              {
                type: 'task_added',
                taskId: taskId,
                actionLink: '/student/tasks'
              }
            );
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error in onTaskCreated trigger:', error);
  }
});

// Trigger: New gallery item added
exports.onGalleryItemCreated = onDocumentCreated('gallery/{itemId}', async (event) => {
  try {
    const galleryData = event.data.data();
    const itemId = event.params.itemId;
    
    logger.info('New gallery item created:', itemId);

    // Create general notification for all students
    const notificationId = `gallery_update_${itemId}`;
    
    await createNotificationWithId(notificationId, {
      title: galleryData.title || 'New Gallery Item',
      message: galleryData.description || 'A new item has been added to the gallery.',
      type: 'gallery_update',
      recipientId: null,
      isGeneral: true,
      recipientType: 'student',
      actionLink: '/student/gallery',
      uniqueKey: notificationId
    });

    // Send push notifications to all students with gallery notifications enabled
    const fcmTokensSnapshot = await db.collection('fcm_tokens')
      .where('userType', '==', 'student')
      .get();
    
    const pushPromises = [];
    
    for (const tokenDoc of fcmTokensSnapshot.docs) {
      const tokenData = tokenDoc.data();
      const settings = await getNotificationSettings(tokenData.userId, tokenData.rollNumber);
      
      if (settings && settings.categories.gallery_update && settings.pushNotifications) {
        pushPromises.push(
          sendPushNotification(
            tokenData.token,
            galleryData.title || 'New Gallery Item',
            galleryData.description || 'A new item has been added to the gallery.',
            {
              type: 'gallery_update',
              itemId: itemId,
              actionLink: '/student/gallery'
            }
          ).catch(error => {
            logger.error('Failed to send push notification to:', tokenData.userId, error);
          })
        );
      }
    }
    
    await Promise.allSettled(pushPromises);
  } catch (error) {
    logger.error('Error in onGalleryItemCreated trigger:', error);
  }
});

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
      const hasRequiredSkills = requiredSkills.every(skill => studentSkills.includes(skill));
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
    logger.error('Error checking job eligibility:', error);
    return false;
  }
};
