import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { sendEmailNotification, getStudentEmail, getStudentEmailByRoll } from './emailHelpers';
import { getRollNumberByUid, isValidRollNumber } from './studentIdentity';

// Enhanced createNotification function with email support
export const createNotification = async (notificationData, sendEmail = false) => {
  try {
    // Resolve recipient roll for storage if possible
    let resolvedRecipientRoll = notificationData.recipientRoll || null;
    if (!resolvedRecipientRoll && notificationData.recipientId) {
      try {
        const byUid = await getRollNumberByUid(notificationData.recipientId);
        if (byUid) resolvedRecipientRoll = byUid;
      } catch (_e) {}
    }
    const notification = {
      ...notificationData,
      recipientRoll: resolvedRecipientRoll || notificationData.recipientRoll || null,
      isRead: false,
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'notifications'), notification);

    // Send email notification if requested and recipient is specified
    if (sendEmail && (notificationData.recipientRoll || notificationData.recipientId)) {
      try {
        let studentEmail = null;
        if (notificationData.recipientRoll && isValidRollNumber(notificationData.recipientRoll)) {
          studentEmail = await getStudentEmailByRoll(notificationData.recipientRoll);
        }
        if (!studentEmail && notificationData.recipientId) {
          studentEmail = await getStudentEmail(notificationData.recipientId);
        }
        if (studentEmail) {
          // Map notification type to email type
          const emailTypeMap = {
            'job_selection': 'selection',
            'offer_accepted': 'status_update',
            'offer_rejected': 'status_update',
            'status_update': 'status_update',
            'interview': 'interview',
            'announcement': 'announcement',
            'reminder': 'deadline_reminder',
            'chat_message': 'announcement'
          };

          const emailType = emailTypeMap[notificationData.type] || 'announcement';
          
          await sendEmailNotification(studentEmail, emailType, {
            studentName: notificationData.recipientName || 'Student',
            ...notificationData
          });
        }
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
        // Don't fail the main notification creation if email fails
      }
    }

    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Enhanced notification functions with email support
export const sendSelectionNotification = async (studentId, jobId, jobPosition, companyName, sendEmail = true) => {
  return createNotification({
    title: 'Congratulations! You have been selected!',
    message: `You have been selected for ${jobPosition} at ${companyName}. Please accept or reject your offer.`,
    type: 'job_selection',
    recipientId: isValidRollNumber(studentId) ? null : studentId,
    recipientRoll: isValidRollNumber(studentId) ? studentId : (await getRollNumberByUid(studentId)) || null,
    isGeneral: false,
    recipientType: 'student',
    actionLink: `/student/applications`,
    jobId: jobId,
    job: { position: jobPosition, company: companyName }
  }, sendEmail);
};

export const sendOfferAcceptedNotification = async (studentId, jobPosition, companyName, sendEmail = true) => {
  return createNotification({
    title: 'Offer Accepted!',
    message: `You have successfully accepted the offer for ${jobPosition} at ${companyName}. Congratulations on your placement!`,
    type: 'offer_accepted',
    recipientId: studentId,
    isGeneral: false,
    recipientType: 'student',
    actionLink: '/student/applications',
    job: { position: jobPosition, company: companyName }
  }, sendEmail);
};

export const sendOfferRejectedNotification = async (studentId, jobPosition, companyName, sendEmail = true) => {
  return createNotification({
    title: 'Offer Rejected',
    message: `You have rejected the offer for ${jobPosition} at ${companyName}. You may continue applying for other opportunities.`,
    type: 'offer_rejected',
    recipientId: studentId,
    isGeneral: false,
    recipientType: 'student',
    actionLink: '/student/applications',
    job: { position: jobPosition, company: companyName }
  }, sendEmail);
};

export const createEventNotification = async (studentId, title, message, actionLink = null, sendEmail = true) => {
  return createNotification({
    title,
    message,
    type: 'event',
    recipientId: studentId,
    isGeneral: false,
    recipientType: 'student',
    actionLink: actionLink || '/student/calendar'
  }, sendEmail);
};

export const createJobPostingNotification = async (studentId, jobData, sendEmail = true) => {
  // Use idempotent write with deterministic ID to prevent duplicates
  const recipientKey = isValidRollNumber(studentId) ? studentId : (await getRollNumberByUid(studentId)) || studentId;
  const deterministicId = `${recipientKey}_${jobData.id || jobData.jobId}_job_posting`;
  
  const notificationData = {
    title: `New Job Posting: ${jobData.position} at ${jobData.company}`,
    message: `A new job opportunity matching your skills is available. Salary: ${jobData.salary || 'Not specified'}`,
    type: 'job_posting',
    recipientId: isValidRollNumber(studentId) ? null : studentId,
    recipientRoll: isValidRollNumber(studentId) ? studentId : (await getRollNumberByUid(studentId)) || null,
    isGeneral: false,
    recipientType: 'student',
    actionLink: `/student/jobpost`,
    job: jobData,
    uniqueKey: deterministicId, // For debugging
    isRead: false,
    timestamp: serverTimestamp()
  };

  try {
    // Use setDoc with deterministic ID to ensure idempotency
    await setDoc(doc(db, 'notifications', deterministicId), notificationData);
    
    // Send email notification if requested
    if (sendEmail && (notificationData.recipientRoll || notificationData.recipientId)) {
      try {
        let studentEmail = null;
        if (notificationData.recipientRoll && isValidRollNumber(notificationData.recipientRoll)) {
          studentEmail = await getStudentEmailByRoll(notificationData.recipientRoll);
        }
        if (!studentEmail && notificationData.recipientId) {
          studentEmail = await getStudentEmail(notificationData.recipientId);
        }
        if (studentEmail) {
          await sendEmailNotification(studentEmail, 'announcement', {
            studentName: notificationData.recipientName || 'Student',
            ...notificationData
          });
        }
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
      }
    }
    
    return deterministicId;
  } catch (error) {
    console.error('Error creating job posting notification:', error);
    throw error;
  }
};

export const createStatusUpdateNotification = async (studentId, applicationData, sendEmail = true) => {
  const statusMessages = {
    under_review: 'Your application is now under review.',
    shortlisted: 'Congratulations! You have been shortlisted.',
    interview_scheduled: 'You have been scheduled for an interview.',
    selected: 'Congratulations! You have been selected for the position.',
    rejected: 'We regret to inform you that your application was not selected.',
    waitlisted: 'You have been waitlisted for the position.'
  };

  return createNotification({
    title: `Application Status Update: ${applicationData.job?.position || 'Unknown Position'}`,
    message: statusMessages[applicationData.status] || 'Your application status has been updated.',
    type: 'status_update',
    recipientId: isValidRollNumber(studentId) ? null : studentId,
    recipientRoll: isValidRollNumber(studentId) ? studentId : (await getRollNumberByUid(studentId)) || null,
    isGeneral: false,
    recipientType: 'student',
    actionLink: `/student/applications`,
    job: applicationData.job,
    status: applicationData.status,
    interviewDateTime: applicationData.interviewDateTime,
    interviewLocation: applicationData.interviewLocation
  }, sendEmail);
};

export const createInterviewNotification = async (studentId, interviewData, sendEmail = true) => {
  return createNotification({
    title: `Interview Scheduled: ${interviewData.job?.position || 'Unknown Position'}`,
    message: `Your interview has been scheduled for ${new Date(interviewData.interviewDateTime).toLocaleString()}. Please be prepared.`,
    type: 'interview',
    recipientId: studentId,
    isGeneral: false,
    recipientType: 'student',
    actionLink: `/student/applications`,
    job: interviewData.job,
    interviewDateTime: interviewData.interviewDateTime,
    interviewLocation: interviewData.interviewLocation
  }, sendEmail);
};

export const createAnnouncementNotification = async (title, message, actionLink = null, sendEmail = false) => {
  return createNotification({
    title,
    message,
    type: 'announcement',
    recipientId: null,
    isGeneral: true,
    recipientType: 'student',
    actionLink
  }, sendEmail);
};

export const createReminderNotification = async (studentId, title, message, actionLink = null, sendEmail = true) => {
  return createNotification({
    title,
    message,
    type: 'reminder',
    recipientId: studentId,
    isGeneral: false,
    recipientType: 'student',
    actionLink
  }, sendEmail);
};

export const createCompanyActionNotification = async (title, message, actionLink = null, sendEmail = false) => {
  return createNotification({
    title,
    message,
    type: 'company_action',
    recipientId: null,
    isGeneral: true,
    recipientType: 'admin',
    actionLink
  }, sendEmail);
};

export const createJobEventNotification = async (title, message, actionLink = null, sendEmail = false) => {
  return createNotification({
    title,
    message,
    type: 'job_event',
    recipientId: null,
    isGeneral: true,
    recipientType: 'admin',
    actionLink
  }, sendEmail);
};

export const createStudentEventNotification = async (title, message, actionLink = null, sendEmail = false) => {
  return createNotification({
    title,
    message,
    type: 'student_event',
    recipientId: null,
    isGeneral: true,
    recipientType: 'admin',
    actionLink
  }, sendEmail);
};

export const createSystemAlertNotification = async (title, message, actionLink = null, sendEmail = false) => {
  return createNotification({
    title,
    message,
    type: 'system_alert',
    recipientId: null,
    isGeneral: true,
    recipientType: 'admin',
    actionLink
  }, sendEmail);
};

export const createChatMessageNotification = async (recipientId, jobData, senderName, message, sendEmail = false) => {
  // Use idempotent write for chat messages
  const recipientKey = isValidRollNumber(recipientId) ? recipientId : (await getRollNumberByUid(recipientId)) || recipientId;
  const messageHash = message.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '');
  const deterministicId = `${recipientKey}_${jobData.id}_chat_${Date.now()}_${messageHash}`;
  
  const notificationData = {
    title: `New message in ${jobData.position} chat`,
    message: `${senderName}: ${message.length > 50 ? message.substring(0, 50) + '...' : message}`,
    type: 'chat_message',
    recipientId: isValidRollNumber(recipientId) ? null : recipientId,
    recipientRoll: isValidRollNumber(recipientId) ? recipientId : (await getRollNumberByUid(recipientId)) || null,
    isGeneral: false,
    recipientType: 'student',
    actionLink: `/student/jobpost`,
    job: jobData,
    senderName,
    originalMessage: message,
    uniqueKey: deterministicId,
    isRead: false,
    timestamp: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'notifications', deterministicId), notificationData);
    
    if (sendEmail && (notificationData.recipientRoll || notificationData.recipientId)) {
      try {
        let studentEmail = null;
        if (notificationData.recipientRoll && isValidRollNumber(notificationData.recipientRoll)) {
          studentEmail = await getStudentEmailByRoll(notificationData.recipientRoll);
        }
        if (!studentEmail && notificationData.recipientId) {
          studentEmail = await getStudentEmail(notificationData.recipientId);
        }
        if (studentEmail) {
          await sendEmailNotification(studentEmail, 'announcement', {
            studentName: notificationData.recipientName || 'Student',
            ...notificationData
          });
        }
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
      }
    }
    
    return deterministicId;
  } catch (error) {
    console.error('Error creating chat message notification:', error);
    throw error;
  }
};

