const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Configure SendGrid
sgMail.setApiKey(functions.config().sendgrid.api_key || process.env.SENDGRID_API_KEY);

const messaging = admin.messaging();

// Function to save FCM token for a student
exports.saveFCMToken = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { fcmToken, enabled } = data;
    const uid = context.auth.uid;

    if (!fcmToken) {
      throw new functions.https.HttpsError('invalid-argument', 'FCM token is required');
    }

    // Save FCM token to students collection
    await db.collection('students').doc(uid).update({
      fcmToken: fcmToken,
      pushNotificationsEnabled: enabled !== undefined ? enabled : true,
      lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: 'FCM token saved successfully' };
  } catch (error) {
    console.error('Error saving FCM token:', error);
    throw new functions.https.HttpsError('internal', 'Failed to save FCM token');
  }
});

// Function to send push notification to eligible students for a job
exports.sendJobNotificationToEligibleStudents = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // You can add admin role check here if needed
    // const userDoc = await db.collection('admins').doc(context.auth.uid).get();
    // if (!userDoc.exists) {
    //   throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    // }

    const { jobId, title, message, criteria } = data;

    if (!title || !message) {
      throw new functions.https.HttpsError('invalid-argument', 'Title and message are required');
    }

    // Query eligible students based on criteria
    let studentsQuery = db.collection('students')
      .where('pushNotificationsEnabled', '==', true)
      .where('fcmToken', '!=', null);

    // Add additional criteria if provided
    if (criteria) {
      if (criteria.department) {
        studentsQuery = studentsQuery.where('department', '==', criteria.department);
      }
      if (criteria.batch) {
        studentsQuery = studentsQuery.where('batch', '==', criteria.batch);
      }
      if (criteria.minCGPA) {
        studentsQuery = studentsQuery.where('cgpa', '>=', criteria.minCGPA);
      }
      if (criteria.skills && criteria.skills.length > 0) {
        // Note: Firestore doesn't support array-contains-any with multiple where clauses
        // You might need to implement this differently based on your data structure
      }
    }

    const studentsSnapshot = await studentsQuery.get();
    const tokens = [];

    studentsSnapshot.forEach(doc => {
      const studentData = doc.data();
      if (studentData.fcmToken && studentData.pushNotificationsEnabled) {
        tokens.push(studentData.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return { success: true, message: 'No eligible students found for push notifications' };
    }

    // Send push notification
    const notification = {
      title: title,
      body: message,
      data: {
        jobId: jobId || '',
        type: 'job_notification',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK'
      }
    };

    const messagePayload = {
      notification: notification,
      data: notification.data,
      tokens: tokens
    };

    const response = await messaging.sendMulticast(messagePayload);
    
    // Log results
    console.log('Push notification sent:', {
      successCount: response.successCount,
      failureCount: response.failureCount,
      totalTokens: tokens.length
    });

    // Save notification to database for tracking
    await db.collection('pushNotifications').add({
      jobId: jobId,
      title: title,
      message: message,
      criteria: criteria,
      tokensSent: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      sentBy: context.auth.uid
    });

    return {
      success: true,
      message: `Push notification sent to ${response.successCount} students`,
      successCount: response.successCount,
      failureCount: response.failureCount
    };

  } catch (error) {
    console.error('Error sending job notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send push notification');
  }
});

// Function to send push notification to admins
exports.sendNotificationToAdmins = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { title, message, type = 'general' } = data;

    if (!title || !message) {
      throw new functions.https.HttpsError('invalid-argument', 'Title and message are required');
    }

    // Query admin users with FCM tokens
    const adminsSnapshot = await db.collection('admins')
      .where('pushNotificationsEnabled', '==', true)
      .where('fcmToken', '!=', null)
      .get();

    const tokens = [];

    adminsSnapshot.forEach(doc => {
      const adminData = doc.data();
      if (adminData.fcmToken && adminData.pushNotificationsEnabled) {
        tokens.push(adminData.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return { success: true, message: 'No admins found for push notifications' };
    }

    // Send push notification
    const notification = {
      title: title,
      body: message,
      data: {
        type: type,
        clickAction: 'FLUTTER_NOTIFICATION_CLICK'
      }
    };

    const messagePayload = {
      notification: notification,
      data: notification.data,
      tokens: tokens
    };

    const response = await messaging.sendMulticast(messagePayload);

    // Save notification to database for tracking
    await db.collection('adminPushNotifications').add({
      title: title,
      message: message,
      type: type,
      tokensSent: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      sentBy: context.auth.uid
    });

    return {
      success: true,
      message: `Push notification sent to ${response.successCount} admins`,
      successCount: response.successCount,
      failureCount: response.failureCount
    };

  } catch (error) {
    console.error('Error sending admin notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send push notification');
  }
});

