import { auth, db } from '../firebase';
import { doc, getDoc, query, where, collection, getDocs, updateDoc } from 'firebase/firestore';

// Single source of truth for roll number format
export const ROLL_NUMBER_REGEX = /^[A-Z0-9]{6,15}$/;

export const isValidRollNumber = (rollNumber) => {
  try {
    return typeof rollNumber === 'string' && ROLL_NUMBER_REGEX.test(rollNumber.trim().toUpperCase());
  } catch (_e) {
    return false;
  }
};

// Get current logged-in student's roll number, caching in localStorage
export const getCurrentStudentRollNumber = async () => {
  try {
    const cached = localStorage.getItem('rollNumber');
    if (cached && isValidRollNumber(cached)) return cached;

    const user = auth.currentUser;
    if (!user) return null;
    const snap = await getDoc(doc(db, 'students', user.uid));
    if (snap.exists()) {
      const roll = snap.data()?.rollNumber || null;
      if (roll && isValidRollNumber(roll)) {
        localStorage.setItem('rollNumber', roll);
        return roll;
      }
      console.warn('Student record missing rollNumber. Falling back to uid in queries temporarily.');
      return null;
    }
    return null;
  } catch (e) {
    console.warn('Failed to resolve rollNumber for current user:', e);
    return null;
  }
};

// Fetch student document by roll number
export const getStudentByRollNumber = async (rollNumber) => {
  const q = query(collection(db, 'students'), where('rollNumber', '==', rollNumber));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

// Update student document by roll number
export const updateStudentByRollNumber = async (rollNumber, data) => {
  const q = query(collection(db, 'students'), where('rollNumber', '==', rollNumber));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Student not found for given rollNumber');
  const ref = doc(db, 'students', snap.docs[0].id);
  await updateDoc(ref, data);
  return true;
};

// Get roll number from a student's auth UID
export const getRollNumberByUid = async (uid) => {
  try {
    const snap = await getDoc(doc(db, 'students', uid));
    if (snap.exists()) {
      const roll = snap.data()?.rollNumber || null;
      return roll && isValidRollNumber(roll) ? roll : null;
    }
    return null;
  } catch (_e) {
    return null;
  }
};


