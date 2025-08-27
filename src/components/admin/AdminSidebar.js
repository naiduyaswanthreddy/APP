import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  BarChart, 
  BookOpen, 
  Briefcase, 
  FileText, 
  Users, 
  Code, 
  User, 
  Image, 
  Bell,
  Building,
  Calendar,
  ClipboardList // Add Reports icon import
} from 'lucide-react';

const AdminSidebar = () => {
  const location = useLocation();

  const menuItems = [
    { path: '/admin/analytics', Icon: BarChart, label: 'Analytics' },
    { path: '/admin/reports', Icon: ClipboardList, label: 'Reports' },
    { path: '/admin/resources', Icon: BookOpen, label: 'Resources' },
    { path: '/admin/jobpost', Icon: Briefcase, label: 'Job Posting' },
    { path: '/admin/manage-applications', Icon: FileText, label: 'Manage Applications' },
    { path: '/admin/students', Icon: Users, label: 'Students' },
    { path: '/admin/companies', Icon: Building, label: 'Companies' },
    { path: '/admin/calendar', Icon: Calendar, label: 'Calendar' },
    { path: '/admin/coding', Icon: Code, label: 'Coding' },
    { path: '/admin/profile', Icon: User, label: 'Profile' },
    { path: '/admin/gallery', Icon: Image, label: 'Gallery' },
    { path: '/admin/notifications', Icon: Bell, label: 'Notifications' }
  ];

  return (
    <div className="h-screen w-64 bg-gradient-to-b from-indigo-800 via-blue-800 to-teal-700 text-white flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 p-4 border-b border-white border-opacity-10">
        <h2 className="text-xl font-bold">Admin</h2>
        <p className="text-sm opacity-75">AV.EN.U4CSE22100</p>
      </div>

      {/* Scrollable Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {menuItems.map((item) => {
          const IconComponent = item.Icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200
                ${location.pathname === item.path 
                  ? 'bg-white bg-opacity-15 shadow-lg' 
                  : 'hover:bg-white hover:bg-opacity-10 hover:shadow-md'}`}
            >
              <IconComponent size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Fixed Footer (Optional) */}
      <div className="flex-shrink-0 p-4 border-t border-white border-opacity-10">
        <div className="text-xs opacity-60 text-center">
          Placement Portal v2.0
        </div>
      </div>
    </div>
  );
};

export default AdminSidebar;