// Function to send push notification to specific users by IDs
exports.sendNotificationToSpecificUsers = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userIds, title, message, type = 'general', userType = 'student' } = data;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'User IDs array is required');
    }

    if (!title || !message) {
      throw new functions.https.HttpsError('invalid-argument', 'Title and message are required');
    }

    // Query users by IDs
    const collectionName = userType === 'admin' ? 'admins' : 'students';
    const usersSnapshot = await db.collection(collectionName)
      .where(admin.firestore.FieldPath.documentId(), 'in', userIds)
      .where('pushNotificationsEnabled', '==', true)
      .where('fcmToken', '!=', null)
      .get();

    const tokens = [];

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.fcmToken && userData.pushNotificationsEnabled) {
        tokens.push(userData.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return { success: true, message: 'No eligible users found for push notifications' };
    }

    // Send push notification
    const notification = {
      title: title,
      body: message,
      data: {
        type: type,
        userType: userType,
        clickAction: 'FLUTTER_NOTIFICATION_CLICK'
      }
    };

    const messagePayload = {
      notification: notification,
      data: notification.data,
      tokens: tokens
    };

    const response = await messaging.sendMulticast(messagePayload);

    // Save notification to database for tracking
    await db.collection('targetedPushNotifications').add({
      userIds: userIds,
      title: title,
      message: message,
      type: type,
      userType: userType,
      tokensSent: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      sentBy: context.auth.uid
    });

    return {
      success: true,
      message: `Push notification sent to ${response.successCount} users`,
      successCount: response.successCount,
      failureCount: response.failureCount
    };

  } catch (error) {
    console.error('Error sending targeted notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send push notification');
  }
});

// Function to handle FCM token cleanup when user disables notifications
exports.cleanupFCMToken = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { enabled } = data;
    const uid = context.auth.uid;

    if (enabled === false) {
      // Remove FCM token when notifications are disabled
      await db.collection('students').doc(uid).update({
        fcmToken: null,
        pushNotificationsEnabled: false,
        lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Re-enable notifications (token will be set when user re-enables)
      await db.collection('students').doc(uid).update({
        pushNotificationsEnabled: true,
        lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return { success: true, message: 'Push notification settings updated successfully' };
  } catch (error) {
    console.error('Error updating push notification settings:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update push notification settings');
  }
});

// Function to send email notifications
exports.sendEmailNotification = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { recipientEmail, notificationType, emailData, options = {} } = data;

    if (!recipientEmail || !notificationType || !emailData) {
      throw new functions.https.HttpsError('invalid-argument', 'Recipient email, notification type, and email data are required');
    }

    // Get email template from Firestore
    const templateDoc = await db.collection('emailTemplates').doc(notificationType).get();
    if (!templateDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Email template not found');
    }

    const template = templateDoc.data();
    
    // Prepare email message
    const msg = {
      to: recipientEmail,
      from: {
        email: functions.config().sendgrid.from_email || 'noreply@yourdomain.com',
        name: functions.config().sendgrid.from_name || 'T&P Cell'
      },
      subject: template.subject,
      html: template.html,
      ...options
    };

    // Send email via SendGrid
    const response = await sgMail.send(msg);

    // Log email in Firestore
    await db.collection('emailLogs').add({
      recipientEmail,
      notificationType,
      subject: msg.subject,
      data: emailData,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'sent',
      attempts: 1,
      sendgridResponse: response[0]?.statusCode,
      sentBy: context.auth.uid
    });

    return {
      success: true,
      message: 'Email sent successfully',
      sendgridResponse: response[0]?.statusCode
    };

  } catch (error) {
    console.error('Error sending email notification:', error);
    
    // Log failed email attempt
    try {
      await db.collection('emailLogs').add({
        recipientEmail: data?.recipientEmail,
        notificationType: data?.notificationType,
        subject: data?.emailData?.subject,
        data: data?.emailData,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'failed',
        attempts: 1,
        error: error.message,
        sentBy: context.auth?.uid
      });
    } catch (logError) {
      console.error('Error logging failed email:', logError);
    }

    throw new functions.https.HttpsError('internal', 'Failed to send email notification');
  }
});

