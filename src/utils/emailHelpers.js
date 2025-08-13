import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Email templates for different notification types
const emailTemplates = {
  // Job Application Notifications
  job_application: {
    subject: 'Job Application Submitted Successfully',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🎯 Application Submitted!</h1>
        </div>
        <div style="padding: 20px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${data.studentName || 'Student'},</h2>
          <p style="color: #555; line-height: 1.6; margin-bottom: 15px;">
            Your application has been successfully submitted for the position of <strong>${data.jobPosition}</strong> at <strong>${data.companyName}</strong>.
          </p>
          <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Application Details:</h3>
            <ul style="color: #555; line-height: 1.6;">
              <li><strong>Position:</strong> ${data.jobPosition}</li>
              <li><strong>Company:</strong> ${data.companyName}</li>
              <li><strong>Location:</strong> ${data.location || 'Not specified'}</li>
              <li><strong>Package:</strong> ${data.package || 'Not specified'}</li>
              <li><strong>Applied Date:</strong> ${new Date().toLocaleDateString()}</li>
            </ul>
          </div>
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            We will review your application and get back to you soon. You can track your application status in your dashboard.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.dashboardUrl || '/student/applications'}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
              View Application Status
            </a>
          </div>
          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px;">
            Best of luck with your application!<br>
            T&P Cell Team
          </p>
        </div>
      </div>
    `
  },

  // Status Update Notifications
  status_update: {
    subject: 'Application Status Update',
    template: (data) => {
      const statusEmojis = {
        shortlisted: '✅',
        rejected: '❌',
        interview_scheduled: '📅',
        selected: '🎉',
        under_review: '⏳',
        waitlisted: '🟡'
      };

      const statusMessages = {
        shortlisted: 'Congratulations! You have been shortlisted for the next round.',
        rejected: 'We regret to inform you that your application was not selected for this position.',
        interview_scheduled: 'Great news! You have been scheduled for an interview.',
        selected: 'Fantastic! You have been selected for this position.',
        under_review: 'Your application is currently under review by our team.',
        waitlisted: 'You have been waitlisted for this position.'
      };

      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">${statusEmojis[data.status] || '📢'} Status Update</h1>
          </div>
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${data.studentName || 'Student'},</h2>
            <p style="color: #555; line-height: 1.6; margin-bottom: 15px;">
              ${statusMessages[data.status] || 'Your application status has been updated.'}
            </p>
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Application Details:</h3>
              <ul style="color: #555; line-height: 1.6;">
                <li><strong>Position:</strong> ${data.jobPosition}</li>
                <li><strong>Company:</strong> ${data.companyName}</li>
                <li><strong>Status:</strong> <span style="color: ${data.status === 'shortlisted' || data.status === 'selected' ? '#28a745' : data.status === 'rejected' ? '#dc3545' : '#ffc107'}">${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</span></li>
                <li><strong>Updated Date:</strong> ${new Date().toLocaleDateString()}</li>
              </ul>
            </div>
            ${data.status === 'interview_scheduled' && data.interviewDateTime ? `
              <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3; margin: 20px 0;">
                <h3 style="color: #1976d2; margin-top: 0;">📅 Interview Details:</h3>
                <p style="color: #1976d2; margin: 0;"><strong>Date & Time:</strong> ${new Date(data.interviewDateTime).toLocaleString()}</p>
                ${data.interviewLocation ? `<p style="color: #1976d2; margin: 5px 0 0 0;"><strong>Location:</strong> ${data.interviewLocation}</p>` : ''}
              </div>
            ` : ''}
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.dashboardUrl || '/student/applications'}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                View Application Details
              </a>
            </div>
            <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px;">
              Best regards,<br>
              T&P Cell Team
            </p>
          </div>
        </div>
      `;
    }
  },

  // Interview Notifications
  interview: {
    subject: 'Interview Scheduled - Important Information',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">📅 Interview Scheduled!</h1>
        </div>
        <div style="padding: 20px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${data.studentName || 'Student'},</h2>
          <p style="color: #555; line-height: 1.6; margin-bottom: 15px;">
            Great news! You have been scheduled for an interview for the position of <strong>${data.jobPosition}</strong> at <strong>${data.companyName}</strong>.
          </p>
          <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Interview Details:</h3>
            <ul style="color: #555; line-height: 1.6;">
              <li><strong>Position:</strong> ${data.jobPosition}</li>
              <li><strong>Company:</strong> ${data.companyName}</li>
              <li><strong>Date & Time:</strong> ${new Date(data.interviewDateTime).toLocaleString()}</li>
              <li><strong>Location:</strong> ${data.interviewLocation || 'To be announced'}</li>
              <li><strong>Mode:</strong> ${data.interviewMode || 'In-person'}</li>
            </ul>
          </div>
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">📋 Preparation Tips:</h3>
            <ul style="color: #856404; line-height: 1.6;">
              <li>Research the company and role thoroughly</li>
              <li>Prepare your portfolio and resume</li>
              <li>Practice common interview questions</li>
              <li>Dress professionally and arrive early</li>
              <li>Bring necessary documents and certificates</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.dashboardUrl || '/student/applications'}" style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
              View Interview Details
            </a>
          </div>
          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px;">
            Good luck with your interview!<br>
            T&P Cell Team
          </p>
        </div>
      </div>
    `
  },

  // Selection Notifications
  selection: {
    subject: '🎉 Congratulations! You Have Been Selected!',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🎉 Congratulations!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">You Have Been Selected!</p>
        </div>
        <div style="padding: 20px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${data.studentName || 'Student'},</h2>
          <p style="color: #555; line-height: 1.6; margin-bottom: 15px; font-size: 16px;">
            We are thrilled to inform you that you have been <strong>SELECTED</strong> for the position of <strong>${data.jobPosition}</strong> at <strong>${data.companyName}</strong>!
          </p>
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">🎯 Selection Details:</h3>
            <ul style="color: #555; line-height: 1.6;">
              <li><strong>Position:</strong> ${data.jobPosition}</li>
              <li><strong>Company:</strong> ${data.companyName}</li>
              <li><strong>Package:</strong> ${data.package || 'To be discussed'}</li>
              <li><strong>Location:</strong> ${data.location || 'To be announced'}</li>
              <li><strong>Selection Date:</strong> ${new Date().toLocaleDateString()}</li>
            </ul>
          </div>
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
            <h3 style="color: #155724; margin-top: 0;">📋 Next Steps:</h3>
            <ol style="color: #155724; line-height: 1.6;">
              <li>Review and accept the offer letter</li>
              <li>Complete any required documentation</li>
              <li>Attend orientation sessions (if scheduled)</li>
              <li>Prepare for your new role</li>
            </ol>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.dashboardUrl || '/student/applications'}" style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
              Accept Offer
            </a>
          </div>
          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px;">
            Welcome to the team! We're excited to have you on board.<br>
            T&P Cell Team
          </p>
        </div>
      </div>
    `
  },

  // General Announcements
  announcement: {
    subject: 'Important Announcement from T&P Cell',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">📢 Announcement</h1>
        </div>
        <div style="padding: 20px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${data.studentName || 'Student'},</h2>
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #17a2b8; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">${data.title}</h3>
            <p style="color: #555; line-height: 1.6; margin-bottom: 15px;">
              ${data.message}
            </p>
            ${data.actionLink ? `
              <div style="text-align: center; margin: 20px 0;">
                <a href="${data.actionLink}" style="background: #17a2b8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                  View Details
                </a>
              </div>
            ` : ''}
          </div>
          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px;">
            Best regards,<br>
            T&P Cell Team
          </p>
        </div>
      </div>
    `
  },

  // Deadline Reminders
  deadline_reminder: {
    subject: '⏰ Deadline Reminder - Don\'t Miss This Opportunity!',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">⏰ Deadline Reminder</h1>
        </div>
        <div style="padding: 20px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${data.studentName || 'Student'},</h2>
          <p style="color: #555; line-height: 1.6; margin-bottom: 15px;">
            This is a friendly reminder that the application deadline for <strong>${data.jobPosition}</strong> at <strong>${data.companyName}</strong> is approaching.
          </p>
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">⏰ Deadline Information:</h3>
            <ul style="color: #555; line-height: 1.6;">
              <li><strong>Position:</strong> ${data.jobPosition}</li>
              <li><strong>Company:</strong> ${data.companyName}</li>
              <li><strong>Deadline:</strong> <span style="color: #dc3545; font-weight: bold;">${new Date(data.deadline).toLocaleDateString()}</span></li>
              <li><strong>Time Remaining:</strong> <span style="color: #dc3545; font-weight: bold;">${data.timeRemaining}</span></li>
            </ul>
          </div>
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">🚀 Quick Actions:</h3>
            <ul style="color: #856404; line-height: 1.6;">
              <li>Review job requirements</li>
              <li>Update your resume if needed</li>
              <li>Submit your application</li>
              <li>Prepare for any screening questions</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.applyUrl || '/student/jobpost'}" style="background: #ffc107; color: #333; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
              Apply Now
            </a>
          </div>
          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px;">
            Don't miss this opportunity!<br>
            T&P Cell Team
          </p>
        </div>
      </div>
    `
  }
};

