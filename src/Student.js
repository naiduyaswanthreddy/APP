import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
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
  Menu
} from 'lucide-react';
import LoadingSpinner from './components/ui/LoadingSpinner';
import Loader from './loading';

const Student = () => {
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
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle user data
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserData({
        name: user.displayName || "User",
        rollNumber: localStorage.getItem("rollNumber"),
      });
    }

    // Get initial unread count from localStorage
    const storedCount = localStorage.getItem('unreadNotificationsCount');
    if (storedCount) {
      setUnreadCount(parseInt(storedCount, 10));
    }

    // Listen for updates to unread count
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

  // Desktop layout
  if (!isMobile) {
    return (
      <div className="flex min-h-screen bg-gray-100">
        {/* Desktop Sidebar */}
        <div className="relative transition-all duration-300 ease-in-out" 
             style={{ width: isSidebarOpen ? '16rem' : '5rem' }}>
          <div className="fixed h-full w-64 bg-gradient-to-b from-indigo-900 to-teal-600 flex flex-col justify-between">
            <div>
              <div className="p-4 text-white">
                {/* Profile Section */}
                <div className={`mb-8 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'text-left' : 'text-center'}`}>
                  <div className="w-12 h-12 bg-white rounded-full mx-auto mb-2">
                    <img
                      src="/api/placeholder/48/48"
                      alt="Profile"
                      className="w-full h-full rounded-full"
                    />
                  </div>
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isSidebarOpen ? 'opacity-100 max-h-20' : 'opacity-0 max-h-0'
                  }`}>
                    <div className="font-semibold whitespace-nowrap">{userData.name}</div>
                    <div className="text-xs text-gray-300 whitespace-nowrap">{userData.rollNumber}</div>
                  </div>
                </div>

                {/* Navigation Menu */}
                <nav className="space-y-2">
                  {[
                    { name: "Notifications", path: "/student/notifications", icon: Bell },
                    { name: "Resources", path: "/student/resources", icon: BookOpen },
                    { name: "Job Posting", path: "/student/jobpost", icon: Briefcase },
                    { name: "Applications", path: "/student/applications", icon: FileText },
                    { name: "My Discussions", path: "/student/my-discussions", icon: MessageSquare },
                    { name: "Calendar", path: "/student/calendar", icon: Calendar },
                    { name: "Coding", path: "/student/coding", icon: Code },
                    { name: "Profile", path: "/student/profile", icon: User },
                    { name: "Gallery", path: "/student/gallery", icon: Image },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`w-full text-left px-4 py-2 rounded transition-colors flex items-center gap-3
                          ${isActive 
                            ? 'bg-white/20 text-white' 
                            : 'hover:bg-white/10 text-gray-300'}`}
                      >
                        <Icon size={20} />
                        {isSidebarOpen && <span>{item.name}</span>}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 rounded text-gray-300 hover:bg-white/10 flex items-center gap-3 mb-4"
            >
              <LogOut size={20} />
              {isSidebarOpen && 'Log Out'}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </div>
    );
  }

  // Mobile layout
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-30 md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu size={24} />
            </button>
            <h1 className="ml-3 text-lg font-semibold text-gray-900">Student Portal</h1>
          </div>
          
          {unreadCount > 0 && (
            <div className="relative">
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </div>
          )}
        </div>
      </header>
      
      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-indigo-900 to-teal-600 flex flex-col z-50 md:hidden transform transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 flex justify-between items-center">
            <div className="text-white">
              <div className="w-12 h-12 bg-white rounded-full mx-auto mb-2">
                <img
                  src="/api/placeholder/48/48"
                  alt="Profile"
                  className="w-full h-full rounded-full"
                />
              </div>
              <div className="text-center">
                <div className="font-semibold">{userData.name}</div>
                <div className="text-xs text-gray-300">{userData.rollNumber}</div>
              </div>
            </div>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="text-white hover:bg-white/10 p-2 rounded"
              aria-label="Close sidebar"
            >
              <ChevronLeft size={24} />
            </button>
          </div>

          <nav className="px-2 space-y-1">
            {[
              { name: "Notifications", path: "/student/notifications", icon: Bell },
              { name: "Resources", path: "/student/resources", icon: BookOpen },
              { name: "Job Posting", path: "/student/jobpost", icon: Briefcase },
              { name: "Applications", path: "/student/applications", icon: FileText },
              { name: "Calendar", path: "/student/calendar", icon: Calendar },
              { name: "Coding", path: "/student/coding", icon: Code },
              { name: "Profile", path: "/student/profile", icon: User },
              { name: "Gallery", path: "/student/gallery", icon: Image },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors
                    ${isActive 
                      ? 'bg-white/20 text-white' 
                      : 'hover:bg-white/10 text-gray-300'}`}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <button 
          onClick={handleLogout}
          className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-white/10 flex items-center gap-3 mb-4"
        >
          <LogOut size={20} />
          <span>Log Out</span>
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 pt-16 pb-20">
        <div className="p-4">
          <Outlet />
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:hidden">
        <div className="flex justify-around items-center h-16">
          {[
            { name: 'Notifications', path: '/student/notifications', icon: Bell },
            { name: 'Jobs', path: '/student/jobpost', icon: Briefcase },
            { name: 'Applications', path: '/student/applications', icon: FileText },
            { name: 'My Discussions', path: '/student/my-discussions', icon: MessageSquare },
            { name: 'Calendar', path: '/student/calendar', icon: Calendar },
            { name: 'Profile', path: '/student/profile', icon: User },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 py-2 px-1 transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
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
};

export default Student;
