import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { toast } from "react-toastify";
import { useNavigate } from 'react-router-dom';
import Loader from '../../loading';
import { useFirebaseQuery } from '../../hooks/useFirebaseQuery';
import VirtualizedList from '../common/VirtualizedList';
import { createDebouncedSearch, cacheManager, performanceMetrics } from '../../utils/performanceOptimizer';
import { formatAmount } from '../../utils/formatAmount';

// Memoized job card component
const JobCard = memo(({ 
  job, 
  isEligible, 
  isApplied, 
  isSaved, 
  applicationStatus,
  onSave, 
  onUnsave, 
  onViewDetails,
  skillMatch 
}) => {
  const getTimeRemaining = useCallback((deadline) => {
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
  }, []);

  const timeRemaining = useMemo(() => getTimeRemaining(job.deadline), [job.deadline, getTimeRemaining]);
  const isExpired = timeRemaining === 'Expired';

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border-l-4 transition-all duration-200 hover:shadow-lg ${
      isExpired ? 'border-red-500 opacity-75' : 
      isEligible ? 'border-green-500' : 'border-gray-300'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{job.position}</h3>
          <p className="text-lg font-medium text-blue-600 mb-1">{job.company}</p>
          <p className="text-gray-600 mb-2">{job.location}</p>
          
          {/* Job Types */}
          <div className="flex flex-wrap gap-2 mb-3">
            {job.jobTypes?.map((type, index) => (
              <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                {type}
              </span>
            ))}
          </div>
        </div>
        
        {/* Status indicators */}
        <div className="flex flex-col items-end space-y-2">
          {isApplied && (
            <span className={`px-2 py-1 text-xs rounded-full ${
              applicationStatus === 'selected' ? 'bg-green-100 text-green-800' :
              applicationStatus === 'rejected' ? 'bg-red-100 text-red-800' :
              applicationStatus === 'withdrawn' ? 'bg-gray-100 text-gray-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {applicationStatus || 'Applied'}
            </span>
          )}
          
          {skillMatch > 0 && (
            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
              {skillMatch}% match
            </span>
          )}
          
          {isEligible && !isApplied && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              Eligible
            </span>
          )}
        </div>
      </div>

      {/* Compensation */}
      <div className="mb-4">
        {job.jobTypes?.includes('Internship') ? (
          <p className="text-lg font-semibold text-green-600">
            ₹{formatAmount(job.salary || job.minSalary || job.maxSalary) || 'Not specified'} /month
          </p>
        ) : (
          <p className="text-lg font-semibold text-green-600">
            ₹{formatAmount(job.ctc || job.minCtc || job.maxCtc) || 'Not specified'} LPA
          </p>
        )}
      </div>

      {/* Skills */}
      {job.skills && job.skills.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Required Skills:</p>
          <div className="flex flex-wrap gap-1">
            {job.skills.slice(0, 5).map((skill, index) => (
              <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                {skill}
              </span>
            ))}
            {job.skills.length > 5 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                +{job.skills.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Deadline */}
      {job.deadline && (
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Deadline: {job.deadline.toLocaleDateString()} 
            {timeRemaining && (
              <span className={`ml-2 font-medium ${isExpired ? 'text-red-600' : 'text-orange-600'}`}>
                ({timeRemaining})
              </span>
            )}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <button
          onClick={() => onViewDetails(job.id)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          View Details
        </button>
        
        <button
          onClick={() => isSaved ? onUnsave(job.id) : onSave(job.id)}
          className={`px-4 py-2 rounded-lg transition-colors ${
            isSaved 
              ? 'bg-red-100 text-red-700 hover:bg-red-200' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {isSaved ? 'Unsave' : 'Save'}
        </button>
      </div>
    </div>
  );
});

JobCard.displayName = 'JobCard';

const OptimizedJobCards = () => {
  const navigate = useNavigate();
  const [studentProfile, setStudentProfile] = useState(null);
  const [savedJobs, setSavedJobs] = useState([]);
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [applicationStatuses, setApplicationStatuses] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    jobTypes: [],
    eligibleOnly: false,
    appliedOnly: false,
    savedOnly: false
  });

  // Optimized job fetching with pagination
  const jobQueryConfig = useMemo(() => ({
    pageSize: 20,
    orderByField: 'deadline',
    orderDirection: 'desc',
    whereConditions: filters.eligibleOnly && studentProfile ? [
      { field: 'minCGPA', operator: '<=', value: studentProfile.cgpa || 0 }
    ] : [],
    enableCache: true,
    cacheKey: `jobs_${JSON.stringify(filters)}_${searchTerm}`
  }), [filters, studentProfile, searchTerm]);

  const { 
    data: jobs, 
    loading: jobsLoading, 
    hasMore, 
    loadMore, 
    refresh: refreshJobs 
  } = useFirebaseQuery('jobs', jobQueryConfig);

  // Debounced search
  const debouncedSearch = useMemo(
    () => createDebouncedSearch((term) => {
      setSearchTerm(term);
    }, 300),
    []
  );

  // Fetch student profile with caching
  const fetchStudentProfile = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const cachedProfile = cacheManager.get(`student_profile_${user.uid}`);
      if (cachedProfile) {
        setStudentProfile(cachedProfile);
        return;
      }

      const studentDoc = await performanceMetrics.measureAsyncOperation(
        'fetchStudentProfile',
        () => getDoc(doc(db, 'students', user.uid))
      );

      const studentData = studentDoc.data() || {};
      const profile = {
        ...studentData,
        cgpa: studentData.cgpa || 0,
        skills: Array.isArray(studentData.skills) ? studentData.skills : []
      };

      setStudentProfile(profile);
      cacheManager.set(`student_profile_${user.uid}`, profile, 600000); // 10 minutes cache
    } catch (error) {
      console.error('Error fetching student profile:', error);
      toast.error('Failed to fetch profile data');
    }
  }, []);

  // Optimized saved jobs fetching
  const fetchSavedJobs = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const cachedSaved = cacheManager.get(`saved_jobs_${user.uid}`);
      if (cachedSaved) {
        setSavedJobs(cachedSaved);
        return;
      }

      const savedJobsRef = collection(db, 'saved_jobs');
      const q = query(savedJobsRef, where('student_id', '==', user.uid), limit(100));
      const querySnapshot = await getDocs(q);
      const savedJobIds = querySnapshot.docs.map(doc => doc.data().job_id);
      
      setSavedJobs(savedJobIds);
      cacheManager.set(`saved_jobs_${user.uid}`, savedJobIds, 300000); // 5 minutes cache
    } catch (error) {
      console.error('Error fetching saved jobs:', error);
    }
  }, []);

  // Optimized applied jobs fetching
  const fetchAppliedJobs = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const cachedApplied = cacheManager.get(`applied_jobs_${user.uid}`);
      if (cachedApplied) {
        setAppliedJobs(cachedApplied.jobIds);
        setApplicationStatuses(cachedApplied.statuses);
        return;
      }

      const applicationsRef = collection(db, 'applications');
      const q = query(applicationsRef, where('student_id', '==', user.uid), limit(100));
      const querySnapshot = await getDocs(q);

      const jobIds = [];
      const statuses = {};

      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        const jobId = data.jobId || data.job_id;
        if (jobId) {
          jobIds.push(jobId);
          statuses[jobId] = data.status;
        }
      });

      setAppliedJobs(jobIds);
      setApplicationStatuses(statuses);
      
      const cacheData = { jobIds, statuses };
      cacheManager.set(`applied_jobs_${user.uid}`, cacheData, 300000); // 5 minutes cache
    } catch (error) {
      console.error('Error fetching applied jobs:', error);
    }
  }, []);

  // Eligibility check with memoization
  const checkEligibility = useCallback((job) => {
    if (!studentProfile) return false;

    const studentCGPA = parseFloat(studentProfile.cgpa) || 0;
    const requiredCGPA = parseFloat(job.minCGPA) || 0;
    const isCgpaEligible = studentCGPA >= requiredCGPA;

    const studentSkills = studentProfile.skills?.map(skill => skill.toLowerCase()) || [];
    const requiredSkills = job.skills?.map(skill => skill.toLowerCase()) || [];
    const hasRequiredSkills = requiredSkills.length === 0 || 
      requiredSkills.every(skill => studentSkills.includes(skill));

    return isCgpaEligible && hasRequiredSkills;
  }, [studentProfile]);

  // Calculate skill match percentage
  const calculateSkillMatch = useCallback((job) => {
    if (!job?.skills || !studentProfile?.skills) return 0;

    const studentSkills = studentProfile.skills.map(skill => skill.toLowerCase());
    const requiredSkills = job.skills.map(skill => skill.toLowerCase());
    
    if (requiredSkills.length === 0) return 100;

    const matchedSkills = requiredSkills.filter(skill => 
      studentSkills.includes(skill)
    );
    return Math.round((matchedSkills.length / requiredSkills.length) * 100);
  }, [studentProfile]);

  // Filter and search jobs
  const filteredJobs = useMemo(() => {
    let filtered = jobs;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(job =>
        job.position?.toLowerCase().includes(searchLower) ||
        job.company?.toLowerCase().includes(searchLower) ||
        job.location?.toLowerCase().includes(searchLower) ||
        job.skills?.some(skill => skill.toLowerCase().includes(searchLower))
      );
    }

    // Apply other filters
    if (filters.jobTypes.length > 0) {
      filtered = filtered.filter(job =>
        job.jobTypes?.some(type => filters.jobTypes.includes(type))
      );
    }

    if (filters.eligibleOnly) {
      filtered = filtered.filter(checkEligibility);
    }

    if (filters.appliedOnly) {
      filtered = filtered.filter(job => appliedJobs.includes(job.id));
    }

    if (filters.savedOnly) {
      filtered = filtered.filter(job => savedJobs.includes(job.id));
    }

    return filtered;
  }, [jobs, searchTerm, filters, checkEligibility, appliedJobs, savedJobs]);

  // Job card actions
  const handleSaveJob = useCallback(async (jobId) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      await addDoc(collection(db, 'saved_jobs'), {
        job_id: jobId,
        student_id: user.uid,
        saved_at: serverTimestamp()
      });

      setSavedJobs(prev => [...prev, jobId]);
      cacheManager.clear(`saved_jobs_${user.uid}`);
      toast.success("Job saved successfully!");
    } catch (error) {
      console.error('Error saving job:', error);
      toast.error("Error saving job!");
    }
  }, []);

  const handleUnsaveJob = useCallback(async (jobId) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const savedJobsQuery = query(
        collection(db, "saved_jobs"),
        where("job_id", "==", jobId),
        where("student_id", "==", user.uid)
      );

      const querySnapshot = await getDocs(savedJobsQuery);
      for (const docSnap of querySnapshot.docs) {
        await deleteDoc(doc(db, "saved_jobs", docSnap.id));
      }

      setSavedJobs(prev => prev.filter(id => id !== jobId));
      cacheManager.clear(`saved_jobs_${user.uid}`);
      toast.success("Job unsaved successfully!");
    } catch (error) {
      console.error("Error unsaving job:", error);
      toast.error("Error unsaving job!");
    }
  }, []);

  const handleViewDetails = useCallback((jobId) => {
    navigate(`/student/job/${jobId}`);
  }, [navigate]);

  // Render job card for virtualized list
  const renderJobCard = useCallback((job, index) => {
    const isEligible = checkEligibility(job);
    const isApplied = appliedJobs.includes(job.id);
    const isSaved = savedJobs.includes(job.id);
    const applicationStatus = applicationStatuses[job.id];
    const skillMatch = calculateSkillMatch(job);

    return (
      <div key={job.id} className="p-2">
        <JobCard
          job={job}
          isEligible={isEligible}
          isApplied={isApplied}
          isSaved={isSaved}
          applicationStatus={applicationStatus}
          skillMatch={skillMatch}
          onSave={handleSaveJob}
          onUnsave={handleUnsaveJob}
          onViewDetails={handleViewDetails}
        />
      </div>
    );
  }, [
    checkEligibility,
    appliedJobs,
    savedJobs,
    applicationStatuses,
    calculateSkillMatch,
    handleSaveJob,
    handleUnsaveJob,
    handleViewDetails
  ]);

  // Initialize data
  useEffect(() => {
    fetchStudentProfile();
    fetchSavedJobs();
    fetchAppliedJobs();
  }, [fetchStudentProfile, fetchSavedJobs, fetchAppliedJobs]);

  // Clear expired cache on mount
  useEffect(() => {
    cacheManager.clearExpired();
  }, []);

  if (!studentProfile) {
    return <Loader />;
  }

  return (
    <div className="p-4 space-y-4">
      
      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by position, company, location, or skills"
              className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              onChange={(e) => debouncedSearch(e.target.value)}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilters(prev => ({ ...prev, eligibleOnly: !prev.eligibleOnly }))}
              className={`px-3 py-1 text-sm rounded-lg transition ${
                filters.eligibleOnly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Eligible Only
            </button>
            
            <button
              onClick={() => setFilters(prev => ({ ...prev, appliedOnly: !prev.appliedOnly }))}
              className={`px-3 py-1 text-sm rounded-lg transition ${
                filters.appliedOnly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Applied Jobs
            </button>
            
            <button
              onClick={() => setFilters(prev => ({ ...prev, savedOnly: !prev.savedOnly }))}
              className={`px-3 py-1 text-sm rounded-lg transition ${
                filters.savedOnly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Saved Jobs
            </button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {filteredJobs.length} jobs
        {hasMore && ' (scroll down for more)'}
      </div>

      {/* Virtualized Job List */}
      <div className="h-screen">
        <VirtualizedList
          items={filteredJobs}
          renderItem={renderJobCard}
          itemHeight={280}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={jobsLoading}
        />
      </div>
    </div>
  );
};

export default OptimizedJobCards;
