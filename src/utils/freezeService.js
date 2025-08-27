/**
 * Freeze service utilities for student freeze/unfreeze operations
 */
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  serverTimestamp,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { createBatchOperation, runBatchesWithRetry } from './firestoreBatch';
import { createNotification } from './notificationHelpers';

/**
 * Resolve students by roll numbers
 * @param {string[]} rollNumbers - Array of roll numbers
 * @returns {Promise<Object>} - Object with found, missing, and duplicate students
 */
export const resolveStudentsByRoll = async (rollNumbers) => {
  if (!Array.isArray(rollNumbers) || rollNumbers.length === 0) {
    return { found: [], missing: [], duplicates: [] };
  }

  const found = [];
  const missing = [];
  const duplicates = [];
  const processedRolls = new Set();

  // Process in chunks of 10 due to Firestore 'in' query limit
  const chunks = [];
  for (let i = 0; i < rollNumbers.length; i += 10) {
    chunks.push(rollNumbers.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    try {
      const studentsRef = collection(db, 'students');
      const q = query(studentsRef, where('rollNumber', 'in', chunk));
      const snapshot = await getDocs(q);

      const chunkFound = [];
      snapshot.docs.forEach(docSnap => {
        const studentData = docSnap.data();
        const rollNumber = studentData.rollNumber;

        if (processedRolls.has(rollNumber)) {
          duplicates.push({
            rollNumber,
            id: docSnap.id,
            name: studentData.name || 'Unknown',
            email: studentData.email || 'N/A',
            department: studentData.department || 'N/A',
            batch: studentData.batch || 'N/A',
            currentFreeze: studentData.freezed || null
          });
        } else {
          processedRolls.add(rollNumber);
          chunkFound.push({
            rollNumber,
            id: docSnap.id,
            name: studentData.name || 'Unknown',
            email: studentData.email || 'N/A',
            department: studentData.department || 'N/A',
            batch: studentData.batch || 'N/A',
            currentFreeze: studentData.freezed || null
          });
        }
      });

      found.push(...chunkFound);

      // Find missing roll numbers in this chunk
      const foundRolls = chunkFound.map(s => s.rollNumber);
      const chunkMissing = chunk.filter(roll => !foundRolls.includes(roll));
      missing.push(...chunkMissing.map(roll => ({ rollNumber: roll })));

    } catch (error) {
      console.error('Error resolving students by roll:', error);
      // Add all chunk rolls as missing if query fails
      missing.push(...chunk.map(roll => ({ rollNumber: roll, error: error.message })));
    }
  }

  return { found, missing, duplicates };
};

/**
 * Create freeze object
 * @param {Object} payload - Freeze payload
 * @param {string} adminUid - Admin UID
 * @param {string} adminName - Admin name
 * @param {string} rollNumber - Student roll number
 * @returns {Object} - Freeze object
 */
export const createFreezeObject = (payload, adminUid, adminName, rollNumber) => {
  const now = serverTimestamp();
  
  return {
    active: true,
    reason: payload.reason,
    category: payload.category || 'other',
    notes: payload.notes || '',
    by: adminUid,
    byName: adminName,
    from: payload.from || now,
    until: payload.until || null,
    rollNumber,
    createdAt: now,
    updatedAt: now
  };
};

/**
 * Create freeze history entry
 * @param {string} action - 'freeze' or 'unfreeze'
 * @param {Object} payload - Action payload
 * @param {string} adminUid - Admin UID
 * @param {string} adminName - Admin name
 * @param {string} rollNumber - Student roll number
 * @returns {Object} - History entry
 */
export const createFreezeHistoryEntry = (action, payload, adminUid, adminName, rollNumber) => {
  return {
    action,
    reason: payload.reason,
    category: payload.category || 'other',
    notes: payload.notes || '',
    by: adminUid,
    byName: adminName,
    // Firestore does not allow serverTimestamp() within arrays; use client timestamp instead
    at: Timestamp.now(),
    until: payload.until || null,
    rollNumber
  };
};

/**
 * Freeze students in bulk
 * @param {Array} students - Array of student objects
 * @param {Object} payload - Freeze payload
 * @param {Object} notifyOpts - Notification options
 * @returns {Promise<Object>} - Operation results
 */
export const freezeStudents = async (students, payload, notifyOpts = {}) => {
  if (!Array.isArray(students) || students.length === 0) {
    return { successful: 0, failed: 0, results: [] };
  }

  const user = auth.currentUser;
  if (!user) {
    throw new Error('Admin not authenticated');
  }

  // Get admin details (try multiple sources with sensible fallbacks)
  let adminName = user.displayName || '';
  try {
    const userDocSnap = await getDoc(doc(db, 'users', user.uid));
    const adminDocSnap = await getDoc(doc(db, 'admins', user.uid));
    const userColData = userDocSnap.exists() ? (userDocSnap.data() || {}) : {};
    const adminsColData = adminDocSnap.exists() ? (adminDocSnap.data() || {}) : {};
    adminName = adminName 
      || userColData.name 
      || userColData.displayName 
      || adminsColData.name 
      || adminsColData.displayName 
      || user.email 
      || 'Admin';
  } catch (e) {
    console.warn('Failed to resolve admin name from Firestore, falling back to auth/displayName/email:', e);
    adminName = adminName || user.email || 'Admin';
  }

  const operations = [];
  const results = [];

  students.forEach(student => {
    try {
      // Skip if already frozen (unless updating)
      if (student.currentFreeze?.active && !payload.updateExisting) {
        results.push({
          rollNumber: student.rollNumber,
          status: 'skipped',
          message: 'Already frozen'
        });
        return;
      }

      const freezeObject = createFreezeObject(payload, user.uid, adminName, student.rollNumber);
      const historyEntry = createFreezeHistoryEntry('freeze', payload, user.uid, adminName, student.rollNumber);

      // Update student document
      const studentUpdateData = {
        freezed: freezeObject,
        updatedAt: serverTimestamp()
      };

      // Add to freeze history (append to array)
      const currentHistory = student.currentFreeze?.freezeHistory || [];
      studentUpdateData.freezeHistory = [...currentHistory, historyEntry];

      operations.push(createBatchOperation('update', 'students', student.id, studentUpdateData));

      // Create audit log
      const logData = {
        studentId: student.id,
        rollNumber: student.rollNumber,
        batch: student.batch,
        department: student.department,
        ...historyEntry
      };
      
      operations.push(createBatchOperation('set', 'student_freeze_logs', `${student.id}_${Date.now()}`, logData));

      results.push({
        rollNumber: student.rollNumber,
        status: 'pending',
        message: 'Queued for freeze'
      });

    } catch (error) {
      console.error(`Error preparing freeze for ${student.rollNumber}:`, error);
      results.push({
        rollNumber: student.rollNumber,
        status: 'error',
        message: error.message
      });
    }
  });

  // Execute batch operations
  console.log('Executing freeze batch operations:', operations.length);
  const batchResults = await runBatchesWithRetry(operations, 3, 400);
  console.log('Freeze batch results:', batchResults);

  // Update results based on batch execution
  let successCount = 0;
  let failCount = 0;

  // Check if batch operations were successful
  const batchSuccess = batchResults.successful > 0 && batchResults.failed === 0;
  console.log('Freeze batch success:', batchSuccess, 'Successful ops:', batchResults.successful, 'Failed ops:', batchResults.failed);
  
  results.forEach(result => {
    if (result.status === 'pending') {
      if (batchSuccess) {
        result.status = 'success';
        result.message = 'Student frozen successfully';
        successCount++;
      } else {
        result.status = 'error';
        result.message = 'Failed to freeze student';
        failCount++;
      }
    } else if (result.status === 'error') {
      failCount++;
    }
  });

  // Handle notifications if enabled
  if (notifyOpts.push || notifyOpts.email) {
    await sendFreezeNotifications(students.filter(s => 
      results.find(r => r.rollNumber === s.rollNumber && r.status === 'success')
    ), payload, notifyOpts);
  }

  return {
    successful: successCount,
    failed: failCount,
    results,
    batchResults
  };
};

/**
 * Unfreeze students in bulk
 * @param {Array} students - Array of student objects
 * @param {Object} payload - Unfreeze payload
 * @param {Object} notifyOpts - Notification options
 * @returns {Promise<Object>} - Operation results
 */
export const unfreezeStudents = async (students, payload, notifyOpts = {}) => {
  if (!Array.isArray(students) || students.length === 0) {
    return { successful: 0, failed: 0, results: [] };
  }

  const user = auth.currentUser;
  if (!user) {
    throw new Error('Admin not authenticated');
  }

  // Get admin details (try multiple sources with sensible fallbacks)
  let adminName = user.displayName || '';
  try {
    const userDocSnap = await getDoc(doc(db, 'users', user.uid));
    const adminDocSnap = await getDoc(doc(db, 'admins', user.uid));
    const userColData = userDocSnap.exists() ? (userDocSnap.data() || {}) : {};
    const adminsColData = adminDocSnap.exists() ? (adminDocSnap.data() || {}) : {};
    adminName = adminName 
      || userColData.name 
      || userColData.displayName 
      || adminsColData.name 
      || adminsColData.displayName 
      || user.email 
      || 'Admin';
  } catch (e) {
    console.warn('Failed to resolve admin name from Firestore, falling back to auth/displayName/email:', e);
    adminName = adminName || user.email || 'Admin';
  }

  const operations = [];
  const results = [];

  students.forEach(student => {
    try {
      // Skip if not frozen
      if (!student.currentFreeze?.active) {
        results.push({
          rollNumber: student.rollNumber,
          status: 'skipped',
          message: 'Not frozen'
        });
        return;
      }

      const historyEntry = createFreezeHistoryEntry('unfreeze', payload, user.uid, adminName, student.rollNumber);

      // Update student document - set freezed to null
      const studentUpdateData = {
        freezed: null,
        updatedAt: serverTimestamp()
      };

      // Add to freeze history
      const currentHistory = student.currentFreeze?.freezeHistory || [];
      studentUpdateData.freezeHistory = [...currentHistory, historyEntry];

      operations.push(createBatchOperation('update', 'students', student.id, studentUpdateData));

      // Create audit log
      const logData = {
        studentId: student.id,
        rollNumber: student.rollNumber,
        batch: student.batch,
        department: student.department,
        ...historyEntry
      };
      
      operations.push(createBatchOperation('set', 'student_freeze_logs', `${student.id}_${Date.now()}`, logData));

      results.push({
        rollNumber: student.rollNumber,
        status: 'pending',
        message: 'Queued for unfreeze'
      });

    } catch (error) {
      console.error(`Error preparing unfreeze for ${student.rollNumber}:`, error);
      results.push({
        rollNumber: student.rollNumber,
        status: 'error',
        message: error.message
      });
    }
  });

  // Execute batch operations
  console.log('Executing unfreeze batch operations:', operations.length);
  const batchResults = await runBatchesWithRetry(operations, 3, 400);
  console.log('Unfreeze batch results:', batchResults);

  // Update results based on batch execution
  let successCount = 0;
  let failCount = 0;

  // Check if batch operations were successful
  const batchSuccess = batchResults.successful > 0 && batchResults.failed === 0;
  console.log('Unfreeze batch success:', batchSuccess, 'Successful ops:', batchResults.successful, 'Failed ops:', batchResults.failed);
  
  results.forEach(result => {
    if (result.status === 'pending') {
      if (batchSuccess) {
        result.status = 'success';
        result.message = 'Student unfrozen successfully';
        successCount++;
      } else {
        result.status = 'error';
        result.message = 'Failed to unfreeze student';
        failCount++;
      }
    } else if (result.status === 'error') {
      failCount++;
    }
  });

  // Handle notifications if enabled
  if (notifyOpts.push || notifyOpts.email) {
    await sendUnfreezeNotifications(students.filter(s => 
      results.find(r => r.rollNumber === s.rollNumber && r.status === 'success')
    ), payload, notifyOpts);
  }

  return {
    successful: successCount,
    failed: failCount,
    results,
    batchResults
  };
};

/**
 * Send freeze notifications
 * @param {Array} students - Array of students to notify
 * @param {Object} payload - Freeze payload
 * @param {Object} notifyOpts - Notification options
 */
export const sendFreezeNotifications = async (students, payload, notifyOpts) => {
  for (const student of students) {
    try {
      if (notifyOpts.push) {
        await createNotification(student.id, {
          title: 'Account Frozen',
          message: `Your placement account has been frozen. Reason: ${payload.reason}`,
          type: 'freeze',
          data: {
            reason: payload.reason,
            category: payload.category,
            until: payload.until
          }
        });
      }

      // Email notifications would be handled here
      // Implementation depends on your email service setup
      
    } catch (error) {
      console.error(`Failed to send notification to ${student.rollNumber}:`, error);
    }
  }
};

/**
 * Send unfreeze notifications
 * @param {Array} students - Array of students to notify
 * @param {Object} payload - Unfreeze payload
 * @param {Object} notifyOpts - Notification options
 */
export const sendUnfreezeNotifications = async (students, payload, notifyOpts) => {
  for (const student of students) {
    try {
      if (notifyOpts.push) {
        await createNotification(student.id, {
          title: 'Account Unfrozen',
          message: `Your placement account has been unfrozen. You can now apply for jobs.`,
          type: 'unfreeze',
          data: {
            reason: payload.reason
          }
        });
      }

      // Email notifications would be handled here
      
    } catch (error) {
      console.error(`Failed to send notification to ${student.rollNumber}:`, error);
    }
  }
};

/**
 * Check if student is frozen
 * @param {string} studentId - Student ID
 * @returns {Promise<Object|null>} - Freeze status or null if not frozen
 */
export const checkStudentFreezeStatus = async (studentId) => {
  try {
    const studentDoc = await getDoc(doc(db, 'students', studentId));
    const studentData = studentDoc.data();
    
    if (!studentData?.freezed?.active) {
      return null;
    }

    return studentData.freezed;
  } catch (error) {
    console.error('Error checking freeze status:', error);
    return null;
  }
};
