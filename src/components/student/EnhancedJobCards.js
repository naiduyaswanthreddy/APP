import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from 'react-router-dom';
import { JobCardsSkeleton } from '../ui/SkeletonLoaders';
import { ContentLoader, PageTransition, StaggeredList } from '../ui/PageTransition';
import { useApiCache } from '../../hooks/useApiCache';
import { getCurrentStudentRollNumber } from '../../utils/studentIdentity';

const EnhancedJobCards = () => {
  const navigate = useNavigate();
  const [studentProfile, setStudentProfile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    jobTypes: [],
    eligibleOnly: false,
    appliedOnly: false,
    savedOnly: false
  });

  // Cached API calls
  const { data: jobs, loading: jobsLoading, refetch: refetchJobs } = useApiCache(
    'jobs',
    async () => {
      const jobsRef = collection(db, 'jobs');
      const jobsQuery = query(jobsRef, orderBy('deadline', 'desc'));
      const snapshot = await getDocs(jobsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        deadline: doc.data().deadline ? new Date(doc.data().deadline) : null
      }));
    },
    { ttl: 300000, staleWhileRevalidate: true } // 5 minutes cache with background refresh
  );

  const { data: savedJobs, loading: savedLoading } = useApiCache(
    'savedJobs',
    async () => {
      const user = auth.currentUser;
      if (!user) return [];
      
      const roll = await getCurrentStudentRollNumber();
      const savedJobsRef = collection(db, 'saved_jobs');
      const q = roll
        ? query(savedJobsRef, where('student_rollNumber', '==', roll))
        : query(savedJobsRef, where('student_id', '==', user.uid));
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data().job_id);
    },
    { ttl: 180000 } // 3 minutes cache
  );

  const { data: appliedJobs, loading: appliedLoading } = useApiCache(
    'appliedJobs',
    async () => {
      const user = auth.currentUser;
      if (!user) return { jobIds: [], statuses: {} };
      
      const roll = await getCurrentStudentRollNumber();
      const applicationsRef = collection(db, 'applications');
      const q = roll
        ? query(applicationsRef, where('student_rollNumber', '==', roll))
        : query(applicationsRef, where('student_id', '==', user.uid));
      
      const snapshot = await getDocs(q);
      const jobIds = [];
      const statuses = {};
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const jobId = data.jobId || data.job_id;
        if (jobId) {
          jobIds.push(jobId);
          statuses[jobId] = data.status;
        }
      });
      
      return { jobIds, statuses };
    },
    { ttl: 120000 } // 2 minutes cache
  );

  // Load student profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        
        const studentDoc = await getDocs(query(collection(db, 'students'), where('uid', '==', user.uid)));
        if (!studentDoc.empty) {
          const data = studentDoc.docs[0].data();
          setStudentProfile({
            ...data,
            skills: Array.isArray(data.skills) ? data.skills : []
          });
        }
      } catch (error) {
        console.error('Error fetching student profile:', error);
      }
    };
    
    fetchProfile();
  }, []);

  // Check eligibility
  const checkEligibility = (job) => {
    if (!studentProfile) return false;
    
    const studentCGPA = parseFloat(studentProfile.cgpa) || 0;
    const requiredCGPA = parseFloat(job.minCGPA) || 0;
    const isCgpaEligible = studentCGPA >= requiredCGPA;
    
    const studentSkills = studentProfile.skills?.map(skill => skill.toLowerCase()) || [];
    const requiredSkills = job.skills?.map(skill => skill.toLowerCase()) || [];
    const hasRequiredSkills = requiredSkills.length === 0 || 
      requiredSkills.every(skill => studentSkills.includes(skill));
    
    return isCgpaEligible && hasRequiredSkills;
  };

  // Filter and search jobs
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    
    return jobs.filter(job => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          job.position?.toLowerCase().includes(searchLower) ||
          job.company?.toLowerCase().includes(searchLower) ||
          job.location?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      // Job type filter
      if (filters.jobTypes.length > 0 && !filters.jobTypes.includes(job.jobTypes)) {
        return false;
      }
      
      // Eligibility filter
      if (filters.eligibleOnly && !checkEligibility(job)) {
        return false;
      }
      
      // Applied filter
      if (filters.appliedOnly && !appliedJobs?.jobIds?.includes(job.id)) {
        return false;
      }
      
      // Saved filter
      if (filters.savedOnly && !savedJobs?.includes(job.id)) {
        return false;
      }
      
      return true;
    });
  }, [jobs, searchTerm, filters, studentProfile, appliedJobs, savedJobs]);

  const loading = jobsLoading || savedLoading || appliedLoading;

  const handleViewDetails = (jobId) => {
    navigate(`/student/job/${jobId}`);
  };

  const JobCard = ({ job }) => {
    const isEligible = checkEligibility(job);
    const isApplied = appliedJobs?.jobIds?.includes(job.id);
    const isSaved = savedJobs?.includes(job.id);
    const applicationStatus = appliedJobs?.statuses?.[job.id];
    
    const getTimeRemaining = (deadline) => {
      if (!deadline) return null;
      const now = new Date();
      const timeRemaining = deadline - now;
      if (timeRemaining <= 0) return 'Expired';
      
      const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (days > 0) return `${days}d ${hours}h`;
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    };

    const timeRemaining = getTimeRemaining(job.deadline);
    const isExpired = timeRemaining === 'Expired';

    return (
      <div className={`bg-white rounded-lg shadow-md p-6 border-l-4 transition-all duration-200 hover:shadow-lg ${
        isExpired ? 'border-red-500 opacity-75' : 
        isEligible ? 'border-green-500' : 'border-gray-300'
      }`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{job.position}</h3>
            <p className="text-gray-600">{job.company}</p>
            <p className="text-sm text-gray-500">{job.location}</p>
          </div>
          <div className="flex flex-col items-end space-y-2">
            {isApplied && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                applicationStatus === 'selected' ? 'bg-green-100 text-green-800' :
                applicationStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                applicationStatus === 'shortlisted' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {applicationStatus || 'Applied'}
              </span>
            )}
            {isSaved && (
              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                Saved
              </span>
            )}
          </div>
        </div>

        {/* Job details */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
              {job.jobTypes}
            </span>
            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
              {job.workMode}
            </span>
          </div>
          
          {job.ctc && (
            <p className="text-sm text-gray-600">CTC: ₹{job.ctc} LPA</p>
          )}
          
          {timeRemaining && (
            <p className={`text-sm ${isExpired ? 'text-red-600' : 'text-green-600'}`}>
              {isExpired ? 'Application deadline passed' : `${timeRemaining} remaining`}
            </p>
          )}
        </div>

        {/* Skills */}
        {job.skills && job.skills.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1">
              {job.skills.slice(0, 3).map((skill, index) => (
                <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                  {skill}
                </span>
              ))}
              {job.skills.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                  +{job.skills.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Eligibility status */}
        <div className="mb-4">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            isEligible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isEligible ? '✓ Eligible' : '✗ Not Eligible'}
          </span>
        </div>

        {/* Action button */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => handleViewDetails(job.id)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Details
          </button>
        </div>
      </div>
    );
  };

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <ToastContainer style={{ zIndex: 9999 }} />
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Job Opportunities</h1>
          
          {/* Search and Filters */}
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by position, company, or location..."
                className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                🔍
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilters(prev => ({ ...prev, eligibleOnly: !prev.eligibleOnly }))}
                className={`px-3 py-1 rounded-lg text-sm transition ${
                  filters.eligibleOnly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Eligible Only
              </button>
              <button
                onClick={() => setFilters(prev => ({ ...prev, appliedOnly: !prev.appliedOnly }))}
                className={`px-3 py-1 rounded-lg text-sm transition ${
                  filters.appliedOnly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Applied Only
              </button>
              <button
                onClick={() => setFilters(prev => ({ ...prev, savedOnly: !prev.savedOnly }))}
                className={`px-3 py-1 rounded-lg text-sm transition ${
                  filters.savedOnly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Saved Only
              </button>
            </div>
          </div>
        </div>

        {/* Job Cards */}
        <ContentLoader
          loading={loading}
          skeleton={<JobCardsSkeleton count={6} />}
          minHeight="400px"
        >
          {filteredJobs.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <h3 className="text-xl font-medium text-gray-700 mb-2">No jobs found</h3>
              <p className="text-gray-500">Try adjusting your search criteria or filters.</p>
            </div>
          ) : (
            <StaggeredList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </StaggeredList>
          )}
        </ContentLoader>
      </div>
    </PageTransition>
  );
};

export default EnhancedJobCards;