// Email service configuration
const emailConfig = {
  // You can use different email services
  // For development, you can use services like:
  // - SendGrid (recommended for production)
  // - Nodemailer with Gmail
  // - AWS SES
  // - Mailgun
  
  // SendGrid configuration (recommended)
  sendgrid: {
    apiKey: process.env.REACT_APP_SENDGRID_API_KEY,
    fromEmail: process.env.REACT_APP_FROM_EMAIL || 'noreply@yourdomain.com',
    fromName: process.env.REACT_APP_FROM_NAME || 'T&P Cell'
  },

  // Gmail configuration (for development)
  gmail: {
    user: process.env.REACT_APP_GMAIL_USER,
    pass: process.env.REACT_APP_GMAIL_APP_PASSWORD,
    fromEmail: process.env.REACT_APP_FROM_EMAIL || 'noreply@yourdomain.com',
    fromName: process.env.REACT_APP_FROM_NAME || 'T&P Cell'
  }
};

// Main email sending function
export const sendEmailNotification = async (recipientEmail, notificationType, data, options = {}) => {
  try {
    // Get email template
    const template = emailTemplates[notificationType];
    if (!template) {
      throw new Error(`No email template found for type: ${notificationType}`);
    }

    // Prepare email data
    const emailData = {
      to: recipientEmail,
      subject: template.subject,
      html: template.template(data),
      ...options
    };

    // Store email in Firestore for tracking
    const emailLog = {
      recipientEmail,
      notificationType,
      subject: emailData.subject,
      data,
      sentAt: serverTimestamp(),
      status: 'pending',
      attempts: 0
    };

    const emailLogRef = await addDoc(collection(db, 'emailLogs'), emailLog);

    // Try to send email (this will be handled by Cloud Functions in production)
    try {
      // For now, we'll simulate email sending
      // In production, this should call a Cloud Function
      console.log('Email would be sent:', emailData);
      
      // Update email log status
      // await updateDoc(doc(db, 'emailLogs', emailLogRef.id), { status: 'sent' });
      
      return { success: true, emailLogId: emailLogRef.id };
    } catch (error) {
      // Update email log with error
      // await updateDoc(doc(db, 'emailLogs', emailLogRef.id), { 
      //   status: 'failed', 
      //   error: error.message,
      //   attempts: 1
      // });
      
      throw error;
    }
  } catch (error) {
    console.error('Error sending email notification:', error);
    throw error;
  }
};

