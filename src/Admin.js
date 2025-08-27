import { signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Briefcase, 
  FileText, 
  Code, 
  User, 
  Image,
  Users,
  BarChart,
  Bell,
  Building,
  Calendar, // Add Calendar icon import
  LogOut,
  Sun,
  Moon
} from 'lucide-react';
import { ThemeContext } from './context/ThemeContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Admin = () => {
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [userData, setUserData] = useState({
    name: 'Admin',
    rollNo: '',
    batch: '',
    program: '',
    degree: '',
    mobile: '',
    email: '',
    github: '',
    leetcode: '',
    hackerrank: ''
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        // Get admin data from Firestore
        const adminRef = doc(db, "admins", user.uid);
        const adminSnap = await getDoc(adminRef);
        
        setUserData({
          name: user.displayName || "Admin",
          email: user.email || "",
          rollNo: adminSnap.exists() ? adminSnap.data().rollNumber || "" : "",
          batch: adminSnap.exists() ? adminSnap.data().batch || "" : "",
          program: adminSnap.exists() ? adminSnap.data().program || "" : "",
          degree: adminSnap.exists() ? adminSnap.data().department || "" : "",
          mobile: adminSnap.exists() ? adminSnap.data().mobile || "" : "",
          github: adminSnap.exists() ? adminSnap.data().github || "" : "",
          leetcode: adminSnap.exists() ? adminSnap.data().leetcode || "" : "",
          hackerrank: adminSnap.exists() ? adminSnap.data().hackerrank || "" : ""
        });
      } catch (error) {
        console.error("Error fetching admin data:", error);
      }
    }
  };

  const menuItems = [
    { name: "Analytics", path: "/admin/analytics", icon: <BarChart size={20} /> },
    { name: "Resources", path: "/admin/resources", icon: <BookOpen size={20} /> },
    { name: "Manage Applications", path: "/admin/manage-applications", icon: <FileText size={20} /> },
    { name: "Tasks & Assessments", path: "/admin/tasks/manage", icon: <FileText size={20} /> },
    { name: "Coding", path: "/admin/coding", icon: <Code size={20} /> },
    { name: "Students", path: "/admin/students", icon: <Users size={20} /> },
    { name: "Notifications", path: "/admin/notifications", icon: <Bell size={20} /> },
    { name: "Companies", path: "/admin/companies", icon: <Building size={20} /> },
    { name: "Calendar", path: "/admin/calendar", icon: <Calendar size={20} /> },
    { name: "Profile", path: "/admin/profile", icon: <User size={20} /> },
    { name: "Gallery", path: "/admin/gallery", icon: <Image size={20} /> },
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("userRole");
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className={`flex min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'}`}>
      {/* Sidebar */}
      <div className={`fixed h-full transition-all duration-300 ease-in-out z-10 ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-b from-indigo-900 to-teal-600'} ${
        isSidebarOpen ? 'w-64' : 'w-20'
      }`}>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`absolute -right-3 top-4 rounded-full p-1 shadow-lg z-20 transition-colors duration-200 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-100'}`}
        >
          {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
  
        <div className="p-4 text-white h-full flex flex-col">
          {/* Profile Section */}
          <div className={`mb-8 ${isSidebarOpen ? 'text-left' : 'text-center'}`}>
            <div className={`w-12 h-12 rounded-full mx-auto mb-2 ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
              <img
                src={userData.avatar || "/default-avatar.png"} 
                alt="Profile"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden">
                <div className="font-semibold whitespace-nowrap">{userData.name}</div>
                <div className="text-xs text-gray-300 whitespace-nowrap">{userData.rollNo}</div>
              </div>
            )}
          </div>
  
          {/* Navigation Menu - Made scrollable */}
          <nav className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2 rounded transition-colors ${
                  location.pathname === item.path
                    ? isDarkMode ? 'bg-gray-700 text-white' : 'bg-white/20 text-white'
                    : isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-white/10 text-gray-300'
                }`}
              >
                {item.icon}
                {isSidebarOpen && <span>{item.name}</span>}
              </Link>
            ))}
          </nav>
  
          {/* Bottom Row: Theme, Dashboard, Logout */}
          <div className="mt-auto flex items-center justify-between px-2 py-2">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-full transition-colors duration-200 ${isDarkMode ? 'text-yellow-400 hover:bg-gray-700' : 'text-gray-300 hover:bg-white/10'}`}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => navigate('/admin/dashboard')}
              className={`p-2 rounded transition-colors duration-200 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-300 hover:bg-white/10'}`}
              title="Dashboard"
              aria-label="Dashboard"
            >
              <BarChart size={20} />
            </button>
            <button 
              onClick={handleLogout}
              className={`p-2 rounded transition-colors duration-200 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-300 hover:bg-white/10'}`}
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
      {/* Main content area */}
      <div className={`flex-1 transition-all duration-300 ease-in-out ${
        isSidebarOpen ? 'ml-64' : 'ml-20'
      }`}>
        <Outlet />
      </div>
      {/* Global Toast Container for Admin routes */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};

export default Admin;

