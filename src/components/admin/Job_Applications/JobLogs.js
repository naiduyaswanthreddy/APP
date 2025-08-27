import React, { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../../firebase';

const JobLogs = ({ jobId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError('');
        const ref = collection(db, 'jobs', jobId, 'logs');
        const q = query(ref, orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setError('Failed to load logs');
      } finally {
        setLoading(false);
      }
    };
    if (jobId) fetchLogs();
  }, [jobId]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Activity Logs</h3>
        {loading && <span className="text-sm text-gray-500">Loading…</span>}
      </div>
      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
      {logs.length === 0 ? (
        <p className="text-gray-500">No activity logs found.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="max-h-56 overflow-y-auto rounded border border-gray-100">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2 text-sm text-gray-500">{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : ''}</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{log.action}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{log.actorEmail || log.actorId}</td>
                  <td className="px-4 py-2 text-xs text-gray-600 whitespace-pre-wrap">{JSON.stringify(log.details || {}, null, 2)}</td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobLogs;

