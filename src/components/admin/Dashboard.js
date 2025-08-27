import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';
import { 
  Users, 
  Briefcase, 
  Building, 
  Eye,
  EyeOff,
  UserX,
  AlertTriangle
} from 'lucide-react';
import PushNotificationManager from './PushNotificationManager';
import EmailManager from './EmailManager';
import BulkFreezeModal from './BulkFreezeModal';
import FrozenStudents from './FrozenStudents';
import LoadingSpinner from '../ui/LoadingSpinner';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [showPushManager, setShowPushManager] = useState(false);
  const [showEmailManager, setShowEmailManager] = useState(false);
  const [showBulkFreezeModal, setShowBulkFreezeModal] = useState(false);
  const [showFrozenStudents, setShowFrozenStudents] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeJobs: 0,
    totalCompanies: 0,
    frozenStudents: 0,
  });
  

  const fetchStats = async () => {
    try {
      // Fix: count students from 'students' collection
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      setStats(prev => ({ ...prev, totalStudents: snapshot.size }));

      const jobsRef = collection(db, 'jobs');
      const qJobs = query(jobsRef, where('status', '==', 'active'));
      const snapshotJobs = await getDocs(qJobs);
      setStats(prev => ({ ...prev, activeJobs: snapshotJobs.size }));

      const companiesRef = collection(db, 'companies');
      const snapshotCompanies = await getDocs(companiesRef);
      setStats(prev => ({ ...prev, totalCompanies: snapshotCompanies.size }));

      // Fetch frozen students count
      const frozenStudentsRef = collection(db, 'students');
      const qFrozen = query(frozenStudentsRef, where('freezed.active', '==', true));
      const snapshotFrozen = await getDocs(qFrozen);
      setStats(prev => ({ ...prev, frozenStudents: snapshotFrozen.size }));

    } catch (error) {
      toast.error('Failed to fetch dashboard statistics');
      console.error(error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    fetchStats();
    return () => clearTimeout(timer);
  }, [refreshTrigger]);

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
            <div className="p-2 bg-red-100 rounded-lg">
              <UserX className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Frozen Students</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.frozenStudents}</p>
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

      {/* Student Management Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Student Management</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFrozenStudents(true)}
              className="flex items-center px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm"
            >
              <AlertTriangle size={16} className="mr-2" />
              View Frozen Students ({stats.frozenStudents})
            </button>
            <button
              onClick={() => setShowBulkFreezeModal(true)}
              className="flex items-center px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
            >
              <UserX size={16} className="mr-2" />
              Bulk Freeze/Unfreeze
            </button>
          </div>
        </div>
        <p className="text-gray-600 text-sm">
          Manage student account status in bulk. Freeze accounts to prevent job applications or unfreeze to restore access.
        </p>
      </div>

      {/* Removed Data Migration and Recent Activity sections as requested */}

      {/* Bulk Freeze Modal */}
      <BulkFreezeModal 
        isOpen={showBulkFreezeModal} 
        onClose={() => {
          setShowBulkFreezeModal(false);
          // Refresh stats after bulk operations
          setRefreshTrigger(prev => prev + 1);
        }} 
      />
      {/* Frozen Students */}
      <FrozenStudents 
        isOpen={showFrozenStudents} 
        onClose={() => {
          setShowFrozenStudents(false);
          // Refresh stats after unfreeze operations
          setRefreshTrigger(prev => prev + 1);
        }} 
      />
    </div>
  );
};

export default Dashboard;