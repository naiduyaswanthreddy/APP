import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Bell, 
  BookOpen, 
  Briefcase, 
  FileText, 
  Code, 
  User, 
  Image, 
  Calendar,
  LogOut,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';

const MobileSidebar = ({ isOpen, onClose, userData, unreadCount, onLogout }) => {
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);

  const menuItems = [
    // Notifications removed from sidebar per requirement
    { name: "Resources", path: "/student/resources", icon: BookOpen },
    { name: "Job Posting", path: "/student/jobpost", icon: Briefcase },
    { name: "Applications", path: "/student/applications", icon: FileText },
    { name: "Calendar", path: "/student/calendar", icon: Calendar },
    { name: "Coding", path: "/student/coding", icon: Code },
    { name: "Profile", path: "/student/profile", icon: User },
    { name: "Gallery", path: "/student/gallery", icon: Image },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-[1090] md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-indigo-900 to-teal-600 flex flex-col z-[1110] md:hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Header */}
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
                <div className="font-semibold">{userData?.name}</div>
                <div className="text-xs text-gray-300">{userData?.rollNumber}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/10 p-2 rounded"
              aria-label="Close sidebar"
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="px-2 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors
                  ${location.pathname === item.path
                    ? 'bg-white/20 text-white' 
                    : 'hover:bg-white/10 text-gray-300'}`}
              >
                <item.icon size={20} />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom Controls: Theme, Notifications & Logout (icon-only) */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center justify-start gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-white hover:bg-white/10"
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
            </button>
            <button
              onClick={() => {
                // navigate to notifications
                window.location.href = '#/student/notifications';
                onClose();
              }}
              className="relative p-2 rounded-full text-white hover:bg-white/10"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                if (onLogout) onLogout();
                onClose();
              }}
              className="p-2 rounded-full text-white hover:bg-white/10"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={22} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileSidebar;
