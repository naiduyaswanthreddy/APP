/**
 * Cloud Function for secure job application with freeze status checking
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.applyToJob = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { jobId, screeningAnswers = {}, applicationData = {} } = data;
  const studentId = context.auth.uid;

  if (!jobId) {
    throw new functions.https.HttpsError('invalid-argument', 'Job ID is required');
  }

  try {
    // Check if student is frozen
    const studentDoc = await db.collection('students').doc(studentId).get();
    
    if (!studentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Student profile not found');
    }

    const studentData = studentDoc.data();
    
    if (studentData.freezed?.active) {
      throw new functions.https.HttpsError(
        'permission-denied', 
        `Your account is frozen. Reason: ${studentData.freezed.reason}. Contact the Placement Team for assistance.`
      );
    }

    // Get job details
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    
    if (!jobDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Job not found');
    }

    const jobData = jobDoc.data();

    // Check if job is still active and accepting applications
    if (jobData.status !== 'active') {
      throw new functions.https.HttpsError('failed-precondition', 'Job is no longer accepting applications');
    }

    // Check deadline
    if (jobData.deadline && new Date(jobData.deadline.toDate()) < new Date()) {
      throw new functions.https.HttpsError('failed-precondition', 'Application deadline has passed');
    }

    // Use transaction to prevent duplicate applications
    const applicationId = `${jobId}_${studentData.rollNumber || studentId}`;
    
    const result = await db.runTransaction(async (transaction) => {
      const applicationRef = db.collection('applications').doc(applicationId);
      const existingApp = await transaction.get(applicationRef);

      if (existingApp.exists) {
        throw new functions.https.HttpsError('already-exists', 'You have already applied for this job');
      }

      // Determine first round name to initialize per-round status
      const firstRoundName = Array.isArray(jobData.rounds) && jobData.rounds.length > 0
        ? (jobData.rounds[0]?.name || jobData.rounds[0]?.roundName || `Round 1`)
        : null;

      // Create application document
      const applicationDoc = {
        jobId,
        student_id: studentId,
        student_rollNumber: studentData.rollNumber || null,
        status: 'pending',
        reachedRound: 0,
        appliedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        screening_answers: screeningAnswers,
        // Initialize embedded student structure for round tracking consistency
        student: {
          id: studentId,
          rounds: firstRoundName ? { [firstRoundName]: 'pending' } : {}
        },
        job: {
          position: jobData.position,
          company: jobData.company,
          location: jobData.location,
          ctc: jobData.ctc || '',
          salary: jobData.salary || '',
          jobTypes: jobData.jobTypes || '',
          workMode: jobData.workMode || ''
        },
        ...applicationData
      };

      transaction.set(applicationRef, applicationDoc);

      return { applicationId, success: true };
    });

    // Create notification for student
    try {
      await db.collection('notifications').add({
        userId: studentId,
        title: 'Application Submitted',
        message: `Your application for ${jobData.position} at ${jobData.company} has been submitted successfully.`,
        type: 'application_status',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: {
          jobId,
          applicationId: result.applicationId,
          status: 'pending'
        }
      });
    } catch (notificationError) {
      console.error('Failed to create notification:', notificationError);
      // Don't fail the application if notification fails
    }

    return {
      success: true,
      applicationId: result.applicationId,
      message: 'Application submitted successfully'
    };

  } catch (error) {
    console.error('Error in applyToJob:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to submit application');
  }
});

// Callable function for bulk freeze operations (admin only)
exports.bulkFreezeStudents = functions.https.onCall(async (data, context) => {
  // Verify authentication and admin role
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin (you may need to adjust this based on your auth setup)
  const adminDoc = await db.collection('users').doc(context.auth.uid).get();
  const adminData = adminDoc.data();
  
  if (!adminData || adminData.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can perform bulk operations');
  }

  const { studentIds, action, payload } = data;

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Student IDs array is required');
  }

  if (!action || !['freeze', 'unfreeze'].includes(action)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid action (freeze/unfreeze) is required');
  }

  if (action === 'freeze' && !payload?.reason) {
    throw new functions.https.HttpsError('invalid-argument', 'Reason is required for freeze action');
  }

  try {
    const batch = db.batch();
    const results = [];
    const adminName = adminData.name || adminData.displayName || 'Unknown Admin';

    for (const studentId of studentIds) {
      try {
        const studentRef = db.collection('students').doc(studentId);
        const studentDoc = await studentRef.get();

        if (!studentDoc.exists) {
          results.push({ studentId, status: 'error', message: 'Student not found' });
          continue;
        }

        const studentData = studentDoc.data();
        const historyEntry = {
          action,
          reason: payload.reason,
          category: payload.category || 'other',
          notes: payload.notes || '',
          by: context.auth.uid,
          byName: adminName,
          at: admin.firestore.FieldValue.serverTimestamp(),
          until: payload.until || null,
          rollNumber: studentData.rollNumber
        };

        let updateData;
        if (action === 'freeze') {
          updateData = {
            freezed: {
              active: true,
              reason: payload.reason,
              category: payload.category || 'other',
              notes: payload.notes || '',
              by: context.auth.uid,
              byName: adminName,
              from: payload.from || admin.firestore.FieldValue.serverTimestamp(),
              until: payload.until || null,
              rollNumber: studentData.rollNumber,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            freezeHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
        } else {
          updateData = {
            freezed: null,
            freezeHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
        }

        batch.update(studentRef, updateData);

        // Create audit log
        const logRef = db.collection('student_freeze_logs').doc();
        batch.set(logRef, {
          studentId,
          rollNumber: studentData.rollNumber,
          batch: studentData.batch,
          department: studentData.department,
          ...historyEntry
        });

        results.push({ studentId, status: 'success', message: `Student ${action}d successfully` });

      } catch (error) {
        console.error(`Error processing student ${studentId}:`, error);
        results.push({ studentId, status: 'error', message: error.message });
      }
    }

    await batch.commit();

    return {
      success: true,
      results,
      summary: {
        total: studentIds.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length
      }
    };

  } catch (error) {
    console.error('Error in bulkFreezeStudents:', error);
    throw new functions.https.HttpsError('internal', 'Failed to perform bulk operation');
  }
});

// Scheduled function to auto-unfreeze students
exports.autoUnfreezeStudents = functions.pubsub.schedule('every 10 minutes').onRun(async (context) => {
  try {
    const now = admin.firestore.Timestamp.now();
    
    // Query students with active freeze and until date in the past
    const frozenStudentsQuery = await db.collection('students')
      .where('freezed.active', '==', true)
      .where('freezed.until', '<=', now)
      .get();

    if (frozenStudentsQuery.empty) {
      console.log('No students to auto-unfreeze');
      return;
    }

    const batch = db.batch();
    let unfrozenCount = 0;

    frozenStudentsQuery.docs.forEach(doc => {
      const studentData = doc.data();
      
      // Skip if until is null (permanent freeze)
      if (!studentData.freezed.until) {
        return;
      }

      const historyEntry = {
        action: 'unfreeze',
        reason: 'Automatic unfreeze - scheduled expiry',
        category: 'system',
        notes: 'Automatically unfrozen due to expiry time',
        by: 'system',
        byName: 'System',
        at: admin.firestore.FieldValue.serverTimestamp(),
        until: null,
        rollNumber: studentData.rollNumber
      };

      const updateData = {
        freezed: null,
        freezeHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      batch.update(doc.ref, updateData);

      // Create audit log
      const logRef = db.collection('student_freeze_logs').doc();
      batch.set(logRef, {
        studentId: doc.id,
        rollNumber: studentData.rollNumber,
        batch: studentData.batch,
        department: studentData.department,
        ...historyEntry
      });

      unfrozenCount++;
    });

    if (unfrozenCount > 0) {
      await batch.commit();
      console.log(`Auto-unfroze ${unfrozenCount} students`);
    }

    return { unfrozenCount };

  } catch (error) {
    console.error('Error in autoUnfreezeStudents:', error);
    throw error;
  }
});
