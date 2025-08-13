import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { sendEmailNotification, getStudentEmail } from './emailHelpers';

// Enhanced createNotification function with email support
export const createNotification = async (notificationData, sendEmail = false) => {
  try {
    const notification = {
      ...notificationData,
      isRead: false,
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'notifications'), notification);

    // Send email notification if requested and recipient is specified
    if (sendEmail && notificationData.recipientId) {
      try {
        const studentEmail = await getStudentEmail(notificationData.recipientId);
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
    recipientId: studentId,
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
  return createNotification({
    title: `New Job Posting: ${jobData.position} at ${jobData.company}`,
    message: `A new job opportunity matching your skills is available. Salary: ${jobData.salary || 'Not specified'}`,
    type: 'job_posting',
    recipientId: studentId,
    isGeneral: false,
    recipientType: 'student',
    actionLink: `/student/jobpost`,
    job: jobData
  }, sendEmail);
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
    recipientId: studentId,
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
  return createNotification({
    title: `New message in ${jobData.position} chat`,
    message: `${senderName}: ${message.length > 50 ? message.substring(0, 50) + '...' : message}`,
    type: 'chat_message',
    recipientId: recipientId,
    isGeneral: false,
    recipientType: 'student',
    actionLink: `/student/jobpost`,
    job: jobData,
    senderName,
    message
  }, sendEmail);
};