import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import React, { useState, useEffect, useContext, Suspense } from 'react';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import {
  ChevronLeft,
  BookOpen,
  Briefcase,
  FileText,
  Code,
  User,
  Image,
  Bell,
  LogOut,
  Calendar,
  MessageSquare,
  Menu,
  Sun,
  Moon
} from 'lucide-react';
import { ThemeContext } from './context/ThemeContext';
import Loader from './loading';
import FreezeStatusBanner from './components/student/FreezeStatusBanner';

const Student = () => {
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [userData, setUserData] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileSidebarOpen(false); // Close mobile sidebar on resize to desktop
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle user data and notifications
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserData({
        name: user.displayName || "User",
        rollNumber: localStorage.getItem("rollNumber"),
      });
    }

    const storedCount = localStorage.getItem('unreadNotificationsCount');
    if (storedCount) {
      setUnreadCount(parseInt(storedCount, 10));
    }

    const handleUnreadCountUpdate = (event) => {
      setUnreadCount(event.detail.count);
    };

    window.addEventListener('unreadNotificationsUpdated', handleUnreadCountUpdate);

    return () => {
      window.removeEventListener('unreadNotificationsUpdated', handleUnreadCountUpdate);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("userRole");
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (!userData) return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <Loader />
    </div>
  );

  const sidebarItems = [
    // Notifications removed from sidebar
    { name: "Resources", path: "/student/resources", icon: BookOpen },
    { name: "Job Posting", path: "/student/jobpost", icon: Briefcase },
    { name: "Applications", path: "/student/applications", icon: FileText },
    { name: "Tasks & Assessments", path: "/student/tasks", icon: FileText },
    { name: "My Discussions", path: "/student/my-discussions", icon: MessageSquare },
    { name: "Calendar", path: "/student/calendar", icon: Calendar },
    { name: "Coding", path: "/student/coding", icon: Code },
    { name: "Profile", path: "/student/profile", icon: User },
    { name: "Gallery", path: "/student/gallery", icon: Image },
  ];

  const sidebarContent = (forMobile = false) => (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 text-white">
          <div className={`mb-8 transition-all duration-300 ease-in-out ${isSidebarOpen || forMobile ? 'text-left' : 'text-center'}`}>
            <div className={`w-12 h-12 rounded-full mx-auto mb-2 ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
              <img
                src="/api/placeholder/48/48"
                alt="Profile"
                className="w-full h-full rounded-full"
              />
            </div>
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${(isSidebarOpen || forMobile) ? 'opacity-100 max-h-20' : 'opacity-0 max-h-0'}`}>
              <div className="font-semibold whitespace-nowrap">{userData.name}</div>
              <div className="text-xs text-gray-300 whitespace-nowrap">{userData.rollNumber}</div>
            </div>
          </div>

          <nav className="space-y-2 custom-scrollbar">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => forMobile && setIsMobileSidebarOpen(false)}
                  className={`w-full text-left px-4 py-2 rounded transition-colors flex items-center gap-3 ${
                    isActive
                      ? (isDarkMode ? 'bg-gray-700 text-white' : 'bg-white/20 text-white')
                      : (isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-white/10 text-gray-300')
                  }`}
                >
                  <Icon size={20} />
                  {(isSidebarOpen || forMobile) && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center justify-start gap-4">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full ${isDarkMode ? 'text-yellow-400 hover:bg-gray-700' : 'text-gray-300 hover:bg-white/10'}`}
            title={isDarkMode ? 'Light mode' : 'Dark mode'}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {/* Bell icon with unread badge next to logout */}
          <button
            onClick={() => navigate('/student/notifications')}
            className={`relative p-2 rounded-full ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-300 hover:bg-white/10'}`}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={handleLogout}
            className={`p-2 rounded-full ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-300 hover:bg-white/10'}`}
            title="Log out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </div>
  );

  const desktopLayout = (
    <div className={`flex min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'}`}>
      <div className={`fixed h-full ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-b from-indigo-900 to-teal-600'} transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        {sidebarContent(false)}
      </div>
      <div className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <FreezeStatusBanner />
        <div className="p-6">
          <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );

  const mobileLayout = (
    <div className={`flex flex-col min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'}`}>
      <header className={`fixed top-0 left-0 right-0 border-b z-30 md:hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className={`p-2 rounded-md transition-colors ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
              aria-label="Open sidebar"
            >
              <Menu size={24} />
            </button>
            <h1 className={`ml-3 text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{`Student Portal`}</h1>
          </div>
          {unreadCount > 0 && (
            <Link to="/student/notifications" className="relative">
              <Bell className={isDarkMode ? 'text-gray-300' : 'text-gray-600'} />
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </Link>
          )}
        </div>
      </header>

      <div className={`fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden ${isMobileSidebarOpen ? 'block' : 'hidden'}`} onClick={() => setIsMobileSidebarOpen(false)}></div>
      <div className={`fixed inset-y-0 left-0 w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-b from-indigo-900 to-teal-600'} flex flex-col z-50 md:hidden transform transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent(true)}
      </div>

      <main className="flex-1 pt-16 pb-20">
        <FreezeStatusBanner />
        <div className="p-4">
          <Suspense fallback={<div className="flex justify-center items-center h-48"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <nav className={`fixed bottom-0 left-0 right-0 border-t z-30 md:hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex justify-around items-center h-16">
          {[
            { name: 'Jobs', path: '/student/jobpost', icon: Briefcase },
            { name: 'Applications', path: '/student/applications', icon: FileText },
            { name: 'Calendar', path: '/student/calendar', icon: Calendar },
            { name: 'Profile', path: '/student/profile', icon: User },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 py-2 px-1 transition-colors ${
                  isActive ? 'text-indigo-600' : (isDarkMode ? 'text-gray-400 hover:text-indigo-500' : 'text-gray-600 hover:text-indigo-600')
                }`}
                aria-label={item.name}
              >
                <Icon size={20} />
                <span className="text-xs mt-1">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );

  return isMobile ? mobileLayout : desktopLayout;
};

export default Student;