// Function to send batch email notifications
exports.sendBatchEmailNotifications = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { recipients, notificationType, emailData, options = {} } = data;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Recipients array is required');
    }

    if (!notificationType || !emailData) {
      throw new functions.https.HttpsError('invalid-argument', 'Notification type and email data are required');
    }

    // Get email template
    const templateDoc = await db.collection('emailTemplates').doc(notificationType).get();
    if (!templateDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Email template not found');
    }

    const template = templateDoc.data();
    const results = [];

    // Send emails to each recipient
    for (const recipient of recipients) {
      try {
        const msg = {
          to: recipient.email,
          from: {
            email: functions.config().sendgrid.from_email || 'noreply@yourdomain.com',
            name: functions.config().sendgrid.from_name || 'T&P Cell'
          },
          subject: template.subject,
          html: template.html,
          ...options
        };

        const response = await sgMail.send(msg);
        
        results.push({
          recipient: recipient.email,
          success: true,
          sendgridResponse: response[0]?.statusCode
        });

        // Log successful email
        await db.collection('emailLogs').add({
          recipientEmail: recipient.email,
          notificationType,
          subject: msg.subject,
          data: { ...emailData, recipientName: recipient.name },
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'sent',
          attempts: 1,
          sendgridResponse: response[0]?.statusCode,
          sentBy: context.auth.uid
        });

      } catch (error) {
        console.error(`Error sending email to ${recipient.email}:`, error);
        
        results.push({
          recipient: recipient.email,
          success: false,
          error: error.message
        });

        // Log failed email
        await db.collection('emailLogs').add({
          recipientEmail: recipient.email,
          notificationType,
          subject: template.subject,
          data: { ...emailData, recipientName: recipient.name },
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'failed',
          attempts: 1,
          error: error.message,
          sentBy: context.auth.uid
        });
      }
    }

    return {
      success: true,
      message: `Batch email processing completed. ${results.filter(r => r.success).length} successful, ${results.filter(r => !r.success).length} failed.`,
      results
    };

  } catch (error) {
    console.error('Error sending batch email notifications:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send batch email notifications');
  }
});

// Function to retry failed emails
exports.retryFailedEmails = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated and is admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { emailLogId } = data;
    if (!emailLogId) {
      throw new functions.https.HttpsError('invalid-argument', 'Email log ID is required');
    }

    // Get the failed email log
    const emailLogDoc = await db.collection('emailLogs').doc(emailLogId).get();
    if (!emailLogDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Email log not found');
    }

    const emailLog = emailLogDoc.data();
    if (emailLog.status !== 'failed') {
      throw new functions.https.HttpsError('failed-precondition', 'Email is not in failed status');
    }

    // Get email template
    const templateDoc = await db.collection('emailTemplates').doc(emailLog.notificationType).get();
    if (!templateDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Email template not found');
    }

    const template = templateDoc.data();

    // Prepare email message
    const msg = {
      to: emailLog.recipientEmail,
      from: {
        email: functions.config().sendgrid.from_email || 'noreply@yourdomain.com',
        name: functions.config().sendgrid.from_name || 'T&P Cell'
      },
      subject: emailLog.subject,
      html: template.html
    };

    // Send email
    const response = await sgMail.send(msg);

    // Update email log
    await db.collection('emailLogs').doc(emailLogId).update({
      status: 'sent',
      attempts: emailLog.attempts + 1,
      sendgridResponse: response[0]?.statusCode,
      retriedAt: admin.firestore.FieldValue.serverTimestamp(),
      retriedBy: context.auth.uid
    });

    return {
      success: true,
      message: 'Email retry successful',
      sendgridResponse: response[0]?.statusCode
    };

  } catch (error) {
    console.error('Error retrying failed email:', error);
    
    // Update email log with retry failure
    try {
      await db.collection('emailLogs').doc(data.emailLogId).update({
        attempts: (await db.collection('emailLogs').doc(data.emailLogId).get()).data().attempts + 1,
        lastRetryError: error.message,
        lastRetryAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (logError) {
      console.error('Error updating email log for retry failure:', logError);
    }

    throw new functions.https.HttpsError('internal', 'Failed to retry email');
  }
});
