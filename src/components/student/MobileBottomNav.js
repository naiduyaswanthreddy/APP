import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Briefcase, FileText, Calendar, User, MessageSquare } from 'lucide-react';

const MobileBottomNav = () => {
  const location = useLocation();
  
  const navItems = [
    { name: 'Notifications', path: '/student/notifications', icon: Bell },
    { name: 'Jobs', path: '/student/jobpost', icon: Briefcase },
    { name: 'Applications', path: '/student/applications', icon: FileText },
    { name: 'My Discussions', path: '/student/my-discussions', icon: MessageSquare },
    { name: 'Profile', path: '/student/profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[60] md:hidden safe-bottom">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-2 px-1 transition-colors duration-200 ${
                isActive 
                  ? 'text-indigo-600' 
                  : 'text-gray-600 hover:text-indigo-600'
              }`}
              aria-label={item.name}
            >
              <Icon size={20} />
              <span className="text-xs mt-1 text-center w-full">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
