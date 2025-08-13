import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import LoadingSpinner from '../ui/LoadingSpinner';
import JobChat from './JobChat';

const MyDiscussions = () => {
  const [loading, setLoading] = useState(true);
  const [discussions, setDiscussions] = useState([]);
  const [activeJob, setActiveJob] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (!auth.currentUser) { setLoading(false); return; }
        // Find applications where user has joined chat
        const appsQ = query(
          collection(db, 'applications'),
          where('student_id', '==', auth.currentUser.uid),
          where('hasJoinedChat', '==', true)
        );
        const appsSnap = await getDocs(appsQ);
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

  if (loading) {
    return <div className="flex justify-center items-center min-h-[50vh]"><LoadingSpinner size="large" text="Loading discussions..." /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4">
      <h2 className="text-2xl font-semibold mb-4">My Discussions</h2>
      {discussions.length === 0 ? (
        <div className="text-gray-600">You haven't joined any discussions yet. Open a job and choose Discussion to join.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {discussions.map(job => (
            <div key={job.id} className="bg-white rounded-lg shadow p-4 border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-medium break-words">{job.position}</div>
                  <div className="text-sm text-gray-600 break-words">{job.company}</div>
                </div>
                <button
                  onClick={() => setActiveJob(job)}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Open Chat
                </button>
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



