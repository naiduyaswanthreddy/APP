import React, { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { 
  Book, Clipboard, 
  Download, Eye, Trash2, PlusCircle
} from "lucide-react";

const ProfileAcademics = () => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("academics");
  const [userData, setUserData] = useState({
    cgpa: "",
    skills: "",
    academicInfo: "",
    currentArrears: "0",
    historyOfArrears: "0",
    backlogsCleared: "No",
    academicAttendance: "0",
    tpAttendance: "0",
    academicRemarks: "",
    semesterData: [],
    eligibleJobs: 0,
    appliedJobs: 0,
    shortlistedJobs: 0,
    interviewedJobs: 0,
    offersReceived: 0,
  });
  
  // Resumes moved to top-level ProfileResumes tab
  const [documents, setDocuments] = useState([]);
  // Tracker moved to Career tab
  const [newDocument, setNewDocument] = useState({ type: "", link: "", expiryDate: "" });
  const [showDocumentForm, setShowDocumentForm] = useState(false);

  // Tracker helpers moved to Career

  useEffect(() => {
    fetchUserProfile();
    // Tracker moved to Career
  }, []);

  const fetchUserProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      const studentRef = doc(db, "students", user.uid);
      const studentSnap = await getDoc(studentRef);
      
      if (studentSnap.exists()) {
        const data = studentSnap.data();
        setUserData(prev => ({
          ...prev,
          cgpa: data.cgpa || "",
          skills: data.skills || "",
          academicInfo: data.academicInfo || "",
          currentArrears: data.currentArrears || "0",
          historyOfArrears: data.historyOfArrears || "0",
          backlogsCleared: data.backlogsCleared || "No",
          academicAttendance: data.academicAttendance || "0",
          tpAttendance: data.tpAttendance || "0",
          academicRemarks: data.academicRemarks || "",
          semesterData: data.semesterData || [
            { semester: 1, cgpa: 8.5 },
            { semester: 2, cgpa: 8.7 },
            { semester: 3, cgpa: 9.0 },
            { semester: 4, cgpa: 8.8 },
          ],
        }));
        
        setDocuments(data.documents || []);
      }
    }
  };

  // Tracker stats moved to Career

  const handleSaveProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const studentRef = doc(db, "students", user.uid);
        await updateDoc(studentRef, {
          cgpa: userData.cgpa,
          skills: userData.skills,
          academicInfo: userData.academicInfo,
          currentArrears: userData.currentArrears,
          historyOfArrears: userData.historyOfArrears,
          backlogsCleared: userData.backlogsCleared,
          academicAttendance: userData.academicAttendance,
          tpAttendance: userData.tpAttendance,
          academicRemarks: userData.academicRemarks,
          semesterData: userData.semesterData,
          updatedAt: serverTimestamp(),
        });
        toast.success("Academic profile updated successfully!");
        setIsEditing(false);
      } catch (error) {
        console.error("Error updating profile:", error);
        toast.error("Failed to update profile. Please try again.");
      }
    } else {
      toast.error("User not authenticated. Please log in.");
    }
  };

  const handleAddDocument = async () => {
    if (newDocument.type && newDocument.link) {
      const documentToAdd = {
        id: Date.now(),
        type: newDocument.type,
        link: newDocument.link,
        expiryDate: newDocument.expiryDate || null
      };
      const updatedDocuments = [...documents, documentToAdd];
      setDocuments(updatedDocuments);

      const user = auth.currentUser;
      if (user) {
        try {
          const studentRef = doc(db, "students", user.uid);
          await updateDoc(studentRef, { documents: updatedDocuments });
          toast.success("Document added successfully!");
          setNewDocument({ type: "", link: "", expiryDate: "" });
          setShowDocumentForm(false);
        } catch (error) {
          console.error("Error saving document:", error);
          toast.error("Failed to save document. Please try again.");
        }
      }
    } else {
      toast.error("Please fill in all required fields");
    }
  };

  const handleDeleteDocument = async (id) => {
    if (window.confirm("Are you sure you want to delete this document?")) {
      const updatedDocuments = documents.filter(doc => doc.id !== id);
      setDocuments(updatedDocuments);

      const user = auth.currentUser;
      if (user) {
        try {
          const studentRef = doc(db, "students", user.uid);
          await updateDoc(studentRef, { documents: updatedDocuments });
          toast.success("Document deleted successfully!");
        } catch (error) {
          console.error("Error deleting document:", error);
          toast.error("Failed to delete document.");
        }
      }
    }
  };

  const profileTabs = [
    { id: "academics", label: "Academics", icon: <Book size={16} /> },
    { id: "documents", label: "Documents", icon: <Clipboard size={16} /> },
  ];

  // CGPA Trend data removed

  // Removed tracker chart data

  const renderAcademicsTab = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Academic Details</h3>
            {isEditing ? (
              <button 
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Save
              </button>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Edit
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">CGPA</p>
              {isEditing ? (
                <input
                  type="text"
                  value={userData.cgpa}
                  onChange={(e) => setUserData(prev => ({ ...prev, cgpa: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                />
              ) : (
                <p className="text-base">{userData.cgpa || "Not specified"}</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Current Arrears</p>
              {isEditing ? (
                <input
                  type="number"
                  min="0"
                  value={userData.currentArrears}
                  onChange={(e) => setUserData(prev => ({ ...prev, currentArrears: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                />
              ) : (
                <p className="text-base">{userData.currentArrears}</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">History of Arrears</p>
              {isEditing ? (
                <input
                  type="number"
                  min="0"
                  value={userData.historyOfArrears}
                  onChange={(e) => setUserData(prev => ({ ...prev, historyOfArrears: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                />
              ) : (
                <p className="text-base">{userData.historyOfArrears}</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Backlogs Cleared</p>
              {isEditing ? (
                <select
                  value={userData.backlogsCleared}
                  onChange={(e) => setUserData(prev => ({ ...prev, backlogsCleared: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="N/A">N/A</option>
                </select>
              ) : (
                <p className="text-base">{userData.backlogsCleared}</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Academic Attendance</p>
              {isEditing ? (
                <input
                  type="text"
                  value={userData.academicAttendance}
                  onChange={(e) => setUserData(prev => ({ ...prev, academicAttendance: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., 85%"
                />
              ) : (
                <p className="text-base">{userData.academicAttendance}%</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">T&P Attendance</p>
              {isEditing ? (
                <input
                  type="text"
                  value={userData.tpAttendance}
                  onChange={(e) => setUserData(prev => ({ ...prev, tpAttendance: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., 90%"
                />
              ) : (
                <p className="text-base">{userData.tpAttendance}%</p>
              )}
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <p className="text-sm font-medium text-gray-500">Academic Remarks</p>
              {isEditing ? (
                <textarea
                  value={userData.academicRemarks}
                  onChange={(e) => setUserData(prev => ({ ...prev, academicRemarks: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  rows="3"
                />
              ) : (
                <p className="text-base">{userData.academicRemarks || "No remarks"}</p>
              )}
            </div>
          </div>
        </div>

        {/* CGPA Trend removed */}
      </div>
    );
  };

  const renderDocumentsTab = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">My Documents</h3>
            {!showDocumentForm && (
              <button 
                onClick={() => setShowDocumentForm(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
              >
                <PlusCircle size={16} />
                Add Document
              </button>
            )}
          </div>
          
          {showDocumentForm && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <h4 className="font-medium mb-3">Add New Document</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Document Type*</label>
                  <input
                    type="text"
                    value={newDocument.type}
                    onChange={(e) => setNewDocument({ ...newDocument, type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="e.g., Aadhaar, PAN, Passport"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Document Link*</label>
                  <input
                    type="text"
                    value={newDocument.link}
                    onChange={(e) => setNewDocument({ ...newDocument, link: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="https://drive.google.com/file/..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (if applicable)</label>
                  <input
                    type="date"
                    value={newDocument.expiryDate}
                    onChange={(e) => setNewDocument({ ...newDocument, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleAddDocument}
                    className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                  >
                    Save Document
                  </button>
                  <button 
                    onClick={() => {
                      setShowDocumentForm(false);
                      setNewDocument({ type: "", link: "", expiryDate: "" });
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {documents.length > 0 ? (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-medium">{doc.type}</h4>
                    {doc.expiryDate && (
                      <p className="text-sm text-gray-600">
                        Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                        {new Date(doc.expiryDate) < new Date() && (
                          <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Expired</span>
                        )}
                        {new Date(doc.expiryDate) > new Date() && new Date(doc.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) && (
                          <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">Expiring Soon</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a 
                      href={doc.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm flex items-center gap-1"
                    >
                      <Eye size={14} />
                      View
                    </a>
                    <a 
                      href={doc.link} 
                      download
                      className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm flex items-center gap-1"
                    >
                      <Download size={14} />
                      Download
                    </a>
                    <button 
                      onClick={() => handleDeleteDocument(doc.id)}
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
              <p className="text-gray-500">No documents added yet. Click "Add Document" to get started.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Removed tracker renderer

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      
      <h2 className="text-2xl font-bold mb-6">Academic Profile</h2>
      
      {/* Tab Navigation */}
      <div className="mb-6 flex flex-wrap gap-2 border-b">
        {profileTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 flex items-center gap-2 ${activeTab === tab.id
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="mb-8">
        {activeTab === "academics" && renderAcademicsTab()}
        {activeTab === "documents" && renderDocumentsTab()}
        
      </div>
    </div>
  );
};

export default ProfileAcademics;