import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy, addDoc, doc, getDoc, deleteDoc, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { toast } from "react-toastify";
import { createJobPostingNotification } from '../../utils/notificationHelpers';
import { useNavigate } from 'react-router-dom';
import Loader from '../../loading'; // Add this import at the top
import { JobCardsSkeleton } from '../ui/SkeletonLoaders';
import { ContentLoader, PageTransition } from '../ui/PageTransition';
import { getCurrentStudentRollNumber } from '../../utils/studentIdentity';
import { useFreezeStatus } from '../../hooks/useFreezeStatus';
import { AlertTriangle } from 'lucide-react';
import { formatAmount } from '../../utils/formatAmount';

const JobCards = () => {
  const navigate = useNavigate();
  const { isFrozen } = useFreezeStatus();
  // State declarations
  const [jobs, setJobs] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [applicationStatuses, setApplicationStatuses] = useState({});
  const [viewedJobs, setViewedJobs] = useState([]);
  const [jobStatuses, setJobStatuses] = useState({}); // Track job status: new, not_viewed, updated, viewed
  // Per-job action locks to guard against fast double clicks
  const [savingJobIds, setSavingJobIds] = useState({});
  const [unsavingJobIds, setUnsavingJobIds] = useState({});
  const [studentProfile, setStudentProfile] = useState({
    cgpa: 0,
    skills: [],
    batch: '',
  });
  const [viewSavedJobs, setViewSavedJobs] = useState(false);
  // Responsive: detect md+ to always show filters on desktop
  const [isMdUp, setIsMdUp] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(min-width: 768px)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsMdUp(e.matches);
    // Older Safari uses addListener
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
    // Set initial
    setIsMdUp(mq.matches);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);
  const [loading, setLoading] = useState(true);
  const [viewSelectedStudents, setViewSelectedStudents] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    jobTypes: [],
    jobStatus: ['Eligible'],
    viewStatus: [], // new, not_viewed, updated, viewed
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
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('jobCardsViewMode') || 'card';
  });
  const filterRef = useRef(null);
  // Manual quick filter UI state
  const [showManualQuick, setShowManualQuick] = useState(false);
  const [mfLocation, setMfLocation] = useState('');
  const [mfMinCTC, setMfMinCTC] = useState('');
  const [mfMaxCTC, setMfMaxCTC] = useState('');
  const [mfMinStipend, setMfMinStipend] = useState('');
  const [mfMaxStipend, setMfMaxStipend] = useState('');
  const [mfWorkMode, setMfWorkMode] = useState(''); // Remote | On-site | Hybrid
  const [mfBond, setMfBond] = useState(''); // '' | 'requires' | 'no'
  const [tempBond, setTempBond] = useState(''); // transient bond filter for temporary apply

  // On mobile, prevent background scroll when the manual filter is open to avoid layout shifts
  useEffect(() => {
    if (!isMdUp && showManualQuick && typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
    return undefined;
  }, [showManualQuick, isMdUp]);

  useEffect(() => {
    fetchJobs();
    fetchStudentProfile();
    fetchSavedJobs();
    fetchAppliedJobs();
    fetchViewedJobs();
    fetchJobStatuses();
  }, []);

  // Removed: saved quick filter load (temporary filters only now)

  const toggleViewMode = () => {
    const newViewMode = viewMode === 'card' ? 'row' : 'card';
    setViewMode(newViewMode);
    localStorage.setItem('jobCardsViewMode', newViewMode);
  };


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
      await updateJobStatuses(jobsData);
      
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
      if (!user) return;

      const applicationsRef = collection(db, 'applications');
      const roll = await getCurrentStudentRollNumber();
      const q1 = roll
        ? query(applicationsRef, where('student_rollNumber', '==', roll))
        : query(applicationsRef, where('student_id', '==', user.uid));
      const querySnapshot = await getDocs(q1);

      const jobIds = [];
      const statuses = {};

      querySnapshot.docs.forEach(ds => {
        const data = ds.data() || {};
        const jid = data.jobId || data.job_id; // support both keys
        if (jid) {
          jobIds.push(jid);
          statuses[jid] = data.status;
        }
      });

      setAppliedJobs(jobIds);
      setApplicationStatuses(statuses);
    } catch (error) {
      toast.error("Error fetching applications!");
    }
  };

  // Fetch viewed jobs from localStorage
  const fetchViewedJobs = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const viewedJobsKey = `viewedJobs_${user.uid}`;
      const storedViewedJobs = localStorage.getItem(viewedJobsKey);
      if (storedViewedJobs) {
        setViewedJobs(JSON.parse(storedViewedJobs));
      }
    } catch (error) {
      console.error('Error fetching viewed jobs:', error);
    }
  };

  // Fetch job statuses from localStorage
  const fetchJobStatuses = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const jobStatusesKey = `jobStatuses_${user.uid}`;
      const storedJobStatuses = localStorage.getItem(jobStatusesKey);
      if (storedJobStatuses) {
        setJobStatuses(JSON.parse(storedJobStatuses));
      }
    } catch (error) {
      console.error('Error fetching job statuses:', error);
    }
  };

  // Update job statuses based on current jobs
  const updateJobStatuses = async (jobsData) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const jobStatusesKey = `jobStatuses_${user.uid}`;
      const storedJobStatuses = JSON.parse(localStorage.getItem(jobStatusesKey) || '{}');
      const viewedJobsKey = `viewedJobs_${user.uid}`;
      const storedViewedJobs = JSON.parse(localStorage.getItem(viewedJobsKey) || '[]');
      
      const updatedStatuses = { ...storedJobStatuses };
      
      jobsData.forEach(job => {
        const jobId = job.id;
        const isViewed = storedViewedJobs.includes(jobId);
        
        // If job doesn't have a status yet, determine initial status
        if (!updatedStatuses[jobId]) {
          // Check if job is new (created in last 24 hours)
          const isNew = job.created_at && 
            new Date(job.created_at.seconds * 1000) > new Date(Date.now() - 24 * 60 * 60 * 1000);
          
          if (isNew) {
            updatedStatuses[jobId] = 'new';
          } else if (!isViewed) {
            updatedStatuses[jobId] = 'not_viewed';
          } else {
            updatedStatuses[jobId] = 'viewed';
          }
        } else {
          // Update status based on view state
          if (isViewed && updatedStatuses[jobId] !== 'viewed') {
            updatedStatuses[jobId] = 'viewed';
          }
          
          // Check if job was updated after last view
          if (job.updated_at && job.updated_at.seconds) {
            const lastViewTime = localStorage.getItem(`lastView_${jobId}`);
            if (lastViewTime && new Date(job.updated_at.seconds * 1000) > new Date(parseInt(lastViewTime))) {
              updatedStatuses[jobId] = 'updated';
            }
          }
        }
      });
      
      setJobStatuses(updatedStatuses);
      localStorage.setItem(jobStatusesKey, JSON.stringify(updatedStatuses));
    } catch (error) {
      console.error('Error updating job statuses:', error);
    }
  };

  // Mark job as viewed
  const markJobAsViewed = async (jobId) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const viewedJobsKey = `viewedJobs_${user.uid}`;
      const jobStatusesKey = `jobStatuses_${user.uid}`;
      
      // Update viewed jobs
      const updatedViewedJobs = [...viewedJobs];
      if (!updatedViewedJobs.includes(jobId)) {
        updatedViewedJobs.push(jobId);
        setViewedJobs(updatedViewedJobs);
        localStorage.setItem(viewedJobsKey, JSON.stringify(updatedViewedJobs));
      }
      
      // Update job status to viewed
      const updatedStatuses = { ...jobStatuses };
      updatedStatuses[jobId] = 'viewed';
      setJobStatuses(updatedStatuses);
      localStorage.setItem(jobStatusesKey, JSON.stringify(updatedStatuses));
      
      // Store last view time
      localStorage.setItem(`lastView_${jobId}`, Date.now().toString());
    } catch (error) {
      console.error('Error marking job as viewed:', error);
    }
  };






