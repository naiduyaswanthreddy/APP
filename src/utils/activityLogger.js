import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const getActor = () => {
  const user = auth.currentUser;
  return {
    actorId: user?.uid || 'system',
    actorEmail: user?.email || null,
  };
};

export const logJobActivity = async (jobId, action, details = {}) => {
  try {
    const { actorId, actorEmail } = getActor();
    const payload = {
      entityType: 'job',
      entityId: jobId,
      action,
      actorId,
      actorEmail,
      details,
      timestamp: serverTimestamp(),
    };
    // Per-entity subcollection
    await addDoc(collection(db, 'jobs', jobId, 'logs'), payload);
    // Global activity stream (optional)
    await addDoc(collection(db, 'activity_logs'), payload);
  } catch (e) {
    // Do not throw; logging should be best-effort
    // eslint-disable-next-line no-console
    console.warn('logJobActivity failed', e);
  }
};

export const logEventActivity = async (eventId, action, details = {}) => {
  try {
    const { actorId, actorEmail } = getActor();
    const payload = {
      entityType: 'event',
      entityId: eventId,
      action,
      actorId,
      actorEmail,
      details,
      timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, 'events', eventId, 'logs'), payload);
    await addDoc(collection(db, 'activity_logs'), payload);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('logEventActivity failed', e);
  }
};

