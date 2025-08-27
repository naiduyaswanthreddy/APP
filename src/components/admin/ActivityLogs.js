import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query, where, limit, startAfter } from 'firebase/firestore';
import { db } from '../../firebase';

const PAGE_SIZE = 50;

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ entityType: '', entityId: '', action: '', actor: '' });
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const buildQuery = useMemo(() => {
    const base = collection(db, 'activity_logs');
    const clauses = [];
    if (filters.entityType) clauses.push(where('entityType', '==', filters.entityType));
    if (filters.action) clauses.push(where('action', '==', filters.action));
    // entityId and actor filters are client-side due to partial matches
    return query(base, ...clauses, orderBy('timestamp', 'desc'), limit(PAGE_SIZE));
  }, [filters.entityType, filters.action]);

  const applyClientFilters = (rows) => {
    return rows.filter((r) => {
      if (filters.entityId && !(r.entityId || '').toLowerCase().includes(filters.entityId.toLowerCase())) return false;
      const actor = (r.actorEmail || r.actorId || '').toLowerCase();
      if (filters.actor && !actor.includes(filters.actor.toLowerCase())) return false;
      return true;
    });
  };

  const load = async (append = false) => {
    try {
      setLoading(true);
      setError('');
      let q = buildQuery;
      if (append && lastDoc) {
        q = query(collection(db, 'activity_logs'), ...(buildQuery._queryOptions?.fieldFilters || []), orderBy('timestamp', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
      }
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, _ref: d, ...d.data() }));
      const filtered = applyClientFilters(rows);
      if (append) setLogs((prev) => [...prev, ...filtered]);
      else setLogs(filtered);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) {
      setError('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [buildQuery]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Activity Logs</h1>
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="border rounded px-2 py-1" placeholder="Entity Type (job|event)" value={filters.entityType} onChange={(e)=>setFilters({...filters, entityType:e.target.value})} />
          <input className="border rounded px-2 py-1" placeholder="Entity ID contains" value={filters.entityId} onChange={(e)=>setFilters({...filters, entityId:e.target.value})} />
          <input className="border rounded px-2 py-1" placeholder="Action (create|update|delete)" value={filters.action} onChange={(e)=>setFilters({...filters, action:e.target.value})} />
          <input className="border rounded px-2 py-1" placeholder="Actor contains (email/uid)" value={filters.actor} onChange={(e)=>setFilters({...filters, actor:e.target.value})} />
        </div>
        <div className="mt-3 flex gap-2">
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={()=>load(false)} disabled={loading}>Apply</button>
          <button className="px-3 py-1 bg-gray-200 rounded" onClick={()=>{setFilters({ entityType:'', entityId:'', action:'', actor:''});}} disabled={loading}>Reset</button>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <div className="overflow-x-auto">
          <div className="max-h-56 overflow-y-auto rounded border border-gray-100">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2 text-sm text-gray-500">{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : ''}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{log.entityType} • {log.entityId}</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{log.action}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{log.actorEmail || log.actorId}</td>
                  <td className="px-4 py-2 text-xs text-gray-600 whitespace-pre-wrap">{JSON.stringify(log.details || {}, null, 2)}</td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-between items-center">
            <button className="px-3 py-1 bg-gray-200 rounded" onClick={()=>load(false)} disabled={loading}>Refresh</button>
            {hasMore && (
              <button className="px-3 py-1 bg-gray-200 rounded" onClick={()=>load(true)} disabled={loading}>Load More</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogs;

