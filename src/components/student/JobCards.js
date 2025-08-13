import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, addDoc, doc, getDoc, where, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { createJobPostingNotification } from '../../utils/notificationHelpers';
import { useNavigate } from 'react-router-dom';
import Loader from '../../loading'; // Add this import at the top

const JobCards = () => {
  const navigate = useNavigate();
  // State declarations
  const [jobs, setJobs] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [applicationStatuses, setApplicationStatuses] = useState({});
  const [studentProfile, setStudentProfile] = useState({
    cgpa: 0,
    skills: [],
    batch: '',
  });
  const [viewSavedJobs, setViewSavedJobs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewSelectedStudents, setViewSelectedStudents] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  
  // Filter states
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    jobTypes: [],
    jobStatus: [],
    locations: [],
    workModes: [],
    minStipend: '',
    maxStipend: '',
    minCTC: '',
    maxCTC: '',
    minCGPA: '',
    eligibleBatches: [],
    skills: [],
    showWithdrawn: true
  });
  const [sortBy, setSortBy] = useState('deadline');
  const [sortOrder, setSortOrder] = useState('desc'); // Changed from 'asc' to 'desc'
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchJobs();
    fetchStudentProfile();
    fetchSavedJobs();
    fetchAppliedJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const jobsRef = collection(db, 'jobs');
      const jobsQuery = query(jobsRef, orderBy('deadline', 'desc'));
      const querySnapshot = await getDocs(jobsQuery);
      const jobsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        deadline: doc.data().deadline ? new Date(doc.data().deadline) : null,
        deadlineString: doc.data().deadline ? new Date(doc.data().deadline).toLocaleString() : 'No deadline',
        interviewDateTime: doc.data().interviewDateTime ? new Date(doc.data().interviewDateTime).toLocaleString() : 'Not scheduled'
      }));
      
      setJobs(jobsData);
      
      // Check for any new jobs since last fetch
      const lastFetchTime = localStorage.getItem('lastJobsFetchTime');
      const user = auth.currentUser;
      if (lastFetchTime && user) {
        const lastFetchDate = new Date(parseInt(lastFetchTime, 10));
        jobsData.forEach(job => {
          // If the job was created after the last fetch, create a notification
          if (job.created_at && new Date(job.created_at.seconds * 1000) > lastFetchDate) {
            // Check if the job matches student's skills or criteria
            const studentSkills = studentProfile.skills || [];
            const jobSkills = job.eligibilityCriteria?.skills || [];
            
            // Simple matching algorithm - if any skill matches
            const hasMatchingSkill = jobSkills.some(skill => 
              studentSkills.map(s => s.toLowerCase()).includes(skill.toLowerCase())
            );
            
            if (hasMatchingSkill) {
              createJobPostingNotification(user.uid, job);
            }
          }
        });
      }
      
      // Update the last fetch time
      localStorage.setItem('lastJobsFetchTime', Date.now().toString());
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const studentDoc = await getDoc(doc(db, 'students', user.uid));
      const studentData = studentDoc.data() || {};

      setStudentProfile({
        ...studentData,
        cgpa: studentData.cgpa || 0,
        currentArrears: studentData.currentArrears || 0,
        historyArrears: studentData.historyArrears || 0,
        gender: studentData.gender || '',
        batch: studentData.batch || '',
        skills: Array.isArray(studentData.skills) 
                ? studentData.skills 
                : (typeof studentData.skills === 'string' && studentData.skills) 
                  ? [studentData.skills] 
                  : [],
        academicInfo: studentData.academicInfo || '',
        department: studentData.department || '',
        email: studentData.email || '',
        github: studentData.github || '',
        hackerrank: studentData.hackerrank || '',
        leetcode: studentData.leetcode || '',
        mobile: studentData.mobile || '',
        name: studentData.name || '',
        passoutYear: studentData.passoutYear || '',
        program: studentData.program || '',
        resumeLink: studentData.resumeLink || '',
        rollNumber: studentData.rollNumber || '',
        createdAt: studentData.createdAt,
      });
    } catch (error) {
      console.error('Error fetching student profile:', error);
      toast.error('Failed to fetch profile data');
    }
  };

  const fetchSavedJobs = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const savedJobsRef = collection(db, 'saved_jobs');
        const q = query(savedJobsRef, where('student_id', '==', user.uid));
        const querySnapshot = await getDocs(q);
        setSavedJobs(querySnapshot.docs.map(doc => doc.data().job_id));
      }
    } catch (error) {
      toast.error("Error fetching saved jobs!");
    }
  };

  const fetchAppliedJobs = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const applicationsRef = collection(db, 'applications');
        const q = query(applicationsRef, where('student_id', '==', user.uid));
        const querySnapshot = await getDocs(q);
        
        // Store job IDs and statuses
        const jobIds = [];
        const statuses = {};
        
        querySnapshot.docs.forEach(doc => {
          const data = doc.data();
          jobIds.push(data.job_id);
          statuses[data.job_id] = data.status;
        });
        
        setAppliedJobs(jobIds);
        setApplicationStatuses(statuses);
      }
    } catch (error) {
      toast.error("Error fetching applications!");
    }
  };

  const handleSaveJob = async (jobId) => {
    try {
      const user = auth.currentUser;
      if (user) {
        await addDoc(collection(db, 'saved_jobs'), {
          job_id: jobId,
          student_id: user.uid,
          saved_at: serverTimestamp()
        });
        setSavedJobs([...savedJobs, jobId]);
        toast.success("Job saved successfully!");
      }
    } catch (error) {
      toast.error("Error saving job!");
    }
  };

  const handleViewDetails = (jobId) => {
    navigate(`/student/job/${jobId}`);
  };

  const checkEligibility = (job) => {
    // Ensure student profile exists
    if (!studentProfile) {
      return false;
    }

    // Convert CGPAs to numbers and compare
    const studentCGPA = parseFloat(studentProfile.cgpa) || 0;
    const requiredCGPA = parseFloat(job.minCGPA) || 0;
    const isCgpaEligible = studentCGPA >= requiredCGPA;

    // Case-insensitive skill matching
    const studentSkills = studentProfile.skills?.map(skill => skill.toLowerCase()) || [];
    const requiredSkills = job.skills?.map(skill => skill.toLowerCase()) || [];
    const hasRequiredSkills = requiredSkills.length === 0 || 
      requiredSkills.every(skill => studentSkills.includes(skill));

    // Batch checking - ensure all values are strings before calling toLowerCase()
    const studentBatch = String(studentProfile.batch || '').toLowerCase();
    const eligibleBatches = job.eligibleBatch?.map(batch => String(batch)).map(batch => batch.toLowerCase()) || [];
    const isBatchEligible = eligibleBatches.length === 0 || 
      eligibleBatches.some(batch => studentBatch.includes(batch) || batch.includes(studentBatch));

    // Gender preference
    const studentGender = studentProfile.gender?.toLowerCase() || '';
    const genderPref = job.genderPreference?.toLowerCase() || 'any';
    const isGenderEligible = genderPref === 'any' || genderPref === studentGender;

    // Arrears checking
    const studentCurrentArrears = parseInt(studentProfile.currentArrears || 0);
    const maxCurrentArrears = parseInt(job.maxCurrentArrears || 0);
    const isCurrentArrearsEligible = maxCurrentArrears === 0 || studentCurrentArrears <= maxCurrentArrears;

    const studentHistoryArrears = parseInt(studentProfile.historyArrears || 0);
    const maxHistoryArrears = parseInt(job.maxHistoryArrears || 0);
    const isHistoryArrearsEligible = maxHistoryArrears === 0 || studentHistoryArrears <= maxHistoryArrears;

    return isCgpaEligible && hasRequiredSkills && isBatchEligible && 
           isGenderEligible && isCurrentArrearsEligible && isHistoryArrearsEligible;
  };

  const getEligibilityDetails = (job) => {
    const reasons = [];
    
    // CGPA check
    const studentCGPA = parseFloat(studentProfile.cgpa) || 0;
    const requiredCGPA = parseFloat(job.minCGPA) || 0;
    if (studentCGPA < requiredCGPA) {
      reasons.push(`CGPA requirement not met (Your CGPA: ${studentCGPA}, Required: ${requiredCGPA})`);
    }
  
    // Skills check
    const studentSkills = studentProfile.skills?.map(skill => skill.toLowerCase()) || [];
    const requiredSkills = job.skills?.map(skill => skill.toLowerCase()) || [];
    const missingSkills = requiredSkills.filter(skill => !studentSkills.includes(skill));
    if (missingSkills.length > 0) {
      reasons.push(`Missing skills: ${missingSkills.join(', ')}`);
    }
  
    // Batch check
    const studentBatch = String(studentProfile.batch || '').toLowerCase();
    const eligibleBatches = job.eligibleBatch?.map(batch => String(batch)).map(batch => batch.toLowerCase()) || [];
    if (eligibleBatches.length > 0 && !eligibleBatches.some(batch => 
      studentBatch.includes(batch) || batch.includes(studentBatch))) {
      reasons.push(`Batch requirement not met (Your batch: ${studentProfile.batch}, Required: ${job.eligibleBatch?.join(', ')}`);
    }

    // Gender check
    const studentGender = studentProfile.gender?.toLowerCase() || '';
    const genderPref = job.genderPreference?.toLowerCase() || 'any';
    if (genderPref !== 'any' && genderPref !== studentGender) {
      reasons.push(`Gender preference not met (Your gender: ${studentProfile.gender}, Required: ${job.genderPreference})`);
    }

    // Arrears check
    const studentCurrentArrears = parseInt(studentProfile.currentArrears || 0);
    const maxCurrentArrears = parseInt(job.maxCurrentArrears || 0);
    if (maxCurrentArrears > 0 && studentCurrentArrears > maxCurrentArrears) {
      reasons.push(`Current arrears limit exceeded (Your arrears: ${studentCurrentArrears}, Maximum allowed: ${maxCurrentArrears})`);
    }

    const studentHistoryArrears = parseInt(studentProfile.historyArrears || 0);
    const maxHistoryArrears = parseInt(job.maxHistoryArrears || 0);
    if (maxHistoryArrears > 0 && studentHistoryArrears > maxHistoryArrears) {
      reasons.push(`History arrears limit exceeded (Your arrears: ${studentHistoryArrears}, Maximum allowed: ${maxHistoryArrears})`);
    }
  
    return reasons;
  };

  const calculateSkillMatch = (job) => {
    // Add null checks
    if (!job?.skills || !studentProfile?.skills) {
      return 0;
    }

    const studentSkills = studentProfile.skills.map(skill => skill.toLowerCase());
    const requiredSkills = job.skills.map(skill => skill.toLowerCase());
    
    if (requiredSkills.length === 0) {
      return 100; // If no skills required, consider it a full match
    }

    const matchedSkills = requiredSkills.filter(skill => 
      studentSkills.includes(skill)
    );
    return Math.round((matchedSkills.length / requiredSkills.length) * 100);
  };

  // Calculate time remaining until deadline
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

  // Add a function to check if a job is completed
  const isJobCompleted = (job) => {
    return job.status === 'completed' || 
           (job.deadline && new Date(job.deadline) < new Date() && job.selectionCompleted);
  };

  // Add a function to view selected students
  const handleViewSelected = async (jobId) => {
    try {
      setSelectedJobId(jobId);
      setLoading(true);
      
      // Fetch selected students for this job
      const applicationsRef = collection(db, 'applications');
      const q = query(
        applicationsRef, 
        where('job_id', '==', jobId),
        where('status', '==', 'selected')
      );
      const snapshot = await getDocs(q);
      
      const selectedStudentsData = [];
      for (const doc of snapshot.docs) {
        const application = doc.data();
        // Fetch student details
        const studentDoc = await getDoc(doc(db, 'students', application.student_id));
        if (studentDoc.exists()) {
          selectedStudentsData.push({
            id: application.student_id,
            name: studentDoc.data().name || 'Unknown',
            rollNumber: studentDoc.data().rollNumber || 'N/A',
            email: studentDoc.data().email || 'N/A',
            applicationId: doc.id
          });
        }
      }
      
      setSelectedStudents(selectedStudentsData);
      setViewSelectedStudents(true);
    } catch (error) {
      console.error('Error fetching selected students:', error);
      toast.error('Failed to fetch selected students');
    } finally {
      setLoading(false);
    }
  };

  // Filter jobs based on search and filter criteria
  const filteredJobs = jobs.filter(job => {
    // First check if we're viewing saved jobs only
    if (viewSavedJobs && !savedJobs.includes(job.id)) return false;
    
    // Search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        job.position?.toLowerCase().includes(searchLower) ||
        job.company?.toLowerCase().includes(searchLower) ||
        job.location?.toLowerCase().includes(searchLower) ||
        job.skills?.some(skill => skill.toLowerCase().includes(searchLower));
      
      if (!matchesSearch) return false;
    }
    
    // Job Type filter
    if (filters.jobTypes.length > 0 && 
        !job.jobTypes?.some(type => filters.jobTypes.includes(type))) {
      return false;
    }
    
    // Job Status filter
    if (filters.jobStatus.length > 0) {
      const isApplied = appliedJobs.includes(job.id);
      const isSaved = savedJobs.includes(job.id);
      const isEligible = checkEligibility(job);
      
      if (filters.jobStatus.includes('Applied') && !isApplied) return false;
        if (filters.jobStatus.includes('Saved') && !isSaved) return false;
      if (filters.jobStatus.includes('Open') && isApplied) return false;
      if (filters.jobStatus.includes('Eligible') && !isEligible) return false;
    }

    // Withdrawn applications filter
    if (!filters.showWithdrawn) {
      const isWithdrawn = appliedJobs.includes(job.id) && applicationStatuses[job.id] === 'withdrawn';
      if (isWithdrawn) return false;
    }
    
    // Location filter
    if (filters.locations.length > 0 && 
        !filters.locations.some(loc => job.location?.includes(loc))) {
      return false;
    }
    
    // Work Mode filter
    if (filters.workModes.length > 0 && 
        !filters.workModes.includes(job.workMode)) {
      return false;
    }
    
    // Stipend/CTC filter
    if (job.jobTypes?.includes('Internship')) {
      const stipend = parseInt(job.salary) || 0;
      if (filters.minStipend && stipend < parseInt(filters.minStipend)) return false;
      if (filters.maxStipend && stipend > parseInt(filters.maxStipend)) return false;
    } else {
      const ctc = parseFloat(job.ctc) || 0;
      if (filters.minCTC && ctc < parseFloat(filters.minCTC)) return false;
      if (filters.maxCTC && ctc > parseFloat(filters.maxCTC)) return false;
    }
    
    // CGPA filter
    if (filters.minCGPA && parseFloat(job.minCGPA) > parseFloat(filters.minCGPA)) return false;
    
    // Eligible Batches filter
    if (filters.eligibleBatches.length > 0 && 
        !job.eligibleBatch?.some(batch => filters.eligibleBatches.includes(batch))) {
      return false;
    }
    
    // Skills filter
    if (filters.skills.length > 0 && 
        !filters.skills.every(skill => job.skills?.map(s => s.toLowerCase()).includes(skill.toLowerCase()))) {
      return false;
    }
    
    return true;
  });

  // Sort filtered jobs
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    // First, move completed jobs to the bottom
    const aCompleted = isJobCompleted(a);
    const bCompleted = isJobCompleted(b);
    
    if (aCompleted && !bCompleted) return 1;
    if (!aCompleted && bCompleted) return -1;
    
    // Then apply the regular sorting
    if (sortBy === 'deadline') {
      // Handle null deadlines
      if (!a.deadline) return sortOrder === 'asc' ? 1 : -1;
      if (!b.deadline) return sortOrder === 'asc' ? -1 : 1;
      return sortOrder === 'asc' ? a.deadline - b.deadline : b.deadline - a.deadline;
    }
    
    if (sortBy === 'compensation') {
      const aValue = a.jobTypes?.includes('Internship') ? parseInt(a.salary) || 0 : parseFloat(a.ctc) || 0;
      const bValue = b.jobTypes?.includes('Internship') ? parseInt(b.salary) || 0 : parseFloat(b.ctc) || 0;
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    if (sortBy === 'skillMatch') {
      const aMatch = calculateSkillMatch(a);
      const bMatch = calculateSkillMatch(b);
      return sortOrder === 'asc' ? aMatch - bMatch : bMatch - aMatch;
    }
    
    return 0;
  });

  // Reset all filters
  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      jobTypes: [],
      jobStatus: [],
      locations: [],
      workModes: [],
      minStipend: '',
      maxStipend: '',
      minCTC: '',
      maxCTC: '',
      minCGPA: '',
      eligibleBatches: [],
      skills: [],
      showWithdrawn: true
    });
    setSortBy('deadline');
    setSortOrder('desc');
  };

  // Toggle filter selection
  const toggleFilter = (filterType, value) => {
    setFilters(prev => {
      const current = [...prev[filterType]];
      const index = current.indexOf(value);
      
      if (index === -1) {
        current.push(value);
      } else {
        current.splice(index, 1);
      }
      
      return {
        ...prev,
        [filterType]: current
      };
    });
  };
  return (
    <div className="p-0 space-y-0">
      <ToastContainer style={{ zIndex: 9999 }} />
      
  
      {/* Sticky Filter Toolbar */}
      <div className="sticky top-0 z-10 bg-white shadow-md p-4 rounded-lg mb-20">
        <div className="flex flex-col space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by position, company, location, or skills"
              className="w-full p-1 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
          
          {/* Direct Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {/* Clear All Filters Button */}
            <button
              onClick={clearFilters}
              className="px-0.5 py-0 text-sm rounded-lg transition bg-red-500 text-white hover:bg-red-600"
            >
              Clear
            </button>
            
            {/* Job Status Filters */}
            <button
              onClick={() => {
                if (filters.jobStatus.length === 0 && !viewSavedJobs) {
                  return;
                }
                setFilters({
                  ...filters,
                  jobStatus: []
                });
                setViewSavedJobs(false);
              }}
              className={`px-1 py-0.5 text-sm rounded-lg transition ${filters.jobStatus.length === 0 && !viewSavedJobs ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              All Jobs
            </button>
            
            <button


onClick={() => {
                if (filters.jobStatus.includes('Eligible')) {
                  setFilters({
                    ...filters,
                    jobStatus: filters.jobStatus.filter(status => status !== 'Eligible')
                  });
                } else {
                  setFilters({
                    ...filters,
                    jobStatus: [...filters.jobStatus, 'Eligible']
                  });
                }
              }}
              className={`px-1 py-0.5 text-sm rounded-lg transition ${filters.jobStatus.includes('Eligible') ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Eligible Jobs
            </button>
            
            <button
              onClick={() => {
                if (filters.jobStatus.includes('Applied')) {
                  setFilters({
                    ...filters,
                    jobStatus: filters.jobStatus.filter(status => status !== 'Applied')
                  });
                } else {
                  setFilters({
                    ...filters,
                    jobStatus: [...filters.jobStatus, 'Applied']
                  });
                }
              }}
              className={`px-1 py-0.5 text-sm rounded-lg transition ${filters.jobStatus.includes('Applied') ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Applied Jobs
            </button>
            
            <button
              onClick={() => {
                if (filters.jobStatus.includes('Rejected')) {
                  setFilters({
                    ...filters,
                    jobStatus: filters.jobStatus.filter(status => status !== 'Rejected')
                  });
                } else {
                  setFilters({
                    ...filters,
                    jobStatus: [...filters.jobStatus, 'Rejected']
                  });
                }
              }}
              className={`px-1 py-0.5 text-sm rounded-lg transition ${filters.jobStatus.includes('Rejected') ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Rejected Jobs
            </button>
            
            <button
              onClick={() => setViewSavedJobs(!viewSavedJobs)}
              className={`px-1 py-0.5 text-sm rounded-lg transition ${viewSavedJobs ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Saved Jobs
            </button>
            
            {/* Job Type Filters */}
            <button
              onClick={() => {
                if (filters.jobTypes.includes('Full-time')) {
                  setFilters({
                    ...filters,
                    jobTypes: filters.jobTypes.filter(type => type !== 'Full-time')
                  });
                } else {
                  setFilters({
                    ...filters,
                    jobTypes: [...filters.jobTypes, 'Full-time']
                  });
                }
              }}
              className={`px-1 py-0.5 text-sm rounded-lg transition ${filters.jobTypes.includes('Full-time') ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Full Time
            </button>
            
            <button
              onClick={() => {
                if (filters.jobTypes.includes('Internship')) {
                  setFilters({
                    ...filters,
                    jobTypes: filters.jobTypes.filter(type => type !== 'Internship')
                  });
                } else {
                  setFilters({
                    ...filters,
                    jobTypes: [...filters.jobTypes, 'Internship']
                  });
                }
              }}
              className={`px-1 py-0.5 text-sm rounded-lg transition ${filters.jobTypes.includes('Internship') ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Intern
            </button>
            
            <button
              onClick={() => {
                if (filters.jobTypes.includes('Intern leads to FTE')) {
                  setFilters({
                    ...filters,
                    jobTypes: filters.jobTypes.filter(type => type !== 'Intern leads to FTE')
                  });
                } else {
                  setFilters({
                    ...filters,
                    jobTypes: [...filters.jobTypes, 'Intern leads to FTE']
                  });
                }
              }}
              className={`px-1 py-0.5 text-sm rounded-lg transition ${filters.jobTypes.includes('Intern leads to FTE') ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Intern + Full Time
            </button>
            
            {/* Compensation Filters */}
            <button
              onClick={() => {
                if (sortBy === 'compensation' && sortOrder === 'desc') {
                  setSortBy('deadline');
                  setSortOrder('desc');
                } else {
                  setSortBy('compensation');
                  setSortOrder('desc');
                }
              }}
              className={`px-1 py-0.5 text-sm rounded-lg transition ${sortBy === 'compensation' && sortOrder === 'desc' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Highest CTC
            </button>
            
            <button
              onClick={() => {
                if (sortBy === 'compensation' && sortOrder === 'desc' && filters.jobTypes.includes('Internship')) {
                  setSortBy('deadline');
                  setSortOrder('desc');
                } else {
                  setSortBy('compensation');
                  setSortOrder('desc');
                  if (!filters.jobTypes.includes('Internship')) {
                    setFilters({
                      ...filters,
                      jobTypes: [...filters.jobTypes, 'Internship']
                    });
                  }
                }
              }}
              className={`px-1 py-0.5 text-sm rounded-lg transition ${sortBy === 'compensation' && sortOrder === 'desc' && filters.jobTypes.includes('Internship') ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Highest Stipend
            </button>
          </div>
          
          {/* Advanced Filters Button */}
          {/* <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg transition ${showFilters ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} flex items-center gap-2 ml-auto`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {showFilters ? 'Hide Advanced Filters' : 'Advanced Filters'} {showFilters ? '▲' : '▼'}
          </button> */}
        </div>
        
        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-4 overflow-x-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Job Type & Status Filter */}
              <div>
                <h4 className="font-medium mb-2">Job Type & Status</h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Job Type</p>
                    <div className="flex flex-wrap gap-2">
                      {['Internship', 'Full-time', 'Intern leads to FTE'].map(type => (
                        <label key={type} className="inline-flex items-center px-3 py-1 bg-white border rounded-full cursor-pointer transition-colors duration-200 hover:bg-gray-100">
                          <input
                            type="checkbox"
                            checked={filters.jobTypes.includes(type)}
                            onChange={() => toggleFilter('jobTypes', type)}
                            className="mr-2 rounded"
                          />
                          <span className="text-sm">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Status</p>
                    <div className="flex flex-wrap gap-2">
                      {['Applied', 'Saved', 'Open'].map(status => (
                        <label key={status} className="inline-flex items-center px-3 py-1 bg-white border rounded-full cursor-pointer transition-colors duration-200 hover:bg-gray-100">
                          <input
                            type="checkbox"
                            checked={filters.jobStatus.includes(status)}
                            onChange={() => toggleFilter('jobStatus', status)}
                            className="mr-2 rounded"
                          />
                          <span className="text-sm">{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Application Status</p>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex items-center px-3 py-1 bg-white border rounded-full cursor-pointer transition-colors duration-200 hover:bg-gray-100">
                        <input
                          type="checkbox"
                          checked={filters.showWithdrawn}
                          onChange={(e) => setFilters(prev => ({ ...prev, showWithdrawn: e.target.checked }))}
                          className="mr-2 rounded"
                        />
                        <span className="text-sm">Show Withdrawn</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Compensation Filter */}
              <div>
                <h4 className="font-medium mb-2">Compensation</h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Stipend (₹/month)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        className="p-2 border border-gray-300 rounded-lg"
                        value={filters.minStipend}
                        onChange={(e) => setFilters({...filters, minStipend: e.target.value})}
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        className="p-2 border border-gray-300 rounded-lg"
                        value={filters.maxStipend}
                        onChange={(e) => setFilters({...filters, maxStipend: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">CTC (LPA)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        className="p-2 border border-gray-300 rounded-lg"
                        value={filters.minCTC}
                        onChange={(e) => setFilters({...filters, minCTC: e.target.value})}
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        className="p-2 border border-gray-300 rounded-lg"
                        value={filters.maxCTC}
                        onChange={(e) => setFilters({...filters, maxCTC: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Skills Filter */}
              <div>
                <h4 className="font-medium mb-2">Skills</h4>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {['JavaScript', 'Python', 'Java', 'React', 'Node.js', 'Machine Learning'].map(skill => (
                      <label key={skill} className="inline-flex items-center px-3 py-1 bg-white border rounded-full cursor-pointer transition-colors duration-200 hover:bg-gray-100">
                        <input
                          type="checkbox"
                          checked={filters.skills.includes(skill)}
                          onChange={() => toggleFilter('skills', skill)}
                          className="mr-2 rounded"
                        />
                        <span className="text-sm">{skill}</span>
                      </label>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Add custom skill"
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                          toggleFilter('skills', e.target.value.trim());
                          e.target.value = '';
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Sort Options */}
              <div>
                <h4 className="font-medium mb-2">Sort By</h4>
                <div className="space-y-2">
                  <select
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="deadline">Deadline</option>
                    <option value="compensation">Compensation</option>
                    <option value="skillMatch">Skill Match</option>
                  </select>
                  <div className="flex gap-4">
                    <label className="inline-flex items-center px-3 py-2 bg-white border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="sortOrder"
                        checked={sortOrder === 'asc'}
                        onChange={() => setSortOrder('asc')}
                        className="mr-2"
                      />
                      <span>Oldest to Latest</span>
                    </label>
                    <label className="inline-flex items-center px-3 py-2 bg-white border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="sortOrder"
                        checked={sortOrder === 'desc'}
                        onChange={() => setSortOrder('desc')}
                        className="mr-2"
                      />
                      <span>Latest to Oldest</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Filter Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Job Listings Wrapper with Gap */}
      <div className="pt-6"> {/* Added pt-6 for gap */}
        {loading ? (
      <div className="fixed top-0 left-0 right-0 bottom-0 bg-gray-100 bg-opacity-0 flex items-center justify-center z-50">
      <Loader />
    </div>
        ) : (
          <>
            {/* Selected Students Modal */}
            {viewSelectedStudents && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">
                      Selected Students - {jobs.find(j => j.id === selectedJobId)?.position || 'Job'}
                    </h2>
                    <button 
                      onClick={() => setViewSelectedStudents(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {selectedStudents.length > 0 ? (
                    <div className="space-y-4">
                      {selectedStudents.map(student => (
                        <div key={student.id} className="p-4 border rounded-lg">
                          <h3 className="font-medium">{student.name}</h3>
                          <p className="text-sm text-gray-600">{student.rollNumber}</p>
                          <p className="text-sm text-gray-600">{student.email}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No students have been selected for this job yet.
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {sortedJobs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {sortedJobs.map(job => {
                  const isEligible = checkEligibility(job);
                  const isSaved = savedJobs.includes(job.id);
                  const isApplied = appliedJobs.includes(job.id);
                  const timeRemaining = getTimeRemaining(job.deadline);
                  
                  const completed = isJobCompleted(job);
                  
                  return (
                    <div 
                      key={job.id} 
                      className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 ${completed ? 'opacity-70' : ''} ${isApplied && applicationStatuses[job.id] === 'withdrawn' ? 'opacity-60' : ''}`}
                    >
                      {/* Completed Label */}
                      {completed && (
                        <div className="bg-gray-800 text-white text-center py-1 text-sm font-medium">
                          Completed
                        </div>
                      )}

                      {/* Withdrawn Overlay */}
                      {isApplied && applicationStatuses[job.id] === 'withdrawn' && (
                        <div className="absolute inset-0 bg-red-50 bg-opacity-90 flex items-center justify-center z-10">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                            <p className="text-red-800 font-semibold text-lg">Application Withdrawn</p>
                            <p className="text-red-600 text-sm">Cannot reapply</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Card Header */}
                      <div className="p-4 border-b">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-xl font-semibold text-gray-800">{job.position}</h3>
                              {/* Withdrawn Badge */}
                              {isApplied && applicationStatuses[job.id] === 'withdrawn' && (
                                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                                  Withdrawn
                                </span>
                              )}
                            </div>
                            <p className="text-gray-600">{job.company}</p>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${isEligible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {isEligible ? 'Eligible' : 'Not Eligible'}
                            </div>
                            {!isEligible && (
                              <button 
                                onClick={() => {
                                  const issues = getEligibilityDetails(job);
                                  issues.forEach(issue => toast.error(issue));
                                }}
                                className="mt-1 text-xs text-gray-500 underline"
                                title="View eligibility issues"
                              >
                                View Issues
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Card Body */}
                      <div className="p-4 space-y-2">
                        {/* Job Details */}
                        <div className="grid grid-cols-2 gap-2">

                                                    <div>
                            <p className="text-sm text-gray-500">Job Role</p>
                            <p className="font-medium">
                              {job.jobRoles && typeof job.jobRoles === 'string' && job.jobRoles.trim() !== ''
                                ? job.jobRoles
                                : 'Not specified'}
                            </p>
                          </div>
                         <div>
                              <p className="text-sm text-gray-500">Job Type</p>
                              <p className="font-medium">
                                {job.jobTypes && typeof job.jobTypes === 'string' && job.jobTypes.trim() !== ''
                                  ? job.jobTypes
                                  : 'Not specified'}
                              </p>
                            </div>

                          <div>
                            <p className="text-sm text-gray-500">Location</p>
                            <p className="font-medium">{job.location || 'Not specified'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Work Mode</p>
                            <p className="font-medium">{job.workMode || 'Not specified'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Required CGPA</p>
                            <p className="font-medium">{job.minCGPA || 'Not specified'}</p>
                          </div>

                          </div>
                          <div>
                            <h4 className="text-sm text-gray-800 mb-1">
                              {job.jobTypes?.includes('Internship') ? 'Stipend' : 'CTC'}
                            </h4>


                                  <p className="text-sm font-semibold text-gray-900">
                                    {typeof job.jobTypes === 'string' && job.jobTypes.toLowerCase().includes('intern')
                                      ? (
                                          job.minSalary || job.maxSalary
                                            ? `₹${job.minSalary || '—'} - ₹${job.maxSalary || '—'}/${job.salaryUnit?.toLowerCase() === 'monthly' ? 'month' : job.salaryUnit}`
                                            : (job.salary
                                                ? `₹${job.salary}/${job.salaryUnit?.toLowerCase() === 'monthly' ? 'month' : job.salaryUnit}`
                                                : 'Not specified')
                                        )
                                      : (
                                          job.minCtc || job.maxCtc
                                            ? `₹${job.minCtc || '—'} - ₹${job.maxCtc || '—'}/${job.ctcUnit?.toLowerCase() === 'yearly' ? 'year' : job.ctcUnit}`
                                            : (job.ctc
                                                ? `₹${job.ctc}/${job.ctcUnit?.toLowerCase() === 'yearly' ? 'year' : job.ctcUnit}`
                                                : 'Not specified')
                                        )}
                                  </p>




                            {job.jobTypes?.includes('Internship') && job.ppoPportunity && (
                              <p className="text-sm text-gray-700 mt-1">PPO Opportunity Available</p>
                            )}
                          </div>
                        {/* </div> */}
                        
                        {/* Deadline */}
                        <div>
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-500">Application Deadline</p>
                            {timeRemaining && timeRemaining !== 'Expired' && (
                              <p className="text-sm font-medium text-red-600">{timeRemaining} left</p>
                            )}
                          </div>
                          <p className="font-medium">
                            {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'No deadline'}
                            {timeRemaining === 'Expired' && (
                              <span className="ml-2 text-sm text-red-600 font-medium">Expired</span>
                            )}
                          </p>
                        </div>
                        
                        {/* Skills */}
                        {job.skills && job.skills.length > 0 && (
                          <div>
                            <p className="text-sm text-gray-500 mb-2">Required Skills</p>
                            <div className="flex flex-wrap gap-2">
                              {job.skills.map((skill, index) => (
                                <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">
                                  {skill}
                                </span>
                              ))}
                            </div>
                            <div className="mt-2">
                              <div className="text-sm font-medium">Skill Match</div>
                              <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div 
                                  className="bg-blue-600 h-2.5 rounded-full"
                                  style={{ width: `${calculateSkillMatch(job)}%` }}
                                ></div>
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{calculateSkillMatch(job)}% match</div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Card Footer */}
                      <div className="p-6 border-t bg-gray-50">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewDetails(job.id)}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          >
                            View Details
                          </button>
                          
                          {completed ? (
                            <button
                              onClick={() => handleViewSelected(job.id)}
                              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                            >
                              View Selected
                            </button>
                          ) : isApplied ? (
                            applicationStatuses[job.id] === 'withdrawn' ? (
                              <button
                                disabled
                                className="flex-1 px-4 py-2 bg-red-100 text-red-800 rounded-lg cursor-not-allowed"
                              >
                                Withdrawn
                              </button>
                            ) : (
                              <button
                                disabled
                                className="flex-1 px-4 py-2 bg-green-100 text-green-800 rounded-lg cursor-not-allowed"
                              >
                                Applied
                              </button>
                            )
                          ) : (
                            !isSaved && (
                              <button
                                onClick={() => handleSaveJob(job.id)}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                              >
                                Save
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg">
                <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 className="mt-4 text-xl font-medium text-gray-700">
                  {viewSavedJobs ? 'No saved jobs found' : 'No job postings available'}
                </h3>
                <p className="mt-2 text-gray-500">
                  {viewSavedJobs ? 'You haven\'t saved any jobs yet' : 'Check back later for new opportunities'}
                </p>
                {viewSavedJobs && (
                  <button
                    onClick={() => setViewSavedJobs(false)}
                    className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                  >
                    View All Jobs
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default JobCards;