// New notification types
export const createJobUpdateNotification = async (studentId, jobData, updateType, sendEmail = true) => {
  const recipientKey = isValidRollNumber(studentId) ? studentId : (await getRollNumberByUid(studentId)) || studentId;
  const deterministicId = `${recipientKey}_${jobData.id}_job_update_${updateType}`;
  
  const updateMessages = {
    deadline: 'The application deadline has been updated.',
    eligibility: 'The eligibility criteria have been updated.',
    interview: 'Interview details have been updated.',
    status: 'The job status has been updated.',
    general: 'Job details have been updated.'
  };
  
  const notificationData = {
    title: `Job Updated: ${jobData.position} at ${jobData.company}`,
    message: updateMessages[updateType] || updateMessages.general,
    type: 'job_update',
    recipientId: isValidRollNumber(studentId) ? null : studentId,
    recipientRoll: isValidRollNumber(studentId) ? studentId : (await getRollNumberByUid(studentId)) || null,
    isGeneral: false,
    recipientType: 'student',
    actionLink: `/student/jobpost`,
    job: jobData,
    updateType,
    uniqueKey: deterministicId,
    isRead: false,
    timestamp: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'notifications', deterministicId), notificationData);
    
    if (sendEmail && (notificationData.recipientRoll || notificationData.recipientId)) {
      try {
        let studentEmail = null;
        if (notificationData.recipientRoll && isValidRollNumber(notificationData.recipientRoll)) {
          studentEmail = await getStudentEmailByRoll(notificationData.recipientRoll);
        }
        if (!studentEmail && notificationData.recipientId) {
          studentEmail = await getStudentEmail(notificationData.recipientId);
        }
        if (studentEmail) {
          await sendEmailNotification(studentEmail, 'announcement', {
            studentName: notificationData.recipientName || 'Student',
            ...notificationData
          });
        }
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
      }
    }
    
    return deterministicId;
  } catch (error) {
    console.error('Error creating job update notification:', error);
    throw error;
  }
};

