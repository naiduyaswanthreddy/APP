import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';
import { 
  Users, 
  Briefcase, 
  Building, 
  Calendar, 
  Bell, 
  TrendingUp, 
  Mail,
  Eye,
  EyeOff
} from 'lucide-react';
import PushNotificationManager from './PushNotificationManager';
import EmailManager from './EmailManager';
import LoadingSpinner from '../ui/LoadingSpinner';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [showPushManager, setShowPushManager] = useState(false);
  const [showEmailManager, setShowEmailManager] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeJobs: 0,
    totalCompanies: 0,
    totalEvents: 0,
  });
  const [recentActivity, setRecentActivity] = useState([
    { message: 'New student registered: John Doe', timestamp: '2 hours ago' },
    { message: 'New job posting: Software Engineer at Tech Corp', timestamp: '3 hours ago' },
    { message: 'New company added: ABC Solutions', timestamp: '4 hours ago' },
  ]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const studentsRef = collection(db, 'users');
        const q = query(studentsRef, where('role', '==', 'student'));
        const snapshot = await getDocs(q);
        setStats(prev => ({ ...prev, totalStudents: snapshot.size }));

        const jobsRef = collection(db, 'jobs');
        const qJobs = query(jobsRef, where('status', '==', 'active'));
        const snapshotJobs = await getDocs(qJobs);
        setStats(prev => ({ ...prev, activeJobs: snapshotJobs.size }));

        const companiesRef = collection(db, 'companies');
        const snapshotCompanies = await getDocs(companiesRef);
        setStats(prev => ({ ...prev, totalCompanies: snapshotCompanies.size }));

        const eventsRef = collection(db, 'events');
        const snapshotEvents = await getDocs(eventsRef);
        setStats(prev => ({ ...prev, totalEvents: snapshotEvents.size }));

      } catch (error) {
        toast.error('Failed to fetch dashboard statistics');
        console.error(error);
      }
    };

    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    fetchStats(); // Call fetchStats here
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">Overview of placement portal activities and statistics</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalStudents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Briefcase className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Jobs</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeJobs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Companies</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalCompanies}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Calendar className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Events</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalEvents}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Push Notifications Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Push Notifications</h2>
          <button
            onClick={() => setShowPushManager(!showPushManager)}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            {showPushManager ? <EyeOff size={16} className="mr-2" /> : <Eye size={16} className="mr-2" />}
            {showPushManager ? 'Hide' : 'Show'} Manager
          </button>
        </div>
        
        {showPushManager && <PushNotificationManager />}
      </div>

      {/* Email Notifications Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Email Notifications</h2>
          <button
            onClick={() => setShowEmailManager(!showEmailManager)}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
          >
            {showEmailManager ? <EyeOff size={16} className="mr-2" /> : <Eye size={16} className="mr-2" />}
            {showEmailManager ? 'Hide' : 'Show'} Email Manager
          </button>
        </div>
        
        {showEmailManager && <EmailManager />}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {recentActivity.map((activity, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                <p className="text-xs text-gray-500">{activity.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;