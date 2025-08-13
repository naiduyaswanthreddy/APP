import React, { useEffect, useState } from 'react';
import { FaGripVertical } from 'react-icons/fa';
import { useCache } from '../../cache/useCache';

export default function Projects() {
  const [formVisible, setFormVisible] = useState(false);
  const [formData, setFormData] = useCache('Projects', {
    projects: [
      { name: 'Project Name', description: 'Brief description', techStack: 'React, Node.js' }
    ]
  });

  useEffect(() => {
    const edit = localStorage.getItem('edit');
    if (edit === 'Projects') setFormVisible(true);
  }, []);

  const handleChange = (idx, field, value) => {
    const projects = [...formData.projects];
    projects[idx] = { ...projects[idx], [field]: value };
    setFormData({ projects });
  };
  const add = () => setFormData({ projects: [...formData.projects, { name: '', description: '', techStack: '' }] });
  const remove = (idx) => setFormData({ projects: formData.projects.filter((_, i) => i !== idx) });
  const save = (e) => { e.preventDefault(); localStorage.setItem('edit',''); setFormVisible(false); };

  return (
    <div className="bg-white shadow p-4 mb-4 rounded">
      {formVisible ? (
        <form onSubmit={save} className="space-y-3">
          <h2 className="text-xl font-bold">Projects</h2>
          {formData.projects.map((p, idx) => (
            <div key={idx} className="space-y-2">
              <input className="border rounded px-2 py-1 w-full" placeholder="Project Name" value={p.name} onChange={(e)=>handleChange(idx,'name',e.target.value)} />
              <input className="border rounded px-2 py-1 w-full" placeholder="Tech Stack" value={p.techStack} onChange={(e)=>handleChange(idx,'techStack',e.target.value)} />
              <textarea className="border rounded px-2 py-1 w-full h-20" placeholder="Description" value={p.description} onChange={(e)=>handleChange(idx,'description',e.target.value)} />
              {formData.projects.length > 1 && (<button type="button" className="text-red-500" onClick={()=>remove(idx)}>Remove</button>)}
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
            <h1 className="text-xl font-bold">Projects</h1>
            {formData.projects.map((p, idx) => (
              <div key={idx} className="mb-3">
                <div className="font-semibold">{p.name}</div>
                <div className="text-gray-700">{p.description}</div>
                <div className="text-gray-600 text-sm">{p.techStack}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
