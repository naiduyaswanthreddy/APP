import React, { useEffect, useRef, useState } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import LoadingSpinner from '../ui/LoadingSpinner';
import JobChat from './JobChat';

const MyDiscussions = () => {
  const [loading, setLoading] = useState(true);
  const [discussions, setDiscussions] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [appMetaByJob, setAppMetaByJob] = useState({}); // jobId -> { appId, lastChatActivity }
  const listenersRef = useRef({});

  useEffect(() => {
    const load = async () => {
      try {
        if (!auth.currentUser) { setLoading(false); return; }
        // Find applications where user has joined chat (robust across historical data)
        const appsCol = collection(db, 'applications');
        const candidates = [
          query(appsCol, where('student_id', '==', auth.currentUser.uid), where('hasJoinedChat', '==', true)),
          query(appsCol, where('studentId', '==', auth.currentUser.uid), where('hasJoinedChat', '==', true)),
        ];
        let appsSnap = null;
        for (const q of candidates) {
          const s = await getDocs(q);
          if (!s.empty) { appsSnap = s; break; }
        }
        if (!appsSnap) { setDiscussions([]); setLoading(false); return; }
        // Build application metadata map for unread calculations and updates
        const appMeta = {};
        appsSnap.docs.forEach(d => {
          const data = d.data();
          if (data.jobId) {
            appMeta[data.jobId] = { appId: d.id, lastChatActivity: data.lastChatActivity || null };
          }
        });
        setAppMetaByJob(appMeta);
        const jobIds = [...new Set(appsSnap.docs.map(d => d.data().jobId))];
        if (jobIds.length === 0) { setDiscussions([]); setLoading(false); return; }
        // Fetch jobs; Firestore doesn't support 'in' on doc.id in this client list easily, fetch and filter
        const jobsSnap = await getDocs(collection(db, 'jobs'));
        const jobs = jobsSnap.docs
          .filter(d => jobIds.includes(d.id))
          .map(d => ({ id: d.id, ...d.data() }));
        setDiscussions(jobs);
      } catch (e) {
        console.error('Failed to load discussions:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Attach listeners to compute unread message counts per job
  useEffect(() => {
    // Clean up previous listeners
    Object.values(listenersRef.current).forEach(unsub => { try { if (typeof unsub === 'function') unsub(); } catch (_) {} });
    listenersRef.current = {};

    if (!auth.currentUser || discussions.length === 0) return;
    const currentUserId = auth.currentUser.uid;

    const toMillis = (ts) => {
      try { return ts?.toMillis ? ts.toMillis() : (ts?.seconds ? ts.seconds * 1000 : null); } catch { return null; }
    };

    discussions.forEach(job => {
      const unsub = onSnapshot(
        query(collection(db, 'jobChats'), where('jobId', '==', job.id), orderBy('timestamp', 'asc')),
        (snapshot) => {
          let count = 0;
          const baselineTs = appMetaByJob[job.id]?.lastChatActivity || null;
          const baselineMs = toMillis(baselineTs);
          snapshot.forEach(docSnap => {
            const msg = docSnap.data();
            const msgMs = toMillis(msg.timestamp);
            const isNew = baselineMs == null ? true : (msgMs != null && msgMs > baselineMs);
            if (isNew && msg.senderId !== currentUserId) {
              count += 1;
            }
          });
          setUnreadCounts(prev => ({ ...prev, [job.id]: count }));
        }
      );
      listenersRef.current[job.id] = unsub;
    });

    return () => {
      Object.values(listenersRef.current).forEach(unsub => { try { if (typeof unsub === 'function') unsub(); } catch (_) {} });
      listenersRef.current = {};
    };
  }, [discussions, appMetaByJob]);

  const openChat = async (job) => {
    try {
      const meta = appMetaByJob[job.id];
      if (meta?.appId) {
        await updateDoc(doc(db, 'applications', meta.appId), { lastChatActivity: serverTimestamp() });
        // Optimistically zero out unread count
        setUnreadCounts(prev => ({ ...prev, [job.id]: 0 }));
        setAppMetaByJob(prev => ({ ...prev, [job.id]: { ...prev[job.id], lastChatActivity: new Date() } }));
      }
    } catch (e) {
      // ignore failures; UI will refresh on next snapshot
    }
    setActiveJob(job);
  };

  const removeDiscussion = async (job) => {
    try {
      const meta = appMetaByJob[job.id];
      if (meta?.appId) {
        await updateDoc(doc(db, 'applications', meta.appId), { hasJoinedChat: false });
      }
    } catch (e) {
      console.error('Failed to remove discussion:', e);
    }
    // Update UI
    setDiscussions(prev => prev.filter(j => j.id !== job.id));
    setUnreadCounts(prev => { const next = { ...prev }; delete next[job.id]; return next; });
    // Cleanup listener
    const unsub = listenersRef.current[job.id];
    if (typeof unsub === 'function') unsub();
    delete listenersRef.current[job.id];
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-[50vh]"><LoadingSpinner size="large" text="Loading discussions..." /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-0 py-0">
      <h2 className="text-2xl font-semibold mb-4">My Discussions</h2>
      {discussions.length === 0 ? (
        <div className="text-gray-600">You haven't joined any discussions yet. Open a job and choose Discussion to join.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {discussions.map(job => (
            <div key={job.id} className="bg-white rounded-lg shadow p-4 border relative">
              {unreadCounts[job.id] > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded-full shadow">{unreadCounts[job.id]}</span>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-medium break-words">{job.position}</div>
                  <div className="text-sm text-gray-600 break-words">{job.company}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openChat(job)}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Open Chat
                  </button>
                  <button
                    onClick={() => removeDiscussion(job)}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    title="Remove from My Discussions"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeJob && (
        <JobChat selectedJob={activeJob} onClose={() => setActiveJob(null)} />
      )}
    </div>
  );
};

export default MyDiscussions;