// Batch email sending for multiple recipients
export const sendBatchEmailNotifications = async (recipients, notificationType, data, options = {}) => {
  try {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await sendEmailNotification(
          recipient.email,
          notificationType,
          data,
          { ...options, recipientName: recipient.name }
        );
        results.push({ ...result, recipient: recipient.email, success: true });
      } catch (error) {
        results.push({ 
          recipient: recipient.email, 
          success: false, 
          error: error.message 
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error sending batch email notifications:', error);
    throw error;
  }
};

// Email notification for specific user actions
export const sendJobApplicationEmail = async (studentEmail, studentName, jobData) => {
  return sendEmailNotification(studentEmail, 'job_application', {
    studentName,
    jobPosition: jobData.position,
    companyName: jobData.company,
    location: jobData.location,
    package: jobData.ctc || jobData.salary,
    dashboardUrl: `/student/applications`
  });
};

export const sendStatusUpdateEmail = async (studentEmail, studentName, applicationData) => {
  return sendEmailNotification(studentEmail, 'status_update', {
    studentName,
    status: applicationData.status,
    jobPosition: applicationData.job?.position,
    companyName: applicationData.job?.company,
    interviewDateTime: applicationData.interviewDateTime,
    interviewLocation: applicationData.interviewLocation,
    dashboardUrl: `/student/applications`
  });
};

export const sendInterviewEmail = async (studentEmail, studentName, interviewData) => {
  return sendEmailNotification(studentEmail, 'interview', {
    studentName,
    jobPosition: interviewData.job?.position,
    companyName: interviewData.job?.company,
    interviewDateTime: interviewData.interviewDateTime,
    interviewLocation: interviewData.interviewLocation,
    interviewMode: interviewData.interviewMode || 'In-person',
    dashboardUrl: `/student/applications`
  });
};

export const sendSelectionEmail = async (studentEmail, studentName, selectionData) => {
  return sendEmailNotification(studentEmail, 'selection', {
    studentName,
    jobPosition: selectionData.job?.position,
    companyName: selectionData.job?.company,
    package: selectionData.job?.ctc || selectionData.job?.salary,
    location: selectionData.job?.location,
    dashboardUrl: `/student/applications`
  });
};

export const sendAnnouncementEmail = async (studentEmail, studentName, announcementData) => {
  return sendEmailNotification(studentEmail, 'announcement', {
    studentName,
    title: announcementData.title,
    message: announcementData.message,
    actionLink: announcementData.actionLink
  });
};

export const sendDeadlineReminderEmail = async (studentEmail, studentName, reminderData) => {
  return sendEmailNotification(studentEmail, 'deadline_reminder', {
    studentName,
    jobPosition: reminderData.job?.position,
    companyName: reminderData.job?.company,
    deadline: reminderData.job?.deadline,
    timeRemaining: reminderData.timeRemaining,
    applyUrl: `/student/jobs/${reminderData.job?.id}`
  });
};

// Utility function to get student email from ID
export const getStudentEmail = async (studentId) => {
  try {
    const studentDoc = await getDoc(doc(db, 'students', studentId));
    if (studentDoc.exists()) {
      return studentDoc.data().email;
    }
    return null;
  } catch (error) {
    console.error('Error getting student email:', error);
    return null;
  }
};

// Utility function to get multiple student emails
export const getStudentEmails = async (studentIds) => {
  try {
    const emails = [];
    for (const studentId of studentIds) {
      const email = await getStudentEmail(studentId);
      if (email) {
        emails.push({ id: studentId, email });
      }
    }
    return emails;
  } catch (error) {
    console.error('Error getting student emails:', error);
    return [];
  }
};
