import React, { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate, Link } from "react-router-dom";
import { 
  User, 
  Briefcase, 
  Award, 
  Book, 
  Download,
  Settings,
} from "lucide-react";
import LoadingSpinner from '../ui/LoadingSpinner';
import { createSystemAlertNotification, createCompanyActionNotification } from '../../utils/notificationHelpers';

// Import the individual profile components
import ProfileBasic from "./ProfileBasic";
import ProfileAcademics from "./ProfileAcademics";
import ProfileCareer from "./ProfileCareer";
import ProfileExcellence from "./ProfileExcellence";
import PushNotificationSettings from "./PushNotificationSettings";

const Profile = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("basic");
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  
  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (user) {
        const studentRef = doc(db, "students", user.uid);
        const studentSnap = await getDoc(studentRef);
        
        if (studentSnap.exists()) {
          const data = studentSnap.data();
          setUserData(data);
          calculateCompletionPercentage(data);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  const calculateCompletionPercentage = (data) => {
    const requiredFields = {
      basic: ['name', 'email', 'mobile', 'rollNumber', 'batch', 'program', 'department', 'gender', 'birthday', 'address', 'city', 'state', 'pinCode'],
      academics: ['cgpa', 'skills', 'semesterData'],
      career: ['workExperience'],
      excellence: ['technicalSkills', 'softSkills', 'projects']
    };
    
    let filledFields = 0;
    let totalFields = 0;
    
    Object.keys(requiredFields).forEach(section => {
      requiredFields[section].forEach(field => {
        totalFields++;
        if (data[field] && 
            ((Array.isArray(data[field]) && data[field].length > 0) || 
             (typeof data[field] === 'string' && data[field].trim() !== '') ||
             (typeof data[field] === 'number' && !isNaN(data[field])) ||
             (typeof data[field] === 'object' && data[field] !== null && Object.keys(data[field]).length > 0))) {
          filledFields++;
        }
      });
    });
    
    const percentage = Math.round((filledFields / totalFields) * 100);
    setCompletionPercentage(percentage);
  };

  const handleExportPDF = () => {
    if (!userData) return;
    const pdfBlob = generatePDF(userData);
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${userData.name || 'student'}_profile.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const generatePDF = (data) => {
    return new Blob(['PDF content'], { type: 'application/pdf' });
  };

  const handleProfileUpdate = async (updatedData) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error('Please login to update your profile');
        return;
      }

      const studentRef = doc(db, 'students', user.uid);
      await updateDoc(studentRef, {
        ...updatedData,
        updatedAt: serverTimestamp()
      });

      // Send admin notification about profile update
      try {
        await createSystemAlertNotification(
          'Student Profile Updated',
          `Student ${user.displayName || 'Unknown'} has updated their profile information.`,
          `/admin/students/${user.uid}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success('Profile updated successfully!');
      fetchUserProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  const handleAchievementSubmit = async (achievementData) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error('Please login to submit achievement');
        return;
      }

      const achievement = {
        ...achievementData,
        studentId: user.uid,
        studentName: user.displayName || 'Unknown',
        submittedAt: serverTimestamp(),
        approvalStatus: 'pending',
        featured: false
      };

      await addDoc(collection(db, 'achievement_posts'), achievement);

      // Send admin notification about new achievement submission
      try {
        await createCompanyActionNotification(
          'Achievement Submission',
          `Student ${user.displayName || 'Unknown'} has submitted a new achievement for review.`,
          '/admin/gallery'
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success('Achievement submitted successfully! It will be reviewed by admin.');
      // setShowAchievementModal(false); // This state variable is not defined in the original file
    } catch (error) {
      console.error('Error submitting achievement:', error);
      toast.error('Failed to submit achievement');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="large" text="Loading profile..." /></div>;
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 max-w-6xl">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Profile Header with Completion Percentage */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex items-center mb-4 sm:mb-0">
          <div className="bg-indigo-100 p-3 rounded-full mr-4">
            <User size={24} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{userData?.name || 'Student Profile'}</h1>
            <p className="text-gray-600">{userData?.rollNumber || 'Roll Number'} • {userData?.program || 'Program'}</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Profile Completion */}
          <div className="flex items-center bg-gray-100 px-3 py-2 rounded-lg">
            <div className="mr-2">
              <svg className="w-10 h-10">
                <circle className="text-gray-300" strokeWidth="5" stroke="currentColor" fill="transparent" r="18" cx="20" cy="20" />
                <circle className="text-indigo-600" strokeWidth="5" strokeDasharray={`${completionPercentage * 1.13}, 113`} strokeLinecap="round" stroke="currentColor" fill="transparent" r="18" cx="20" cy="20" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Profile Completion</p>
              <p className="font-semibold">{completionPercentage}%</p>
            </div>
          </div>
          
          {/* Export & Print Buttons */}
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Download size={16} />
            <span>Export PDF</span>
          </button>
        </div>
      </div>
      
      {/* Profile Navigation */}
      <div className="">
        <nav className="flex gap-1 bg-gray-100 p-1 rounded-t-lg overflow-x-auto">
          <button
            onClick={() => setActiveTab("basic")}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === "basic" ? "bg-white text-blue-600 border-t border-l border-r border-blue-500 -mb-px" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <User size={16} className="mr-2" />
            <span>Basic</span>
          </button>
          
          <button
            onClick={() => setActiveTab("academics")}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === "academics" ? "bg-white text-green-600 border-t border-l border-r border-green-500 -mb-px" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Book size={16} className="mr-2" />
            <span>Academics</span>
          </button>
          
          <button
            onClick={() => setActiveTab("career")}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === "career" ? "bg-white text-yellow-600 border-t border-l border-r border-yellow-500 -mb-px" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Briefcase size={16} className="mr-2" />
            <span>Career</span>
          </button>
          
          <button
            onClick={() => setActiveTab("excellence")}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === "excellence" ? "bg-white text-red-600 border-t border-l border-r border-red-500 -mb-px" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Award size={16} className="mr-2" />
            <span>Excellence</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === "settings" ? "bg-white text-purple-600 border-t border-l border-r border-purple-500 -mb-px" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Settings size={16} className="mr-2" />
            <span>Settings</span>
          </button>
        </nav>
      </div>
      
      {/* Profile Content */}
      <div className={`bg-white rounded-lg shadow overflow-hidden p-6 ${activeTab === "basic" ? "border border-blue-500" : ""} ${activeTab === "academics" ? "border border-green-500" : ""} ${activeTab === "career" ? "border border-yellow-500" : ""} ${activeTab === "excellence" ? "border border-red-500" : ""} ${activeTab === "settings" ? "border border-purple-500" : ""}`}>
        {/* Basic Info Tab */}
        {activeTab === "basic" && (
          <div>
            <ProfileBasic userData={userData || {}} onUserDataChange={setUserData} />
          </div>
        )}
        
        {/* Academics Tab */}
        {activeTab === "academics" && (
          <div>
            <ProfileAcademics userData={userData || {}} onUserDataChange={setUserData} />
          </div>
        )}
        
        {/* Career Tab */}
        {activeTab === "career" && (
          <div>
            <ProfileCareer />
          </div>
        )}
        
        {/* Excellence Tab */}
        {activeTab === "excellence" && (
          <div>
            <ProfileExcellence />
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div>
            <PushNotificationSettings />
          </div>
        )}
      </div>
      
      {/* Mobile Sidebar (for smaller screens) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 flex justify-around">
        <button
          onClick={() => setActiveTab("basic")}
          className={`flex flex-col items-center p-2 ${activeTab === "basic" ? "text-blue-600" : "text-gray-500"}`}
        >
          <User size={20} />
          <span className="text-xs mt-1">Basic</span>
        </button>
        
        <button
          onClick={() => setActiveTab("academics")}
          className={`flex flex-col items-center p-2 ${activeTab === "academics" ? "text-green-600" : "text-gray-500"}`}
        >
          <Book size={20} />
          <span className="text-xs mt-1">Academics</span>
        </button>
        
        <button
          onClick={() => setActiveTab("career")}
          className={`flex flex-col items-center p-2 ${activeTab === "career" ? "text-yellow-600" : "text-gray-500"}`}
        >
          <Briefcase size={20} />
          <span className="text-xs mt-1">Career</span>
        </button>
        
        <button
          onClick={() => setActiveTab("excellence")}
          className={`flex flex-col items-center p-2 ${activeTab === "excellence" ? "text-red-600" : "text-gray-500"}`}
        >
          <Award size={20} />
          <span className="text-xs mt-1">Excellence</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex flex-col items-center p-2 ${activeTab === "settings" ? "text-purple-600" : "text-gray-500"}`}
        >
          <Settings size={20} />
          <span className="text-xs mt-1">Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Profile;