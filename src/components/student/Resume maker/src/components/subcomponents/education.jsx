import React, { useEffect, useState } from 'react';
import { FaGripVertical } from 'react-icons/fa';
import { useCache } from '../../cache/useCache';

export default function Education() {
  const [formVisible, setFormVisible] = useState(false);
  const [formData, setFormData] = useCache('Education', {
    entries: [
      { institution: 'College Name', degree: 'B.Tech CSE', period: '2021-2025', score: 'CGPA 8.5' }
    ]
  });

  useEffect(() => {
    const edit = localStorage.getItem('edit');
    if (edit === 'Education') setFormVisible(true);
  }, []);

  const handleChange = (idx, field, value) => {
    const entries = [...formData.entries];
    entries[idx] = { ...entries[idx], [field]: value };
    setFormData({ ...formData, entries });
  };

  const addEntry = () => setFormData({ ...formData, entries: [...formData.entries, { institution: '', degree: '', period: '', score: '' }] });
  const removeEntry = (idx) => setFormData({ ...formData, entries: formData.entries.filter((_, i) => i !== idx) });
  const handleSave = (e) => { e.preventDefault(); localStorage.setItem('edit', ''); setFormVisible(false); };

  return (
    <div className="bg-white shadow p-4 mb-4 rounded">
      {formVisible ? (
        <form onSubmit={handleSave} className="space-y-3">
          <h2 className="text-xl font-bold">Education</h2>
          {formData.entries.map((ed, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
              <input className="border rounded px-2 py-1" placeholder="Institution" value={ed.institution} onChange={(e)=>handleChange(idx,'institution',e.target.value)} />
              <input className="border rounded px-2 py-1" placeholder="Degree" value={ed.degree} onChange={(e)=>handleChange(idx,'degree',e.target.value)} />
              <input className="border rounded px-2 py-1" placeholder="Period" value={ed.period} onChange={(e)=>handleChange(idx,'period',e.target.value)} />
              <div className="flex gap-2">
                <input className="border rounded px-2 py-1 flex-1" placeholder="Score" value={ed.score} onChange={(e)=>handleChange(idx,'score',e.target.value)} />
                {formData.entries.length > 1 && (
                  <button type="button" className="text-red-500" onClick={()=>removeEntry(idx)}>Remove</button>
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="bg-green-500 text-white px-3 py-1 rounded" onClick={addEntry}>Add</button>
            <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded">Save</button>
          </div>
        </form>
      ) : (
        <div className="flex justify-between items-start">
          <div className="cursor-pointer"><FaGripVertical /></div>
          <div className="flex-grow ml-4">
            <h1 className="text-xl font-bold">Education</h1>
            {formData.entries.map((ed, idx) => (
              <div key={idx} className="mb-2">
                <div className="flex justify-between"><span className="font-semibold">{ed.institution} — {ed.degree}</span><span className="text-gray-600">{ed.period}</span></div>
                <div className="text-gray-700">{ed.score}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
