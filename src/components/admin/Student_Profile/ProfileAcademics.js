import React, { useEffect, useState } from "react";
import { auth, db } from "../../../firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate, Link } from "react-router-dom";
import { 
   Check,  Target, FileText, 
  Book, Clipboard, 
   Download, Eye, Trash2, PlusCircle
} from "lucide-react";

// Import Chart.js for CGPA trend chart
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const ProfileAcademics = ({ userData: propUserData, isAdminView }) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("academics");
  const [userData, setUserData] = useState({
    // Academic Info
    cgpa: "",
    skills: "",
    academicInfo: "",
    currentArrears: "0",
    historyOfArrears: "0",
    backlogsCleared: "No",
    academicAttendance: "0",
    tpAttendance: "0",
    academicRemarks: "",
    
    // Add this line to initialize semesterData as an empty array
    semesterData: [],
    
    // Stats
    eligibleJobs: 0,
    appliedJobs: 0,
    shortlistedJobs: 0,
    interviewedJobs: 0,
    offersReceived: 0,
  });
  
  // Resume state
  const [resumes, setResumes] = useState([]);
  
  // Documents state
  const [documents, setDocuments] = useState([]);
  
  // Move this useState hook inside the component
  const [applicationTimeline, setApplicationTimeline] = useState([]);

  // Add these helper functions inside the component
  const getStatusColor = (status) => {
    switch(status) {
      case "applied": return "bg-blue-500";
      case "shortlisted": return "bg-yellow-500";
      case "interviewed": return "bg-purple-500";
      case "offered": return "bg-green-500";
      case "rejected": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case "applied": return "Applied to";
      case "shortlisted": return "Shortlisted by";
      case "interviewed": return "Interview with";
      case "offered": return "Offer from";
      case "rejected": return "Rejected by";
      default: return "";
    }
  };

  useEffect(() => {
    if (isAdminView && propUserData) {
      // Use the provided userData directly
      setUserData(prev => ({
        ...prev,
        cgpa: propUserData.cgpa || "",
        skills: propUserData.skills || "",
        academicInfo: propUserData.academicInfo || "",
        currentArrears: propUserData.currentArrears || "0",
        historyOfArrears: propUserData.historyOfArrears || "0",
        backlogsCleared: propUserData.backlogsCleared || "No",
        academicAttendance: propUserData.academicAttendance || "0",
        tpAttendance: propUserData.tpAttendance || "0",
        academicRemarks: propUserData.academicRemarks || "",
        semesterData: propUserData.semesterData || [],
      }));
      
      // Fetch resumes if available
      if (propUserData.resumes) {
        setResumes(propUserData.resumes);
      }
      
      // Fetch documents if available
      if (propUserData.documents) {
        setDocuments(propUserData.documents);
      }
    } else {
      // Fetch user profile for non-admin view
      fetchUserProfile();
      fetchApplicationStats();
    }
  }, [isAdminView, propUserData]);

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
          // We would normally fetch this from the database
          semesterData: data.semesterData || [
            { semester: 1, cgpa: 8.5 },
            { semester: 2, cgpa: 8.7 },
            { semester: 3, cgpa: 9.0 },
            { semester: 4, cgpa: 8.8 },
          ],
        }));
        
        // Fetch resumes if available
        if (data.resumes) {
          setResumes(data.resumes);
        }
        
        // Fetch documents if available
        if (data.documents) {
          setDocuments(data.documents);
        }
      }
    }
  };

  const fetchApplicationStats = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        // Get all jobs to calculate eligible jobs
        const jobsRef = collection(db, "jobs");
        const jobsSnapshot = await getDocs(jobsRef);
        const allJobs = [];
        jobsSnapshot.forEach((doc) => {
          allJobs.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Get student profile to check eligibility criteria
        const studentRef = doc(db, "students", user.uid);
        const studentSnap = await getDoc(studentRef);
        const studentData = studentSnap.exists() ? studentSnap.data() : {};
        
        // Get applications data (backend stores student reference as "student_id")
        const applicationsRef = collection(db, "applications");
        const q = query(applicationsRef, where("student_id", "==", user.uid));
        const querySnapshot = await getDocs(q);
        
        // Process application data
        const applications = [];
        querySnapshot.forEach((doc) => {
          applications.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Calculate eligible jobs based on student profile criteria
        const eligibleJobs = allJobs.filter(job => {
          // Check if student meets job criteria (CGPA, etc.)
          const meetsMinCGPA = !job.minCGPA || (studentData.cgpa && parseFloat(studentData.cgpa) >= parseFloat(job.minCGPA));
          // Job schema uses maxCurrentArrears; fall back to legacy name if present
          const maxCurrentArrears = job.maxCurrentArrears ?? job.maxArrears;
          const meetsArrearCriteria = !maxCurrentArrears || (studentData.currentArrears && parseInt(studentData.currentArrears) <= parseInt(maxCurrentArrears));
          // Add more criteria as needed
          return meetsMinCGPA && meetsArrearCriteria;
        });
        
        // Calculate not applied jobs
        const appliedJobIds = applications.map(app => app.jobId);
        const notAppliedJobs = eligibleJobs.filter(job => !appliedJobIds.includes(job.id));
        
        // Update state with calculated data
        setUserData(prev => ({
          ...prev,
          eligibleJobs: eligibleJobs.length,
          appliedJobs: applications.length,
          notAppliedJobs: notAppliedJobs.length,
          shortlistedJobs: applications.filter(app => app.status === "shortlisted").length,
          interviewedJobs: applications.filter(app => app.status === "interviewed").length,
          offersReceived: applications.filter(app => app.status === "offered").length,
        }));
        
        // Also update the timeline data
        // Use appliedAt from backend and guard against missing timestamps
        setApplicationTimeline(
          applications
            .filter(a => a.appliedAt)
            .sort((a, b) => {
              const aTime = a.appliedAt?.toDate ? a.appliedAt.toDate().getTime() : 0;
              const bTime = b.appliedAt?.toDate ? b.appliedAt.toDate().getTime() : 0;
              return bTime - aTime;
            })
            .slice(0, 5)
        );
        
      } catch (error) {
        console.error("Error fetching application stats:", error);
      }
    }
  };

  const handleSaveProfile = async () => {
    try {
      // Determine which user ID to use based on whether we're in admin view
      let userIdToUpdate;
      
      if (isAdminView && propUserData && propUserData.id) {
        // In admin view, use the student's ID from props
        userIdToUpdate = propUserData.id;
      } else {
        // In regular view, use the current user's ID
        const user = auth.currentUser;
        if (!user) {
          toast.error("User not authenticated. Please log in.");
          return;
        }
        userIdToUpdate = user.uid;
      }
      
      // Now use the correct ID to update the document
      const studentRef = doc(db, "students", userIdToUpdate);
      await updateDoc(studentRef, {
        // Save academic data
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
        
        // Update timestamp
        updatedAt: serverTimestamp(),
      });
      toast.success("Academic profile updated successfully!");
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again.");
    }
  };

  // Add these state variables
  const [newResume, setNewResume] = useState({ name: "", link: "" });
  const [showResumeForm, setShowResumeForm] = useState(false);
  
  // Replace handleAddResume with this
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
      
      // Save to database
      const user = auth.currentUser;
      if (user) {
        try {
          const studentRef = doc(db, "students", user.uid);
          await updateDoc(studentRef, { resumes: updatedResumes });
          toast.success("Resume added successfully!");
          // Reset form
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
    
    // Save to database
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
      
      // If we deleted the primary resume, set a new one if available
      if (resumes.find(r => r.id === id)?.isPrimary && updatedResumes.length > 0) {
        updatedResumes[0].isPrimary = true;
      }
      
      setResumes(updatedResumes);
      
      // Save to database
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

  // Add these state variables after the newResume state
  const [newDocument, setNewDocument] = useState({ type: "", link: "", expiryDate: "" });
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  
  // Replace handleAddDocument with this
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
      
      // Save to database
      const user = auth.currentUser;
      if (user) {
        try {
          const studentRef = doc(db, "students", user.uid);
          await updateDoc(studentRef, { documents: updatedDocuments });
          toast.success("Document added successfully!");
          // Reset form
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
      
      // Save to database
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

  // Tabs for the profile page
  const profileTabs = [
    { id: "academics", label: "Academics", icon: <Book size={16} /> },
    { id: "resumes", label: "Resumes", icon: <FileText size={16} /> },
    { id: "documents", label: "Documents", icon: <Clipboard size={16} /> },
    { id: "tracker", label: "Tracker", icon: <Target size={16} /> },
  ];

  // CGPA Chart data
  const cgpaChartData = {
    labels: userData.semesterData.map(item => `Semester ${item.semester}`),
    datasets: [
      {
        label: 'CGPA',
        data: userData.semesterData.map(item => item.cgpa),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1,
      },
    ],
  };

  // Application funnel data
  const applicationFunnelData = {
    labels: ['Eligible', 'Applied', 'Shortlisted', 'Interviewed', 'Offers'],
    datasets: [
      {
        label: 'Applications',
        data: [
          userData.eligibleJobs,
          userData.appliedJobs,
          userData.shortlistedJobs,
          userData.interviewedJobs,
          userData.offersReceived,
        ],
        backgroundColor: [
          'rgba(54, 162, 235, 0.5)',
          'rgba(75, 192, 192, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(153, 102, 255, 0.5)',
          'rgba(255, 99, 132, 0.5)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Render the academics tab content
  const renderAcademicsTab = () => {
    return (
      <div className="space-y-8">
        {/* Section 2: Academic Details */}
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
            {/* CGPA */}
            <div>
              <p className="text-sm font-medium text-gray-500">CGPA</p>
              {isEditing ? (
                <input
                  type="text"
                  value={userData.cgpa}
                  onChange={(e) => setUserData(prevData => ({ ...prevData, cgpa: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                />
              ) : (
                <p className="text-base">{userData.cgpa || "Not specified"}</p>
              )}
            </div>
            
            {/* Current Arrears */}
            <div>
              <p className="text-sm font-medium text-gray-500">Current Arrears</p>
              {isEditing ? (
                <input
                  type="number"
                  min="0"
                  value={userData.currentArrears}
                  onChange={(e) => setUserData(prevData => ({ ...prevData, currentArrears: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                />
              ) : (
                <p className="text-base">{userData.currentArrears}</p>
              )}
            </div>
            
            {/* History of Arrears */}
            <div>
              <p className="text-sm font-medium text-gray-500">History of Arrears</p>
              {isEditing ? (
                <input
                  type="number"
                  min="0"
                  value={userData.historyOfArrears}
                  onChange={(e) => setUserData(prevData => ({ ...prevData, historyOfArrears: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                />
              ) : (
                <p className="text-base">{userData.historyOfArrears}</p>
              )}
            </div>
            
            {/* Backlogs Cleared */}
            <div>
              <p className="text-sm font-medium text-gray-500">Backlogs Cleared</p>
              {isEditing ? (
                <select
                  value={userData.backlogsCleared}
                  onChange={(e) => setUserData(prevData => ({ ...prevData, backlogsCleared: e.target.value }))}
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
            
            {/* Academic Attendance */}
            <div>
              <p className="text-sm font-medium text-gray-500">Academic Attendance</p>
              {isEditing ? (
                <input
                  type="text"
                  value={userData.academicAttendance}
                  onChange={(e) => setUserData(prevData => ({ ...prevData, academicAttendance: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., 85%"
                />
              ) : (
                <p className="text-base">{userData.academicAttendance}%</p>
              )}
            </div>
            
            {/* T&P Attendance */}
            <div>
              <p className="text-sm font-medium text-gray-500">T&P Attendance</p>
              {isEditing ? (
                <input
                  type="text"
                  value={userData.tpAttendance}
                  onChange={(e) => setUserData(prevData => ({ ...prevData, tpAttendance: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., 90%"
                />
              ) : (
                <p className="text-base">{userData.tpAttendance}%</p>
              )}
            </div>
            
            {/* Academic Remarks */}
            <div className="md:col-span-2 lg:col-span-3">
              <p className="text-sm font-medium text-gray-500">Academic Remarks</p>
              {isEditing ? (
                <textarea
                  value={userData.academicRemarks}
                  onChange={(e) => setUserData(prevData => ({ ...prevData, academicRemarks: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  rows="3"
                ></textarea>
              ) : (
                <p className="text-base">{userData.academicRemarks || "No remarks"}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render the resumes tab content
  const renderResumesTab = () => {
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
          
          {/* Resume Form */}
          {showResumeForm && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <h4 className="font-medium mb-3">Add New Resume</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resume Name</label>
                  <input
                    type="text"
                    value={newResume.name}
                    onChange={(e) => setNewResume({...newResume, name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="e.g., Technical Resume, General Resume"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resume Link</label>
                  <input
                    type="text"
                    value={newResume.link}
                    onChange={(e) => setNewResume({...newResume, link: e.target.value})}
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

  // Render the documents tab content
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
          
          {/* Document Form */}
          {showDocumentForm && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <h4 className="font-medium mb-3">Add New Document</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Document Type*</label>
                  <input
                    type="text"
                    value={newDocument.type}
                    onChange={(e) => setNewDocument({...newDocument, type: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="e.g., Aadhaar, PAN, Passport"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Document Link*</label>
                  <input
                    type="text"
                    value={newDocument.link}
                    onChange={(e) => setNewDocument({...newDocument, link: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="https://drive.google.com/file/..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (if applicable)</label>
                  <input
                    type="date"
                    value={newDocument.expiryDate}
                    onChange={(e) => setNewDocument({...newDocument, expiryDate: e.target.value})}
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

  // Render the tracker tab content
  const renderTrackerTab = () => {
    return (
      <div className="space-y-8">
        {/* Section 1: Application Funnel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Application Funnel</h3>
          <div className="h-64">
            <Line data={applicationFunnelData} options={{ maintainAspectRatio: false }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <p className="text-sm text-gray-600">Eligible</p>
              <p className="text-xl font-bold text-blue-600">{userData.eligibleJobs}</p>
            </div>
            <div className="bg-teal-50 p-3 rounded-lg text-center">
              <p className="text-sm text-gray-600">Applied</p>
              <p className="text-xl font-bold text-teal-600">{userData.appliedJobs}</p>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg text-center">
              <p className="text-sm text-gray-600">Shortlisted</p>
              <p className="text-xl font-bold text-yellow-600">{userData.shortlistedJobs}</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg text-center">
              <p className="text-sm text-gray-600">Interviewed</p>
              <p className="text-xl font-bold text-purple-600">{userData.interviewedJobs}</p>
            </div>
            <div className="bg-pink-50 p-3 rounded-lg text-center">
              <p className="text-sm text-gray-600">Offers</p>
              <p className="text-xl font-bold text-pink-600">{userData.offersReceived}</p>
            </div>
          </div>
        </div>
        
        {/* Section 2: Application Timeline */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Application Timeline</h3>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
            
            {/* Timeline items - these would be dynamically generated from actual application data */}
            <div className="ml-12 space-y-8">
              <div className="relative">
                <div className="absolute -left-12 mt-1.5 h-4 w-4 rounded-full border border-white bg-green-500"></div>
                <div className="mb-1 flex items-center justify-between">
                  <h4 className="text-md font-semibold">Applied to Google</h4>
                  <p className="text-xs text-gray-500">2023-10-15</p>
                </div>
                <p className="text-sm text-gray-600">Software Engineer</p>
              </div>
              
              <div className="relative">
                <div className="absolute -left-12 mt-1.5 h-4 w-4 rounded-full border border-white bg-yellow-500"></div>
                <div className="mb-1 flex items-center justify-between">
                  <h4 className="text-md font-semibold">Shortlisted by Microsoft</h4>
                  <p className="text-xs text-gray-500">2023-10-10</p>
                </div>
                <p className="text-sm text-gray-600">Frontend Developer</p>
              </div>
              
              <div className="relative">
                <div className="absolute -left-12 mt-1.5 h-4 w-4 rounded-full border border-white bg-purple-500"></div>
                <div className="mb-1 flex items-center justify-between">
                  <h4 className="text-md font-semibold">Interview with Amazon</h4>
                  <p className="text-xs text-gray-500">2023-10-05</p>
                </div>
                <p className="text-sm text-gray-600">Full Stack Developer</p>
              </div>
              
              <div className="relative">
                <div className="absolute -left-12 mt-1.5 h-4 w-4 rounded-full border border-white bg-pink-500"></div>
                <div className="mb-1 flex items-center justify-between">
                  <h4 className="text-md font-semibold">Offer from Netflix</h4>
                  <p className="text-xs text-gray-500">2023-09-28</p>
                </div>
                <p className="text-sm text-gray-600">UI/UX Developer - ₹12 LPA</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      
     
      
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
        {activeTab === "resumes" && renderResumesTab()}
        {activeTab === "documents" && renderDocumentsTab()}
        {activeTab === "tracker" && renderTrackerTab()}
      </div>
    </div>
  );
};

export default ProfileAcademics;