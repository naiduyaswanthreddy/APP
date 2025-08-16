// First React and Router imports
import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';

// Add new Analytics import
import AdminAnalytics from "./components/admin/Analytics";

// Then Firebase imports
import { auth, db } from "./firebase";
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Then page components
import Login from "./Login";
import Signup from "./Signup";
import Student from "./Student";
import Admin from "./Admin";

// Then feature components
import StudentResources from "./components/student/Resources";
import StudentCoding from "./components/student/Coding";
import StudentProfile from "./components/student/Profile";
import StudentGallery from "./components/student/Gallery";
import StudentApplications from "./components/student/Applications";
import JobCards from "./components/student/JobCards";
import JobDetails from "./components/student/JobDetails";
import MyDiscussions from "./components/student/MyDiscussions";

// Admin Components
import AdminResources from "./components/admin/Resources";
import AdminJobPost from "./components/admin/JobPost";
import AdminCoding from "./components/admin/Coding";
import AdminProfile from "./components/admin/Profile";
import AdminGallery from "./components/admin/Gallery";
import ManageApplications from './components/admin/Job_Applications/ManageApplications';
import JobApplications from './components/admin/Job_Applications/JobApplications';
import Students from "./components/admin/Students";
import AdminChat from "./components/admin/AdminChat"; // Add this import
import AdminDashboard from "./components/admin/Dashboard";

// Add import for Notifications
import AdminNotifications from "./components/admin/Notifications";

// Add import for StudentNotifications
import StudentNotifications from "./components/student/Notifications";

// First add the import for Companies component
import Companies from "./components/admin/Companies";
import CompanyCreate from "./components/admin/CompanyCreate";
import CompanyMonitoring from "./components/admin/CompanyMonitoring";

// Add import for Resume Maker
import ResumeMaker from "./components/student/Resume maker/src/App";
import Loader from './loading'; // Add this import at the top

// Add this import with the other student components (around line 35)
import StudentCalendar from "./components/student/Calendar";

import AdminCalendar from "./components/admin/Calendar";
import PlacedStudents from './components/admin/PlacedStudents'; // Import PlacedStudents
import ActivityLogs from './components/admin/ActivityLogs';


function AuthHandler() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await getIdTokenResult(user);
          const claimRole = token.claims.role || token.claims.userRole || localStorage.getItem('userRole');
          // Fetch and cache rollNumber for students
          try {
            const snap = await getDoc(doc(db, 'students', user.uid));
            if (snap.exists()) {
              const roll = snap.data()?.rollNumber;
              if (roll) {
                localStorage.setItem('rollNumber', roll);
              }
            }
          } catch (_e) {
            // ignore
          }
          if (claimRole) {
            setUser(user);
            setRole(claimRole);
            const currentPath = window.location.pathname;
            const expectedPath = `/${claimRole}`;
            if (!currentPath.startsWith(expectedPath)) {
              navigate(expectedPath, { replace: true });
            }
          } else {
            // Fallback: send to login if no role
            setUser(user);
            setRole(null);
            navigate('/login', { replace: true });
          }
        } catch (e) {
          setUser(user);
          setRole(null);
          if (e?.code === 'auth/network-request-failed') {
            setNetworkError(true);
          }
        }
      } else {
        // Clear everything if no user
        setUser(null);
        setRole(null);
        localStorage.removeItem("userRole");
        
        // Only navigate to login if we're not already there or at signup
        if (!['/login', '/signup'].includes(window.location.pathname)) {
          navigate('/login', { replace: true });
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-800 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
        <Loader />
      </div>
    );
  }

  const ProtectedRoute = ({ children, allowedRole }) => {
    if (!user || !role) {
      return <Navigate to="/login" replace />;
    }

    if (role !== allowedRole) {
      return <Navigate to={`/${role}`} replace />;
    }

    return children;
  };

  return (
    <>
      {networkError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-sm py-2 px-4 text-center">
          Network error while verifying session. Please check your connection and refresh this page.
        </div>
      )}
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      
      {/* Admin routes with protection */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRole="admin">
          <Admin />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="resources" element={<AdminResources />} />
        <Route path="jobpost" element={<AdminJobPost />} />
        <Route path="manage-applications" element={<ManageApplications />} />
        <Route path="job-applications/:jobId" element={<JobApplications />} />
        <Route path="coding" element={<AdminCoding />} />
        <Route path="students" element={<Students />} />
        <Route path="profile" element={<AdminProfile />} />
        <Route path="gallery" element={<AdminGallery />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="chat" element={<AdminChat />} /> {/* Add this line */}
        <Route path="calendar" element={<AdminCalendar />} />
        <Route path="placed-students" element={<PlacedStudents />} />
        <Route path="activity-logs" element={<ActivityLogs />} />


        
        {/* Add the missing company routes */}
        <Route path="companies" element={<Companies />} />
        <Route path="companies/create" element={<CompanyCreate />} />
        <Route path="companies/monitor" element={<CompanyMonitoring />} />
      </Route>

      {/* Student routes with protection */}
      <Route path="/student" element={
        <ProtectedRoute allowedRole="student">
          <Student />
        </ProtectedRoute>
      }>
        <Route index element={<StudentProfile />} />
        <Route path="resources" element={<StudentResources />} />
        <Route path="jobpost" element={<JobCards />} />
        <Route path="job/:jobId" element={<JobDetails />} />
        <Route path="my-discussions" element={<MyDiscussions />} />
        <Route path="applications" element={<StudentApplications />} />
        <Route path="coding" element={<StudentCoding />} />
        <Route path="profile" element={<StudentProfile />} />
        <Route path="gallery" element={<StudentGallery />} />
        <Route path="notifications" element={<StudentNotifications />} />
        {/* Add the resume-maker route inside the student routes */}
        <Route path="resume-maker" element={<ResumeMaker />} />
        // Add this route in the student routes section (around line 155)
        <Route path="calendar" element={<StudentCalendar />} />
      </Route>
      </Routes>
    </>
  );
}

export default AuthHandler;