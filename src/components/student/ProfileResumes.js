import React, { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { Check, FileText, Eye, Trash2, PlusCircle } from "lucide-react";

const ProfileResumes = () => {
  const [resumes, setResumes] = useState([]);
  const [showResumeForm, setShowResumeForm] = useState(false);
  const [newResume, setNewResume] = useState({ name: "", link: "" });

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const studentRef = doc(db, "students", user.uid);
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) {
        const data = studentSnap.data();
        setResumes(data.resumes || []);
      }
    };
    load();
  }, []);

  const handleAddResume = async () => {
    if (newResume.name && newResume.link) {
      const resumeToAdd = {
        id: Date.now(),
        name: newResume.name,
        link: newResume.link,
        isPrimary: resumes.length === 0,
        feedback: ""
      };
      const updatedResumes = [...resumes, resumeToAdd];
      setResumes(updatedResumes);

      const user = auth.currentUser;
      if (user) {
        try {
          const studentRef = doc(db, "students", user.uid);
          await updateDoc(studentRef, { resumes: updatedResumes });
          toast.success("Resume added successfully!");
          setNewResume({ name: "", link: "" });
          setShowResumeForm(false);
        } catch (error) {
          console.error("Error saving resume:", error);
          toast.error("Failed to save resume. Please try again.");
        }
      }
    } else {
      toast.error("Please fill in all fields");
    }
  };

  const handleSetPrimaryResume = async (id) => {
    const updatedResumes = resumes.map(resume => ({
      ...resume,
      isPrimary: resume.id === id
    }));
    setResumes(updatedResumes);

    const user = auth.currentUser;
    if (user) {
      try {
        const studentRef = doc(db, "students", user.uid);
        await updateDoc(studentRef, { resumes: updatedResumes });
        toast.success("Primary resume updated!");
      } catch (error) {
        console.error("Error updating resumes:", error);
        toast.error("Failed to update primary resume.");
      }
    }
  };

  const handleDeleteResume = async (id) => {
    if (window.confirm("Are you sure you want to delete this resume?")) {
      const updatedResumes = resumes.filter(resume => resume.id !== id);
      if (resumes.find(r => r.id === id)?.isPrimary && updatedResumes.length > 0) {
        updatedResumes[0].isPrimary = true;
      }
      setResumes(updatedResumes);

      const user = auth.currentUser;
      if (user) {
        try {
          const studentRef = doc(db, "students", user.uid);
          await updateDoc(studentRef, { resumes: updatedResumes });
          toast.success("Resume deleted successfully!");
        } catch (error) {
          console.error("Error deleting resume:", error);
          toast.error("Failed to delete resume.");
        }
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">My Resumes</h3>
          {!showResumeForm && (
            <button 
              onClick={() => setShowResumeForm(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
            >
              <PlusCircle size={16} />
              Add Resume
            </button>
          )}
        </div>
        {showResumeForm && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h4 className="font-medium mb-3">Add New Resume</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resume Name</label>
                <input
                  type="text"
                  value={newResume.name}
                  onChange={(e) => setNewResume({ ...newResume, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., Technical Resume, General Resume"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resume Link</label>
                <input
                  type="text"
                  value={newResume.link}
                  onChange={(e) => setNewResume({ ...newResume, link: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="https://drive.google.com/file/..."
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleAddResume}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                >
                  Save Resume
                </button>
                <button 
                  onClick={() => {
                    setShowResumeForm(false);
                    setNewResume({ name: "", link: "" });
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {resumes.length > 0 ? (
          <div className="space-y-4">
            {resumes.map((resume) => (
              <div key={resume.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{resume.name}</h4>
                    {resume.isPrimary && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Primary</span>
                    )}
                  </div>
                  {resume.feedback && (
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">Feedback:</span> {resume.feedback}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!resume.isPrimary && (
                    <button 
                      onClick={() => handleSetPrimaryResume(resume.id)}
                      className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm flex items-center gap-1"
                    >
                      <Check size={14} />
                      Set as Primary
                    </button>
                  )}
                  <a 
                    href={resume.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm flex items-center gap-1"
                  >
                    <Eye size={14} />
                    View
                  </a>
                  <button 
                    onClick={() => handleDeleteResume(resume.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No resumes added yet. Click "Add Resume" to get started.</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Resume Builder</h3>
        <p className="mb-4">Create a professional resume using our built-in resume maker tool.</p>
        <Link 
          to="/student/resume-maker"
          className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 inline-flex items-center gap-2"
        >
          <FileText size={16} />
          Open Resume Builder
        </Link>
      </div>
    </div>
  );
};

export default ProfileResumes;