export const createTaskAddedNotification = async (studentId, taskData, sendEmail = true) => {
  const recipientKey = isValidRollNumber(studentId) ? studentId : (await getRollNumberByUid(studentId)) || studentId;
  const deterministicId = `${recipientKey}_${taskData.id}_task_added`;
  
  const notificationData = {
    title: `New Task: ${taskData.title || 'Task Added'}`,
    message: `A new task has been assigned to you. ${taskData.description ? taskData.description.substring(0, 100) + '...' : ''}`,
    type: 'task_added',
    recipientId: isValidRollNumber(studentId) ? null : studentId,
    recipientRoll: isValidRollNumber(studentId) ? studentId : (await getRollNumberByUid(studentId)) || null,
    isGeneral: false,
    recipientType: 'student',
    actionLink: `/student/tasks`,
    task: taskData,
    uniqueKey: deterministicId,
    isRead: false,
    timestamp: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'notifications', deterministicId), notificationData);
    
    if (sendEmail && (notificationData.recipientRoll || notificationData.recipientId)) {
      try {
        let studentEmail = null;
        if (notificationData.recipientRoll && isValidRollNumber(notificationData.recipientRoll)) {
          studentEmail = await getStudentEmailByRoll(notificationData.recipientRoll);
        }
        if (!studentEmail && notificationData.recipientId) {
          studentEmail = await getStudentEmail(notificationData.recipientId);
        }
        if (studentEmail) {
          await sendEmailNotification(studentEmail, 'deadline_reminder', {
            studentName: notificationData.recipientName || 'Student',
            ...notificationData
          });
        }
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
      }
    }
    
    return deterministicId;
  } catch (error) {
    console.error('Error creating task added notification:', error);
    throw error;
  }
};

export const createGalleryUpdateNotification = async (title, message, actionLink = null, sendEmail = false) => {
  const deterministicId = `gallery_update_${Date.now()}`;
  
  const notificationData = {
    title,
    message,
    type: 'gallery_update',
    recipientId: null,
    isGeneral: true,
    recipientType: 'student',
    actionLink: actionLink || '/student/gallery',
    uniqueKey: deterministicId,
    isRead: false,
    timestamp: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'notifications', deterministicId), notificationData);
    return deterministicId;
  } catch (error) {
    console.error('Error creating gallery update notification:', error);
    throw error;
  }
};