/**
 * Custom hook to check student freeze status
 */
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

export const useFreezeStatus = () => {
  const [freezeStatus, setFreezeStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = null;

    const setupListener = () => {
      const user = auth.currentUser;
      if (!user) {
        setFreezeStatus(null);
        setLoading(false);
        return;
      }

      const studentRef = doc(db, 'students', user.uid);
      unsubscribe = onSnapshot(studentRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFreezeStatus(data.freezed || null);
        } else {
          setFreezeStatus(null);
        }
        setLoading(false);
      }, (error) => {
        console.error('Error listening to freeze status:', error);
        setFreezeStatus(null);
        setLoading(false);
      });
    };

    // Setup listener if user is already authenticated
    if (auth.currentUser) {
      setupListener();
    } else {
      // Listen for auth state changes
      const authUnsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
          setupListener();
        } else {
          setFreezeStatus(null);
          setLoading(false);
        }
      });

      return () => {
        authUnsubscribe();
        if (unsubscribe) unsubscribe();
      };
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const isFrozen = freezeStatus?.active === true;

  return {
    freezeStatus,
    isFrozen,
    loading
  };
};
