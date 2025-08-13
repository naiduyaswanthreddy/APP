import React, { useEffect, useState } from 'react';
import { FaGripVertical } from 'react-icons/fa';
import { useCache } from '../../cache/useCache';

export default function Certifications() {
  const [formVisible, setFormVisible] = useState(false);
  const [formData, setFormData] = useCache('Certifications', { items: [{ name: 'Certificate Name', issuer: 'Issuer' }] });

  useEffect(() => {
    const edit = localStorage.getItem('edit');
    if (edit === 'Certifications') setFormVisible(true);
  }, []);

  const add = () => setFormData({ items: [...formData.items, { name: '', issuer: '' }] });
  const remove = (idx) => setFormData({ items: formData.items.filter((_, i) => i !== idx) });
  const change = (idx, field, value) => setFormData({ items: formData.items.map((it, i)=> i===idx ? { ...it, [field]: value } : it) });
  const save = (e) => { e.preventDefault(); localStorage.setItem('edit',''); setFormVisible(false); };

  return (
    <div className="bg-white shadow p-4 mb-4 rounded">
      {formVisible ? (
        <form onSubmit={save} className="space-y-3">
          <h2 className="text-xl font-bold">Certifications</h2>
          {formData.items.map((c, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
              <input className="border rounded px-2 py-1" placeholder="Certificate Name" value={c.name} onChange={(e)=>change(idx,'name',e.target.value)} />
              <div className="flex gap-2">
                <input className="border rounded px-2 py-1 flex-1" placeholder="Issuer" value={c.issuer} onChange={(e)=>change(idx,'issuer',e.target.value)} />
                {formData.items.length > 1 && (<button type="button" className="text-red-500" onClick={()=>remove(idx)}>Remove</button>)}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="bg-green-500 text-white px-3 py-1 rounded" onClick={add}>Add</button>
            <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded">Save</button>
          </div>
        </form>
      ) : (
        <div className="flex justify-between items-start">
          <div className="cursor-pointer"><FaGripVertical /></div>
          <div className="flex-grow ml-4">
            <h1 className="text-xl font-bold">Certifications</h1>
            {formData.items.map((c, idx) => (
              <div key={idx} className="mb-2">
                <span className="font-semibold">{c.name}</span>
                <span className="text-gray-600"> — {c.issuer}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
