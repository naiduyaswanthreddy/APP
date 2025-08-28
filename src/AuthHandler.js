// First React and Router imports
import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';

// Then Firebase imports
import { auth, db } from "./firebase";
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { subscribeToNotifications, requestNotificationPermission } from './utils/fcmHelpers';
import Loader from './loading'; // Loader is used directly, so no lazy loading

// Then page components
const Login = lazy(() => import("./Login"));
const Signup = lazy(() => import("./Signup"));
const Student = lazy(() => import("./Student"));
const Admin = lazy(() => import("./Admin"));

// Then feature components
const StudentResources = lazy(() => import("./components/student/Resources"));
const StudentCoding = lazy(() => import("./components/student/Coding"));
const StudentProfile = lazy(() => import("./components/student/Profile"));
const StudentGallery = lazy(() => import("./components/student/Gallery"));
const StudentApplications = lazy(() => import("./components/student/Applications"));
const JobCards = lazy(() => import("./components/student/JobCards"));
const JobDetails = lazy(() => import("./components/student/JobDetails"));
const MyDiscussions = lazy(() => import("./components/student/MyDiscussions"));

// Admin Components
const AdminAnalytics = lazy(() => import("./components/admin/Analytics"));
const AdminResources = lazy(() => import("./components/admin/Resources"));
const AdminJobPost = lazy(() => import("./components/admin/JobPost"));
const AdminCoding = lazy(() => import("./components/admin/Coding"));
const AdminProfile = lazy(() => import("./components/admin/Profile"));
const AdminGallery = lazy(() => import("./components/admin/Gallery"));
const ManageApplications = lazy(() => import('./components/admin/Job_Applications/ManageApplications'));
const JobApplications = lazy(() => import('./components/admin/Job_Applications/JobApplications'));
const Students = lazy(() => import("./components/admin/Students"));
const AdminChat = lazy(() => import("./components/admin/AdminChat"));
const AdminDashboard = lazy(() => import("./components/admin/Dashboard"));

// Add import for Notifications
const AdminNotifications = lazy(() => import("./components/admin/Notifications"));
const StudentNotifications = lazy(() => import("./components/student/Notifications"));
// Add import for Student Notification Settings
const NotificationSettings = lazy(() => import("./components/student/NotificationSettings"));

// First add the import for Companies component
const Companies = lazy(() => import("./components/admin/Companies"));
const CompanyCreate = lazy(() => import("./components/admin/CompanyCreate"));
const CompanyMonitoring = lazy(() => import("./components/admin/CompanyMonitoring"));

// Add import for Resume Maker
const ResumeMaker = lazy(() => import("./components/student/Resume maker/src/App"));

// Add this import with the other student components
const StudentCalendar = lazy(() => import("./components/student/Calendar"));
const AdminCalendar = lazy(() => import("./components/admin/Calendar"));
const PlacedStudents = lazy(() => import('./components/admin/PlacedStudents'));
const ActivityLogs = lazy(() => import('./components/admin/ActivityLogs'));
const NotificationTester = lazy(() => import('./components/admin/NotificationTester'));

// Task & Assessment imports
const TaskCreation = lazy(() => import('./components/admin/TaskCreation'));
const TaskManagement = lazy(() => import('./components/admin/TaskManagement'));
const TaskResults = lazy(() => import('./components/admin/TaskResults'));
const TasksPage = lazy(() => import('./components/student/TasksPage'));
const TaskAttempt = lazy(() => import('./components/student/TaskAttempt'));

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
          const normalizedRole = claimRole === 'superadmin' ? 'admin' : claimRole;
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
          if (normalizedRole) {
            setUser(user);
            setRole(normalizedRole);
            
            // Auto-subscribe to push notifications for students
            if (normalizedRole === 'student') {
              setTimeout(async () => {
                try {
                  // Check if notifications are already granted
                  if (Notification.permission === 'default') {
                    console.log('Requesting notification permission for authenticated student...');
                    const permission = await requestNotificationPermission();
                    if (permission === 'granted') {
                      await subscribeToNotifications();
                      console.log('Student automatically subscribed to push notifications');
                    }
                  } else if (Notification.permission === 'granted') {
                    // Permission already granted, just subscribe
                    await subscribeToNotifications();
                    console.log('Student automatically subscribed to push notifications');
                  }
                } catch (error) {
                  console.log('Could not auto-subscribe to notifications:', error.message);
                  // Don't show error to user, this is a background operation
                }
              }, 2000); // Delay to ensure UI is ready
            }
            
            const currentPath = window.location.pathname;
            const expectedPath = `/${normalizedRole}`;
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

  const loadingFallback = (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <Loader />
    </div>
  );

  if (loading) {
    return loadingFallback;
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
      <Suspense fallback={loadingFallback}>
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
            <Route path="chat" element={<AdminChat />} />
            <Route path="calendar" element={<AdminCalendar />} />
            <Route path="placed-students" element={<PlacedStudents />} />
            <Route path="activity-logs" element={<ActivityLogs />} />
            <Route path="notification-tester" element={<NotificationTester />} />
            
            {/* Task & Assessment routes */}
            <Route path="tasks/create" element={<TaskCreation />} />
            <Route path="tasks/manage" element={<TaskManagement />} />
            <Route path="tasks/:taskId/results" element={<TaskResults />} />
            
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
            <Route path="notification-settings" element={<NotificationSettings />} />
            <Route path="resume-maker" element={<ResumeMaker />} />
            <Route path="calendar" element={<StudentCalendar />} />
            
            {/* Task & Assessment routes */}
            <Route path="tasks" element={<TasksPage />} />
            <Route path="tasks/:taskId/attempt" element={<TaskAttempt />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

export default AuthHandler;