// Function to unsave a job
const handleUnsaveJob = async (jobId) => {
  // Guard: prevent duplicate unsave actions
  if (unsavingJobIds[jobId]) return;
  setUnsavingJobIds((prev) => ({ ...prev, [jobId]: true }));
  try {
    const user = auth.currentUser;
    if (!user) return;

    // Find the saved job entry for this user and job
    const savedJobsQueryRef = query(
      collection(db, "saved_jobs"),
      where("job_id", "==", jobId),
      where("student_id", "==", user.uid)
    );

    const querySnapshot = await getDocs(savedJobsQueryRef);

    if (querySnapshot.empty) {
      // Nothing to unsave
      return;
    }

    // Batch delete for atomicity
    const batch = writeBatch(db);
    querySnapshot.docs.forEach((docSnap) => {
      batch.delete(doc(db, "saved_jobs", docSnap.id));
    });
    await batch.commit();

    // Update local state
    setSavedJobs((prev) => prev.filter((id) => id !== jobId));

    toast.success("Job unsaved successfully!");
  } catch (error) {
    console.error("Error unsaving job:", error);
    toast.error("Error unsaving job! Please try again.");
  } finally {
    setUnsavingJobIds((prev) => {
      const { [jobId]: _ignored, ...rest } = prev;
      return rest;
    });
  }
};














  const handleSaveJob = async (jobId) => {
    // Guard: prevent duplicate saves while in-flight
    if (savingJobIds[jobId]) return;
    setSavingJobIds((prev) => ({ ...prev, [jobId]: true }));
    try {
      const user = auth.currentUser;
      if (!user) return;

      // If already saved in local state, avoid duplicate write
      if (savedJobs.includes(jobId)) {
        toast.info("Already saved");
        return;
      }

      // Check existence in Firestore to prevent duplicates
      const existingQ = query(
        collection(db, 'saved_jobs'),
        where('job_id', '==', jobId),
        where('student_id', '==', user.uid)
      );
      const existingSnap = await getDocs(existingQ);
      if (!existingSnap.empty) {
        setSavedJobs((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
        toast.info("Already saved");
        return;
      }

      await addDoc(collection(db, 'saved_jobs'), {
        job_id: jobId,
        student_id: user.uid,
        saved_at: serverTimestamp()
      });
      setSavedJobs((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
      toast.success("Job saved successfully!");
    } catch (error) {
      console.error('Error saving job:', error);
      toast.error("Error saving job! Please try again.");
    } finally {
      setSavingJobIds((prev) => {
        const { [jobId]: _ignored, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleViewDetails = (jobId) => {
    markJobAsViewed(jobId);
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
    // Bond preference from temporary manual filter only
    const selectedBond = (tempBond || '').trim();
    if (selectedBond === 'requires' && !job.bondRequired) return false;
    if (selectedBond === 'no' && job.bondRequired) return false;

    // Job Type filter
    if (filters.jobTypes.length > 0) {
      const jobTypes = Array.isArray(job.jobTypes) ? job.jobTypes : 
                      (typeof job.jobTypes === 'string' ? [job.jobTypes] : []);
      const hasMatchingType = jobTypes.some(type => {
        const normalizedType = (type || '').toLowerCase().trim();
        return filters.jobTypes.some(filterType => {
          const normalizedFilterType = (filterType || '').toLowerCase().trim();
          // Handle variations in naming
          if (normalizedFilterType === 'full-time' && (normalizedType === 'full-time' || normalizedType === 'fulltime' || normalizedType === 'full time')) return true;
          // Treat any type containing "intern" as internship (covers Intern + Full Time, Intern -> FTE, etc.)
          if (normalizedFilterType === 'internship' && normalizedType.includes('intern')) return true;
          // Match "Intern + Full Time" style as well as "Intern leads to FTE"
          if (normalizedFilterType === 'intern leads to fte') {
            const hasIntern = normalizedType.includes('intern');
            const hasFteOrFull = normalizedType.includes('fte') || normalizedType.includes('full-time') || normalizedType.includes('full time') || normalizedType.includes('fulltime') || normalizedType.includes('full');
            if (hasIntern && hasFteOrFull) return true;
          }
          return normalizedType === normalizedFilterType;
        });
      });
      if (!hasMatchingType) return false;
    }
    
    // Job Status filter
    if (filters.jobStatus.length > 0) {
      const isApplied = appliedJobs.includes(job.id);
      const isSaved = savedJobs.includes(job.id);
      const isEligible = checkEligibility(job);
      
      if (filters.jobStatus.includes('Applied') && !isApplied) return false;
      if (filters.jobStatus.includes('Saved') && !isSaved) return false;
      if (filters.jobStatus.includes('Open') && isApplied) return false;
      if (filters.jobStatus.includes('Not Applied') && isApplied) return false;
      if (filters.jobStatus.includes('Eligible') && !isEligible) return false;
    }

    // View Status filter
    if (filters.viewStatus.length > 0) {
      const jobStatus = jobStatuses[job.id] || 'not_viewed';
      if (!filters.viewStatus.includes(jobStatus)) return false;
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

    // Temporary manual filters (location/work mode) - applied in addition to saved filters
    if (mfLocation && !(job.location || '').toLowerCase().includes(String(mfLocation).toLowerCase())) {
      return false;
    }
    if (mfWorkMode && String(job.workMode || '').toLowerCase() !== String(mfWorkMode).toLowerCase()) {
      return false;
    }
    
    // Stipend/CTC filter - use proper salary/ctc fields with fallbacks
    const jobTypes = Array.isArray(job.jobTypes) ? job.jobTypes : 
                    (typeof job.jobTypes === 'string' ? [job.jobTypes] : []);
    const isInternship = jobTypes.some(type => type.toLowerCase().includes('intern'));
    
    if (isInternship) {
      const stipend = parseInt(job.salary) || parseInt(job.minSalary) || parseInt(job.maxSalary) || 0;
      if (filters.minStipend && stipend < parseInt(filters.minStipend)) return false;
      if (filters.maxStipend && stipend > parseInt(filters.maxStipend)) return false;
      // Temporary manual stipend bounds
      if (mfMinStipend && stipend < parseInt(mfMinStipend)) return false;
      if (mfMaxStipend && stipend > parseInt(mfMaxStipend)) return false;
    } else {
      const ctc = parseFloat(job.ctc) || parseFloat(job.minCtc) || parseFloat(job.maxCtc) || 0;
      if (filters.minCTC && ctc < parseFloat(filters.minCTC)) return false;
      if (filters.maxCTC && ctc > parseFloat(filters.maxCTC)) return false;
      // Temporary manual CTC bounds
      if (mfMinCTC && ctc < parseFloat(mfMinCTC)) return false;
      if (mfMaxCTC && ctc > parseFloat(mfMaxCTC)) return false;
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
      const aJobTypes = Array.isArray(a.jobTypes) ? a.jobTypes : (typeof a.jobTypes === 'string' ? [a.jobTypes] : []);
      const bJobTypes = Array.isArray(b.jobTypes) ? b.jobTypes : (typeof b.jobTypes === 'string' ? [b.jobTypes] : []);
      const aIsInternship = aJobTypes.some(type => type.toLowerCase().includes('intern'));
      const bIsInternship = bJobTypes.some(type => type.toLowerCase().includes('intern'));
      
      const aValue = aIsInternship ? 
        (parseInt(a.salary) || parseInt(a.maxSalary) || parseInt(a.minSalary) || 0) : 
        (parseFloat(a.ctc) || parseFloat(a.maxCtc) || parseFloat(a.minCtc) || 0);
      const bValue = bIsInternship ? 
        (parseInt(b.salary) || parseInt(b.maxSalary) || parseInt(b.minSalary) || 0) : 
        (parseFloat(b.ctc) || parseFloat(b.maxCtc) || parseFloat(b.minCtc) || 0);
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    if (sortBy === 'skillMatch') {
      const aMatch = calculateSkillMatch(a);
      const bMatch = calculateSkillMatch(b);
      return sortOrder === 'asc' ? aMatch - bMatch : bMatch - aMatch;
    }
    
    return 0;
  });

  // Counts for display (must be after filteredJobs is defined)
  const totalJobsCount = jobs.length;
  const filteredJobsCount = filteredJobs.length;

  // Reset all filters
  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      jobTypes: [],
      jobStatus: [],
      viewStatus: [],
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
    <PageTransition>
      <div className="p-0 space-y-0">
      

      {/* Sticky Filter Toolbar */}
      <div className={`sticky top-0 z-10 bg-gray-100 border border-gray-400
 shadow-md rounded-lg mb-1 md:mb-2 ${showFilters ? 'p-4 md:pb-3' : 'px-4 pt-2 pb-0 md:pb-2'}`}>
        <div className={`flex flex-col ${showFilters ? 'space-y-2' : 'space-y-1'}`}>
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by position, company, location, or skills"
              className="w-full p-1 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
          
          {/* Direct Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Collapsed quick chips: show 'All' and 'Eligible' beside Clear when collapsed */}
            {!showFilters && (
              <>
                <button
                  onClick={() => toggleFilter('jobStatus', 'Eligible')}
                  className={`px-2 py-0.5 text-xs rounded-full transition ${filters.jobStatus.includes('Eligible') ? 'bg-blue-600 text-white border border-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
                  title="Show only eligible jobs"
                >
                  Eligible
                </button>
                <button
                  onClick={() => setFilters({ ...filters, jobStatus: [] })}
                  className={`px-2 py-0.5 text-xs rounded-full transition ${filters.jobStatus.length === 0 ? 'bg-blue-600 text-white border border-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
                  title="Show all jobs"
                >
                  All
                </button>
                {/* '+' Manual filter trigger */}
                <div className="relative inline-block">
                  <button
                    type="button"
                    onClick={() => {
                      // Toggle manual filter popover (temporary only)
                      setShowManualQuick(v => !v);
                    }}
                    className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 hover:bg-blue-200 border border-blue-300"
                    title="Add manual filter"
                    aria-haspopup="dialog"
                    aria-expanded={showManualQuick}
                  >
                    +
                  </button>
                  {showManualQuick && (
                    isMdUp ? (
                      <div className="absolute z-20 mt-2 w-72 right-0 p-3 border rounded-lg bg-white shadow-lg">
                        <div className="flex flex-col gap-2 text-sm">
                          <div>
                            <label className="block text-gray-700 mb-1">Location</label>
                            <input
                              type="text"
                              placeholder="e.g., Bangalore"
                              className="w-full p-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              value={mfLocation}
                              onChange={(e) => setMfLocation(e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-gray-700 mb-1">Min CTC (₹LPA)</label>
                              <input type="number" className="w-full p-1.5 border border-gray-300 rounded-md" value={mfMinCTC} onChange={(e)=>setMfMinCTC(e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-gray-700 mb-1">Max CTC (₹LPA)</label>
                              <input type="number" className="w-full p-1.5 border border-gray-300 rounded-md" value={mfMaxCTC} onChange={(e)=>setMfMaxCTC(e.target.value)} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-gray-700 mb-1">Min Stipend (₹)</label>
                              <input type="number" className="w-full p-1.5 border border-gray-300 rounded-md" value={mfMinStipend} onChange={(e)=>setMfMinStipend(e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-gray-700 mb-1">Max Stipend (₹)</label>
                              <input type="number" className="w-full p-1.5 border border-gray-300 rounded-md" value={mfMaxStipend} onChange={(e)=>setMfMaxStipend(e.target.value)} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-gray-700 mb-1">Work Mode</label>
                            <select className="w-full p-1.5 border border-gray-300 rounded-md" value={mfWorkMode} onChange={(e)=>setMfWorkMode(e.target.value)}>
                              <option value="">Any</option>
                              <option value="Remote">Remote</option>
                              <option value="On-site">On-site</option>
                              <option value="Hybrid">Hybrid</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-gray-700 mb-1">Bond</label>
                            <select className="w-full p-1.5 border border-gray-300 rounded-md" value={mfBond} onChange={(e)=>setMfBond(e.target.value)}>
                              <option value="">Any</option>
                              <option value="requires">Requires bond</option>
                              <option value="no">No bond</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              type="button"
                              className="px-3 py-1 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                              onClick={() => {
                                setTempBond(mfBond || '');
                                setShowManualQuick(false);
                              }}
                            >
                              Add
                            </button>
                            <button type="button" className="px-3 py-1 text-sm rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200" onClick={()=>setShowManualQuick(false)}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Mobile: render as bottom-sheet modal to avoid layout shift
                      <div className="fixed inset-0 z-30 flex items-end justify-center">
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/40" onClick={() => setShowManualQuick(false)} aria-hidden="true"></div>
                        {/* Sheet */}
                        <div className="relative w-full max-w-md mx-auto bg-white rounded-t-2xl shadow-xl p-4 animate-[slide-up_0.2s_ease-out]">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-base font-semibold">Add Filters</h3>
                            <button onClick={() => setShowManualQuick(false)} className="text-gray-500 hover:text-gray-700" aria-label="Close">✕</button>
                          </div>
                          <div className="flex flex-col gap-2 text-sm">
                            <div>
                              <label className="block text-gray-700 mb-1">Location</label>
                              <input
                                type="text"
                                placeholder="e.g., Bangalore"
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={mfLocation}
                                onChange={(e) => setMfLocation(e.target.value)}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-gray-700 mb-1">Min CTC (₹LPA)</label>
                                <input type="number" className="w-full p-2 border border-gray-300 rounded-md" value={mfMinCTC} onChange={(e)=>setMfMinCTC(e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-gray-700 mb-1">Max CTC (₹LPA)</label>
                                <input type="number" className="w-full p-2 border border-gray-300 rounded-md" value={mfMaxCTC} onChange={(e)=>setMfMaxCTC(e.target.value)} />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-gray-700 mb-1">Min Stipend (₹)</label>
                                <input type="number" className="w-full p-2 border border-gray-300 rounded-md" value={mfMinStipend} onChange={(e)=>setMfMinStipend(e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-gray-700 mb-1">Max Stipend (₹)</label>
                                <input type="number" className="w-full p-2 border border-gray-300 rounded-md" value={mfMaxStipend} onChange={(e)=>setMfMaxStipend(e.target.value)} />
                              </div>
                            </div>
                            <div>
                              <label className="block text-gray-700 mb-1">Work Mode</label>
                              <select className="w-full p-2 border border-gray-300 rounded-md" value={mfWorkMode} onChange={(e)=>setMfWorkMode(e.target.value)}>
                                <option value="">Any</option>
                                <option value="Remote">Remote</option>
                                <option value="On-site">On-site</option>
                                <option value="Hybrid">Hybrid</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-gray-700 mb-1">Bond</label>
                              <select className="w-full p-2 border border-gray-300 rounded-md" value={mfBond} onChange={(e)=>setMfBond(e.target.value)}>
                                <option value="">Any</option>
                                <option value="requires">Requires bond</option>
                                <option value="no">No bond</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                type="button"
                                className="flex-1 px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                                onClick={() => {
                                  setTempBond(mfBond || '');
                                  setShowManualQuick(false);
                                }}
                              >
                                Apply
                              </button>
                              <button type="button" className="px-4 py-2 text-sm rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200" onClick={()=>setShowManualQuick(false)}>Cancel</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </>
            )}

            {/* Saved manual filter removed: temporary-only mode */}

            {/* Jobs count beside filters */}
            <span className="ml-3 px-2 py-0.5 text-sm font-semibold rounded bg-gray-10 text-gray-1000">
              {` ${filteredJobsCount} Jobs`}
            </span>

            {/* View Toggle Button */}
            <button
              onClick={toggleViewMode}
              className="px-3 py-1 text-sm rounded-lg transition bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center gap-1 ml-auto"
              title={`Switch to ${viewMode === 'card' ? 'table' : 'card'} view`}
            >
              {viewMode === 'card' ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Table View
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Card View
                </>
              )}
            </button>
          </div>

          {/* Collapsible Filters Wrapper (for chips and controls) */}
          <div
            style={{
              overflow: isMdUp ? 'visible' : 'hidden',
              maxHeight: isMdUp ? 'unset' : (showFilters ? '1000px' : '0px'),
              transition: 'max-height 300ms ease',
            }}
            className={`${showFilters ? '-mt-4 -mb-2' : 'hidden'} flex flex-wrap gap-2 md:flex md:mt-0 md:mb-2 md:gap-2 md:[max-height:unset] md:overflow-visible`}
          >
            {/* Job Status Filters */}
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
              className={`px-1 py-0.5 text-sm rounded-lg transition ${filters.jobStatus.includes('Applied') ? 'bg-blue-600 text-white border border-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
            >
              Applied Jobs
            </button>
            
            {/* Not Applied Jobs Filter */}
            <button
              onClick={() => {
                if (filters.jobStatus.includes('Not Applied')) {
                  setFilters({
                    ...filters,
                    jobStatus: filters.jobStatus.filter(status => status !== 'Not Applied')
                  });
                } else {
                  setFilters({
                    ...filters,
                    jobStatus: [...filters.jobStatus, 'Not Applied']
                  });
                }
              }}
              className={`px-1 py-0.5 text-sm rounded-lg transition ${filters.jobStatus.includes('Not Applied') ? 'bg-blue-600 text-white border border-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
            >
              Not Applied
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
              className={`px-1 py-0.5 text-sm rounded-lg transition ${filters.jobStatus.includes('Rejected') ? 'bg-blue-600 text-white border border-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
            >
              Rejected Jobs
            </button>
            
            <button
              onClick={() => setViewSavedJobs(!viewSavedJobs)}
              className={`px-1 py-0.5 text-sm rounded-lg transition ${viewSavedJobs ? 'bg-blue-600 text-white border border-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
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
              className={`px-1 py-0.5 text-sm rounded-lg transition ${filters.jobTypes.includes('Full-time') ? 'bg-blue-600 text-white border border-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
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
              className={`px-1 py-0.5 text-sm rounded-lg transition ${filters.jobTypes.includes('Internship') ? 'bg-blue-600 text-white border border-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
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
              className={`px-1 py-0.5 text-sm rounded-lg transition ${filters.jobTypes.includes('Intern leads to FTE') ? 'bg-blue-600 text-white border border-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
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
              className={`px-1 py-0.5 text-sm rounded-lg transition ${sortBy === 'compensation' && sortOrder === 'desc' ? 'bg-blue-600 text-white border border-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
            >
              Highest CTC
            </button>
            
            <button
              onClick={() => {
                if (sortBy === 'compensation' && sortOrder === 'desc' && filters.jobTypes.includes('Internship')) {
                  setSortBy('deadline');
                  setSortOrder('desc');
                  setFilters({
                    ...filters,
                    jobTypes: filters.jobTypes.filter(type => type !== 'Internship')
                  });
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
              className={`px-1 py-0.5 text-sm rounded-lg transition ${sortBy === 'compensation' && sortOrder === 'desc' && filters.jobTypes.includes('Internship') ? 'bg-blue-600 text-white border border-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
            >
              Highest Stipend
            </button>
            
            {/* View Status Filters */}
            <button
              onClick={() => toggleFilter('viewStatus', 'new')}
              className={`px-1.5 py-0.5 text-xs rounded-lg transition ${filters.viewStatus.includes('new') ? 'bg-green-400 text-black border border-green-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
            >
            New
            </button>
            
            <button
              onClick={() => toggleFilter('viewStatus', 'not_viewed')}
              className={`px-1.5 py-0.5 text-xs rounded-lg transition ${filters.viewStatus.includes('not_viewed') ? 'bg-orange-400 text-black border border-orange-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
            >
              Not Viewed
            </button>
            
            <button
              onClick={() => toggleFilter('viewStatus', 'updated')}
              className={`px-1.5 py-0.5 text-xs rounded-lg transition ${filters.viewStatus.includes('updated') ? 'bg-blue-400 text-black border border-blue-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'}`}
            >
              Updated
            </button>

           
            
          </div>

          {/* Chevron toggle for collapsing/expanding filters (hidden on md+) */}
          <div className="flex justify-center -mt-2 -mb-2 md:hidden">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1 rounded-full border transition ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
              aria-expanded={showFilters}
              aria-label="Toggle filters"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transform transition-transform ${showFilters ? 'rotate-180' : 'rotate-0'}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          
            
            {/* Removed separate Mobile Filters Toggle: collapse handled by chevron above */}
        {/* Animated Filters Section */}
     
      </div>
      </div>
      {/* Job Listings Wrapper with Gap */}
      <div className="pt-1 md:pt-2"> {/* Further reduced gap above listings on desktop */}
        <ContentLoader
          loading={loading}
          skeleton={<JobCardsSkeleton count={6} />}
          minHeight="400px"
        >
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
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
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
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No students have been selected for this job yet.
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {sortedJobs.length > 0 ? (
              viewMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedJobs.map(job => {
                  const isEligible = checkEligibility(job);
                  const isSaved = savedJobs.includes(job.id);
                  const isApplied = appliedJobs.includes(job.id);
                  const timeRemaining = getTimeRemaining(job.deadline);
                  const completed = isJobCompleted(job);

                  // compute posted days ago if created_at exists
                  let postedAgo = '';
                  try {
                    const created = job.created_at && (job.created_at.toDate ? job.created_at.toDate() : new Date(job.created_at.seconds * 1000));
                    if (created) {
                      const diffMs = Date.now() - created.getTime();
                      const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
                      postedAgo = days === 0 ? 'Today' : `${days} day${days !== 1 ? 's' : ''} ago`;
                    }
                  } catch (_) {}

                  // compute comp chips
                  const ctcUnit = (job.ctcUnit || 'Yearly').toLowerCase();
                  const ctcUnitText = ctcUnit === 'yearly' ? 'year' : ctcUnit;
                  const salaryUnit = (job.salaryUnit || 'Monthly').toLowerCase();
                  const salaryUnitText = salaryUnit === 'monthly' ? 'month' : salaryUnit;
                  const ctcRange = formatAmount(job.minCtc) || formatAmount(job.maxCtc)
                    ? `${formatAmount(job.minCtc) || '—'} - ₹${formatAmount(job.maxCtc) || '—'}`
                    : null;
                  const ctcSingle = formatAmount(job.ctc);
                  const ctcDisplay = ctcRange
                    ? `₹${ctcRange}/${ctcUnitText}`
                    : (ctcSingle ? `₹${ctcSingle}/${ctcUnitText}` : null);
                  const stipendRange = formatAmount(job.minSalary) || formatAmount(job.maxSalary)
                    ? `${formatAmount(job.minSalary) || '—'} - ₹${formatAmount(job.maxSalary) || '—'}`
                    : null;
                  const stipendSingle = formatAmount(job.salary);
                  const stipendDisplay = stipendRange
                    ? `₹${stipendRange}/${salaryUnitText}`
                    : (stipendSingle ? `₹${stipendSingle}/${salaryUnitText}` : null);

                  const isWithdrawn = isApplied && applicationStatuses[job.id] === 'withdrawn';

                  // Get job status for styling
                  const jobStatus = jobStatuses[job.id] || 'not_viewed';
                  const isViewed = viewedJobs.includes(job.id);

                  // Determine background color based on view status
                  const getBackgroundColor = () => {
                    if (isViewed) return 'bg-white';
                    return 'bg-white';
                  };

                  // Determine if job should have highlight shadow
                  const shouldHighlight = jobStatus === 'new';

                  // Get badges to display
                  const getBadges = () => {
                    const badges = [];
                    if (jobStatus === 'new') badges.push({ text: 'NEW', color: 'bg-green-300' });
                    if (jobStatus === 'not_viewed') badges.push({ text: 'NOT VIEWED', color: 'bg-orange-300' });
                    if (jobStatus === 'updated') badges.push({ text: 'UPDATED', color: 'bg-blue-300' });
                    return badges;
                  };

                  const badges = getBadges();

                  // Border styling based on view status
                  const isNewOrUnseen = !isViewed && (jobStatus === 'new' || jobStatus === 'not_viewed' || jobStatus === 'updated');
                  // Border color: withdrawn -> red-100, applied -> green-100, else gray-200
                  const borderClasses = isWithdrawn
                    ? 'border-red-100'
                    : (isApplied ? 'border-green-100' : 'border-gray-200');

                  return (
  <div
    key={job.id}
    className={`relative ${getBackgroundColor()} rounded-xl border-4 ${borderClasses} dark:border-emerald-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transform transition duration-200 cursor-pointer ${completed ? 'opacity-80' : ''} ${shouldHighlight ? 'shadow-lg' : ''} flex flex-col h-full`}
    onClick={() => handleViewDetails(job.id)}
  >
    {/* Status Badges - Top Right Corner */}
    {badges.length > 0 && (
      <div className="absolute top-2 right-2 flex flex-row gap-1 z-10">
        {badges.map((badge, index) => (
          <span
            key={index}
            className={`${badge.color} text-black rounded px-1 py-0.5 text-[10px] uppercase font-medium leading-none`}
          >
            {badge.text}
          </span>
        ))}
      </div>
    )}
    {/* Position */}
    <h3 className="text-lg font-semibold text-gray-900 text-center mb-2 mt-2">
      {job.position}
    </h3>

    {/* Divider */}
    <hr className="border-t border-black dark:border-emerald-400" />

    {/* Row directly below divider */}
    <div className="flex items-start justify-between px-4 py-2">
      {/* Company + posted time */}
      <div className="flex flex-col gap-1">
        <span className="text-lg font-bold text-gray-800 dark:text-emerald-500">{job.company}</span>
        {postedAgo && (
          <span className="text-xs text-gray-500 dark:text-purple-500">{postedAgo}</span>
        )}
      </div>

      {/* Right side: Save button + eligibility */}
      <div className="flex flex-col items-end gap-1 text-xs">
        {/* Save / Saved */}
        {isSaved ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleUnsaveJob(job.id);
            }}
            className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
            title="Unsave job"
          >
            Saved
          </button>
        ) : (
          
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveJob(job.id);
                }}
                className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1"
                title="Save job"
              >
                Save
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="#FFD700"
                  className="w-4 h-4"
                >
                  <path d="M6.75 2.25A2.25 2.25 0 004.5 4.5v15.818a.75.75 0 001.185.62l6.315-4.418a.75.75 0 01.9 0l6.315 4.418a.75.75 0 001.185-.62V4.5a2.25 2.25 0 00-2.25-2.25h-11.4z" />
                </svg>
              </button>


        )}

        {/* Eligibility */}
        <div
          className={`px-2 py-0.5 rounded-full font-medium ${
            isEligible
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
          }`}
        >
          {isEligible ? 'Eligible' : 'Not Eligible'}
        </div>
        {/* Freeze Status Indicator */}
        {isFrozen && (
          <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
            <AlertTriangle size={12} />
            Account Frozen
          </div>
        )}
      </div>
    </div>

    {/* Body */}
    <div className="px-4 pb-4 flex-1">
      {job.jobRoles && (
        <div className="text-sl font-semibold text-gray-900 dark:text-cyan-600 mb-3">
          {job.jobRoles}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {(Array.isArray(job.jobTypes)
          ? job.jobTypes
          : typeof job.jobTypes === 'string'
          ? [job.jobTypes]
          : []
        )
          .slice(0, 1)
          .map((t, idx) => (
            <span
              key={idx}
              className="px-2 py-1 rounded bg-gray-300 dark:bg-gradient-to-r dark:from-pink-500 dark:to-violet-300 text-gray-800 dark:text-white font-semibold text-xs shadow-lg dark:shadow-pink-300/25"
            >
              {t}
            </span>
          ))}
        {job.workMode && (
          <span className="px-2 py-1 rounded bg-gray-300 dark:bg-gradient-to-r dark:from-cyan-500 dark:to-blue-300 text-gray-800 dark:text-white font-semibold text-xs shadow-lg dark:shadow-cyan-300/25">
            {job.workMode}
          </span>
        )}
        {job.location && (
          <span className="px-2 py-1 rounded bg-gray-300 dark:bg-gradient-to-r dark:from-orange-500 dark:to-red-500 text-gray-800 dark:text-white font-semibold text-xs shadow-lg dark:shadow-orange-500/25">
            {job.location}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {ctcDisplay && (
          <span className="px-2 py-1 rounded-full bg-yellow-200 dark:bg-gradient-to-r dark:from-yellow-300 dark:to-orange-300 text-gray-800 dark:text-black font-bold text-xs shadow-lg dark:shadow-yellow-400/50">
            CTC - {ctcDisplay}
          </span>
        )}
        {stipendDisplay && (
          <span className="px-2 py-1 rounded-full bg-yellow-200 dark:bg-gradient-to-r dark:from-green-300 dark:to-blue-300 text-gray-800 dark:text-black font-bold text-xs shadow-lg dark:shadow-green-400/50">
            Stipend - {stipendDisplay}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {((Array.isArray(job.jobTypes) &&
          job.jobTypes.includes('Intern leads to FTE')) ||
          (typeof job.jobTypes === 'string' &&
            job.jobTypes.toLowerCase().includes('intern leads to fte'))) && (
          <span className="px-2 py-1 rounded bg-blue-100 dark:bg-gradient-to-r dark:from-blue-300 dark:to-purple-300 text-blue-800 dark:text-white font-semibold text-xs shadow-lg dark:shadow-blue-400/50">
            Internship leads to FTE
          </span>
        )}
        {job.ppoPportunity && (
          <span className="px-2 py-1 rounded bg-blue-100 dark:bg-gradient-to-r dark:from-indigo-300 dark:to-cyan-300 text-blue-800 dark:text-white font-semibold text-xs shadow-lg dark:shadow-indigo-400/50">
            PPO
          </span>
        )}
        {job.bondRequired && (
          <span className="px-2 py-1 rounded bg-orange-100 dark:bg-gradient-to-r dark:from-red-400 dark:to-pink-500 text-gray-800 dark:text-white font-semibold text-xs shadow-lg dark:shadow-red-400/50">
            Bond
          </span>
        )}
      </div>
    </div>

    {/* Footer pinned to bottom */}
    <div
      className={`border-t border-gray-200 dark:border-emerald-400 px-4 py-3 rounded-b-xl ${
        isApplied
          ? isWithdrawn
            ? 'bg-red-100'
            : 'bg-green-100'
          : 'bg-gray-100'
      }`}
    >
      {isApplied ? (
        <div
          className={`text-sl text-center font-bold ${
            isWithdrawn ? 'text-red-700' : 'text-green-700'
          }`}
        >
          {isWithdrawn ? 'Withdrawn' : 'Applied'}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-500 dark:text-gray-400">Application Deadline</div>
            {timeRemaining && timeRemaining !== 'Expired' && (
              <div className="text-red-600 font-medium">
                {timeRemaining} left
              </div>
            )}
          </div>
          <div className="mt-1 font-medium text-gray-900">
            {job.deadline
              ? new Date(job.deadline).toLocaleDateString()
              : 'No deadline'}
            {timeRemaining === 'Expired' && (
              <span className="ml-2 text-sm text-red-600 font-medium">
                Expired
              </span>
            )}
          </div>
        </>
      )}
    </div>
  </div>
);







                  
                  })}
                </div>
              ) : (
                /* Table View */
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-sky-100">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-sky-800 dark:text-sky-200 uppercase tracking-wider">Position</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-sky-800 dark:text-sky-200 uppercase tracking-wider">Company</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-sky-800 dark:text-sky-200 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-sky-800 dark:text-sky-200 uppercase tracking-wider">CTC</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-sky-800 dark:text-sky-200 uppercase tracking-wider">Location</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-sky-800 dark:text-sky-200 uppercase tracking-wider">Deadline</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-sky-800 dark:text-sky-200 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-sky-800 dark:text-sky-200 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sortedJobs.map(job => {
                          const isEligible = checkEligibility(job);
                          const isSaved = savedJobs.includes(job.id);
                          const isApplied = appliedJobs.includes(job.id);
                          const timeRemaining = getTimeRemaining(job.deadline);
                          const completed = isJobCompleted(job);
                          const isWithdrawn = isApplied && applicationStatuses[job.id] === 'withdrawn';

                          // Format compensation (using shared utility)
                          const ctcSingle = formatAmount(job.ctc);
                          const ctcRange = formatAmount(job.minCtc) || formatAmount(job.maxCtc)
                            ? `${formatAmount(job.minCtc) || '—'} - ₹${formatAmount(job.maxCtc) || '—'}`
                            : null;
                          const ctcDisplay = ctcRange
                            ? `₹${ctcRange}`
                            : (ctcSingle ? `₹${ctcSingle}` : null);

                          // Table row styling based on viewed/new status
                          const jobStatus = jobStatuses[job.id];
                          const viewed = viewedJobs.includes(job.id) || jobStatus === 'viewed';
                          const isNewOrUnseen = !viewed && (jobStatus === 'new' || jobStatus === 'not_viewed' || jobStatus === 'updated' || !jobStatus);
                          // Swap colors: viewed -> darker, new/unseen -> lighter
                          const rowClasses = `hover:bg-gray-50 cursor-pointer ${completed ? 'opacity-60' : ''} ${viewed ? 'bg-gray-100' : 'bg-white'}`;

                          return (
                            <tr key={job.id} className={rowClasses} onClick={() => handleViewDetails(job.id)}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{job.position}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{job.jobRoles}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.company}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-wrap gap-1">
                                  {(Array.isArray(job.jobTypes) ? job.jobTypes : [job.jobTypes]).slice(0, 2).map((type, idx) => (
                                    <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {type}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ctcDisplay || ''}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.location || 'Not specified'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div>{job.deadline ? new Date(job.deadline).toLocaleDateString() : 'No deadline'}</div>
                                {timeRemaining && timeRemaining !== 'Expired' && (
                                  <div className="text-xs text-red-600">{timeRemaining} left</div>
                                )}
                                {timeRemaining === 'Expired' && (
                                  <div className="text-xs text-red-600 font-medium">Expired</div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    isEligible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {isEligible ? 'Eligible' : 'Not Eligible'}
                                  </span>
                                  {isApplied && (
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      isWithdrawn ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                    }`}>
                                      {isWithdrawn ? 'Withdrawn' : 'Applied'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isSaved) {
                                        handleUnsaveJob(job.id);
                                      } else {
                                        handleSaveJob(job.id);
                                      }
                                    }}
                                    className={`px-2 py-1 rounded text-xs ${
                                      isSaved 
                                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                  >
                                    {isSaved ? 'Saved' : 'Save'}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewDetails(job.id);
                                    }}
                                    className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 hover:bg-blue-200"
                                  >
                                    View
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg">
                <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 className="mt-4 text-xl font-medium text-gray-700">
                  {viewSavedJobs ? 'No saved jobs found' : 'No job postings available'}
                </h3>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
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
        </ContentLoader>
      </div>
    </div>
    </PageTransition>
  );
};

export default JobCards;