import React, { useEffect, useState } from 'react';
import { FaGripVertical } from 'react-icons/fa';
import { useCache } from '../../cache/useCache';

export default function Skills() {
  const [formVisible, setFormVisible] = useState(false);
  const [formData, setFormData] = useCache('Skills', { items: ['JavaScript', 'React'] });

  useEffect(() => {
    const edit = localStorage.getItem('edit');
    if (edit === 'Skills') setFormVisible(true);
  }, []);

  const addSkill = () => setFormData({ items: [...formData.items, ''] });
  const removeSkill = (idx) => setFormData({ items: formData.items.filter((_, i) => i !== idx) });
  const updateSkill = (idx, val) => setFormData({ items: formData.items.map((s, i) => (i === idx ? val : s)) });
  const handleSave = (e) => { e.preventDefault(); localStorage.setItem('edit', ''); setFormVisible(false); };

  return (
    <div className="bg-white shadow p-4 mb-4 rounded">
      {formVisible ? (
        <form onSubmit={handleSave} className="space-y-3">
          <h2 className="text-xl font-bold">Skills</h2>
          {formData.items.map((s, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input className="border rounded px-2 py-1 flex-1" value={s} onChange={(e)=>updateSkill(idx, e.target.value)} />
              {formData.items.length > 1 && (
                <button type="button" className="text-red-500" onClick={()=>removeSkill(idx)}>Remove</button>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="bg-green-500 text-white px-3 py-1 rounded" onClick={addSkill}>Add</button>
            <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded">Save</button>
          </div>
        </form>
      ) : (
        <div className="flex justify-between items-start">
          <div className="cursor-pointer"><FaGripVertical /></div>
          <div className="flex-grow ml-4">
            <h1 className="text-xl font-bold">Skills</h1>
            <p>{formData.items.join(', ')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
