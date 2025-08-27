import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, addDoc, doc, getDoc, where, serverTimestamp, updateDoc, runTransaction } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { getCurrentStudentRollNumber } from '../../utils/studentIdentity';
import { toast } from "react-toastify";
import { createJobPostingNotification } from '../../utils/notificationHelpers';
import { MessageSquare } from 'lucide-react';
import JobChat from './JobChat'; // Import the new JobChat component
import Loader from '../../loading'; // Add this import at the top


const JobPost = () => {
  // Keep only one set of state declarations at the top
  const [jobs, setJobs] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [applicationStatuses, setApplicationStatuses] = useState({});
  const [applicationAnswers, setApplicationAnswers] = useState({}); // Add this new state
  const [studentProfile, setStudentProfile] = useState({
    cgpa: 0,
    skills: [],
    batch: '',
  });
  const [viewSavedJobs, setViewSavedJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [screeningAnswers, setScreeningAnswers] = useState({});
  const [loading, setLoading] = useState(true); // Add loading state
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [jobsPerPage] = useState(20);
  const [applying, setApplying] = useState(false);
  const [filters, setFilters] = useState({
    jobType: 'all',
    location: 'all',
    company: 'all',
    eligibility: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  // Remove these states:
  // const [hasJoinedChat, setHasJoinedChat] = useState(false);
  // const [showJoinChatModal, setShowJoinChatModal] = useState(false);
  // Function to handle joining the chat
  const handleJoinChat = async () => {
    try {
      if (!selectedJob || !auth.currentUser) return;
      
      // Find the user's application for this job
      const applicationsRef = collection(db, "applications");
      const q = query(
        applicationsRef, 
        where("student_id", "==", auth.currentUser.uid),
        where("jobId", "==", selectedJob.id)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Update the application to mark that the student has joined the chat
        const applicationDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, "applications", applicationDoc.id), {
          hasJoinedChat: true,
          lastChatActivity: serverTimestamp()
        });
      }
      
      // Remove these lines since the state setters are no longer defined
      // setHasJoinedChat(true);
      // setShowJoinChatModal(false);
      setShowChatPanel(true);
      
      // Create a notification for admins about student joining chat
      await createJobEventNotification(
        `Student joined discussion: ${selectedJob.position}`,
        `A student has joined the discussion for ${selectedJob.position} at ${selectedJob.company}`,
        `/admin/jobs/${selectedJob.id}`
      );
      
      toast.success("You've joined the discussion!");
    } catch (error) {
      console.error("Error joining chat:", error);
      toast.error("Failed to join discussion. Please try again.");
    }
  };
  
  // Check if student has already joined the chat
  useEffect(() => {
    const checkJoinedStatus = async () => {
      if (!selectedJob || !auth.currentUser) return;
      
      try {
        const applicationsRef = collection(db, "applications");
        const q = query(
          applicationsRef, 
          where("student_id", "==", auth.currentUser.uid),
          where("jobId", "==", selectedJob.id)
        );
        
        const querySnapshot = await getDocs(q);
        // Remove this line since setHasJoinedChat is no longer defined
        // if (!querySnapshot.empty && querySnapshot.docs[0].data().hasJoinedChat) {
        //   setHasJoinedChat(true);
        // }
      } catch (error) {
        console.error("Error checking joined status:", error);
      }
    };
    
    checkJoinedStatus();
  }, [selectedJob]);






  useEffect(() => {
    fetchJobs();
    fetchStudentProfile();
    fetchSavedJobs();
    fetchAppliedJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const jobsRef = collection(db, 'jobs');
      const jobsQuery = query(jobsRef, orderBy('deadline', 'desc')); // Changed from created_at to deadline
      const querySnapshot = await getDocs(jobsQuery);
      const jobsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        deadline: doc.data().deadline ? new Date(doc.data().deadline).toLocaleString() : 'No deadline',
        interviewDateTime: doc.data().interviewDateTime ? new Date(doc.data().interviewDateTime).toLocaleString() : 'Not scheduled'
      }));
      
      setJobs(jobsData);
      
      // Note: Job posting notifications are now handled centrally in JobCards.js to avoid duplicates
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch jobs');
    } finally {
      setLoading(false); // Set loading to false when done
    }
  };

  const fetchStudentProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Fetch student info from the 'students' collection
      const studentDoc = await getDoc(doc(db, 'students', user.uid));
      
      // Remove fetching from student_academics as all data should be in 'students'
      // const academicsDoc = await getDoc(doc(db, 'student_academics', user.uid));
      
      const studentData = studentDoc.data() || {};
      // const academicsData = academicsDoc.data() || {}; // Remove this line

      setStudentProfile({
        // Spread all data from the students collection
        ...studentData,
        // Explicitly set fields with default values for safety
        cgpa: studentData.cgpa || 0,
        currentArrears: studentData.currentArrears || 0, // Assuming these are now in 'students'
        historyArrears: studentData.historyArrears || 0, // Assuming these are now in 'students'
        gender: studentData.gender || '',
        batch: studentData.batch || '', // Assuming batch is now in 'students'
        // {{ edit_1 }}
        // Ensure skills is always an array, handling string case
        skills: Array.isArray(studentData.skills) 
                  ? studentData.skills 
                  : (typeof studentData.skills === 'string' && studentData.skills) 
                    ? [studentData.skills] 
                    : [],
        // {{ end_edit_1 }}
        // Add other fields you expect from the 'students' collection with defaults
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
        // createdAt is a timestamp, no default needed here unless you want a specific placeholder
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
        const roll = await getCurrentStudentRollNumber();
        const q1 = roll
          ? query(savedJobsRef, where('student_rollNumber', '==', roll))
          : query(savedJobsRef, where('student_id', '==', user.uid));
        const querySnapshot = await getDocs(q1);
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
        const roll = await getCurrentStudentRollNumber();
        const q1 = roll 
          ? query(applicationsRef, where('student_rollNumber', '==', roll))
          : query(applicationsRef, where('student_id', '==', user.uid));
        const querySnapshot = await getDocs(q1);
        
        // Store job IDs, statuses, and screening answers
        const jobIds = [];
        const statuses = {};
        const answers = {};
        
        querySnapshot.docs.forEach(doc => {
          const data = doc.data();
          jobIds.push(data.job_id);
          statuses[data.job_id] = data.status;
          answers[data.job_id] = data.screening_answers || {};
        });
        
        setAppliedJobs(jobIds);
        setApplicationStatuses(statuses);
        setApplicationAnswers(answers);
      }
    } catch (error) {
      toast.error("Error fetching applications!");
    }
  };

  const handleSaveJob = async (jobId) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const roll = await getCurrentStudentRollNumber();
        await addDoc(collection(db, 'saved_jobs'), {
          job_id: jobId,
          student_id: user.uid,
          student_rollNumber: roll || null,
          saved_at: serverTimestamp()
        });
        setSavedJobs([...savedJobs, jobId]);
        toast.success("Job saved successfully!");
      }
    } catch (error) {
      toast.error("Error saving job!");
    }
  };

  // Keep only one instance of handleAnswerChange
  const handleAnswerChange = (questionIndex, value) => {
    setScreeningAnswers(prev => ({
      ...prev,
      [questionIndex]: value
    }));
  };

  // Modify the handleApply function with transactional creation and duplicate-prevention
  const handleApply = async (jobId) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Check if student is frozen
      try {
        const studentDoc = await getDoc(doc(db, 'students', user.uid));
        const studentData = studentDoc.data();
        
        if (studentData?.freezed?.active) {
          toast.error('Your account is frozen. Contact the Placement Team for assistance.');
          return;
        }
      } catch (error) {
        console.error('Error checking freeze status:', error);
        toast.error('Unable to verify account status. Please try again.');
        return;
      }

      // Guard: prevent duplicate rapid clicks
      if (applying) return;
      setApplying(true);

      const roll = await getCurrentStudentRollNumber();
      // Validate screening answers if required
      if (selectedJob?.screeningQuestions?.length > 0) {
        const unansweredQuestions = selectedJob.screeningQuestions.filter((_, index) => {
          const ans = screeningAnswers[index];
          return ans === undefined || ans === null || String(ans).trim() === '';
        });
        if (unansweredQuestions.length > 0) {
          toast.warning('Please answer all screening questions before applying.');
          return;
        }
      }

      // Normalize screening answers keys to strings
      const screeningAnswersToSave = (() => {
        try {
          const entries = Object.entries(screeningAnswers || {}).map(([k, v]) => [String(k), v]);
          return Object.fromEntries(entries);
        } catch (_) {
          return screeningAnswers || {};
        }
      })();

      const applicationData = {
        jobId: jobId,
        job_id: jobId, // backward compatibility
        student_id: user.uid,
        student_rollNumber: roll || null,
        status: 'pending',
        appliedAt: serverTimestamp(),
        applied_at: serverTimestamp(), // backward compatibility
        updatedAt: serverTimestamp(),
        screening_answers: screeningAnswersToSave,
        job: {
          position: selectedJob.position,
          company: selectedJob.company,
          location: selectedJob.location,
          ctc: selectedJob.ctc || '',
          minCtc: selectedJob.minCtc || '',
          maxCtc: selectedJob.maxCtc || '',
          salary: selectedJob.salary || '',
          minSalary: selectedJob.minSalary || '',
          maxSalary: selectedJob.maxSalary || '',
          basePay: selectedJob.basePay || '',
          variablePay: selectedJob.variablePay || '',
          bonuses: selectedJob.bonuses || '',
          compensationType: selectedJob.compensationType || '',
          ctcUnit: selectedJob.ctcUnit || '',
          salaryUnit: selectedJob.salaryUnit || '',
          jobTypes: selectedJob.jobTypes || '',
          workMode: selectedJob.workMode || '',
          internshipDuration: selectedJob.internshipDuration || '',
          internshipDurationUnit: selectedJob.internshipDurationUnit || ''
        }
      };

      // Transaction with deterministic document ID to avoid duplicates
      const deterministicId = `${jobId}_${roll || user.uid}`;
      await runTransaction(db, async (tx) => {
        const appRef = doc(db, 'applications', deterministicId);
        const snap = await tx.get(appRef);
        if (snap.exists()) {
          throw new Error('already_applied');
        }
        tx.set(appRef, applicationData);
      });

      setAppliedJobs((prev) => (prev.includes(selectedJob.id) ? prev : [...prev, selectedJob.id]));
      setScreeningAnswers({});
      toast.success('Application submitted successfully!');
      setSelectedJob(null);
    } catch (error) {
      console.error('Error submitting application:', error);
      const msg = String(error?.message || '').toLowerCase().includes('already')
        ? 'You have already applied for this job'
        : 'Error submitting application!';
      toast.error(msg);
    } finally {
      setApplying(false);
    }
  };

  // Remove standalone JSX block
  // {selectedJob.screeningQuestions && selectedJob.screeningQuestions.length > 0 && (
  //   <div className="bg-gray-50 p-6 rounded-lg">
  //     ...
  //   </div>
  // )}

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
  
    // Batch check - ensure all values are strings before calling toLowerCase()
    const studentBatch = String(studentProfile.batch || '').toLowerCase();
    const eligibleBatches = job.eligibleBatch?.map(batch => String(batch)).map(batch => batch.toLowerCase()) || [];
    if (eligibleBatches.length > 0 && !eligibleBatches.some(batch => 
      studentBatch.includes(batch) || batch.includes(studentBatch))) {
      reasons.push(`Batch requirement not met (Your batch: ${studentProfile.batch}, Required: ${job.eligibleBatch?.join(', ')})`);
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

  // Add this state near other state declarations
  // Remove these duplicate declarations (near the bottom)
  // const [selectedJob, setSelectedJob] = useState(null);
  // const [screeningAnswers, setScreeningAnswers] = useState({});

  // Keep the handler function
  const handleViewDetails = (job) => {
    setSelectedJob(job);
  };

  // Create a ScreeningQuestions component
  const ScreeningQuestions = () => {
    if (!selectedJob?.screeningQuestions?.length) return null;
    
    return (
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-xl font-semibold mb-4">Screening Questions</h3>
        <div className="space-y-4">
          {selectedJob.screeningQuestions.map((question, index) => (
            <div key={index} className="border-b pb-3 last:border-b-0 last:pb-0">
              <p className="font-medium mb-2">Question {index + 1}: {question.question}</p>
              <p className="text-sm text-gray-600 mb-3">Type: {question.type}</p>
              
              {/* Text input for open-ended questions */}
              {question.type === 'text' && (
                <textarea
                  className="w-full p-2 border rounded-md"
                  rows="3"
                  placeholder="Enter your answer..."
                  value={screeningAnswers[index] || ''}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                />
              )}

              {/* Radio buttons for yes/no questions */}
              {question.type === 'yes/no' && (
                <div className="space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name={`question-${index}`}
                      value="yes"
                      checked={screeningAnswers[index] === 'yes'}
                      onChange={(e) => handleAnswerChange(index, e.target.value)}
                      className="mr-2"
                    />
                    Yes
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name={`question-${index}`}
                      value="no"
                      checked={screeningAnswers[index] === 'no'}
                      onChange={(e) => handleAnswerChange(index, e.target.value)}
                      className="mr-2"
                    />
                    No
                  </label>
                </div>
              )}

              {/* Radio buttons for multiple choice questions */}
              {question.type === 'multiple_choice' && question.options && (
                <div className="space-y-2">
                  {question.options.map((option, optIndex) => (
                    <label key={optIndex} className="block">
                      <input
                        type="radio"
                        name={`question-${index}`}
                        value={option}
                        checked={screeningAnswers[index] === option}
                        onChange={(e) => handleAnswerChange(index, e.target.value)}
                        className="mr-2"
                      />
                      {option}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Filter and pagination logic
  const getFilteredJobs = () => {
    let filtered = jobs.filter(job => !viewSavedJobs || savedJobs.includes(job.id));
    
    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(job => 
        job.position?.toLowerCase().includes(search) ||
        job.company?.toLowerCase().includes(search) ||
        job.location?.toLowerCase().includes(search) ||
        job.skills?.some(skill => skill.toLowerCase().includes(search))
      );
    }
    
    // Apply filters
    if (filters.jobType !== 'all') {
      filtered = filtered.filter(job => 
        job.jobTypes?.includes(filters.jobType)
      );
    }
    
    if (filters.location !== 'all') {
      filtered = filtered.filter(job => 
        job.location?.toLowerCase().includes(filters.location.toLowerCase())
      );
    }
    
    if (filters.company !== 'all') {
      filtered = filtered.filter(job => 
        job.company?.toLowerCase().includes(filters.company.toLowerCase())
      );
    }
    
    if (filters.eligibility !== 'all') {
      if (filters.eligibility === 'eligible') {
        filtered = filtered.filter(job => checkEligibility(job));
      } else if (filters.eligibility === 'not_eligible') {
        filtered = filtered.filter(job => !checkEligibility(job));
      }
    }
    
    return filtered;
  };

  const filteredJobs = getFilteredJobs();
  const totalJobs = filteredJobs.length;
  const indexOfLastJob = currentPage * jobsPerPage;
  const indexOfFirstJob = indexOfLastJob - jobsPerPage;
  const currentJobs = filteredJobs.slice(indexOfFirstJob, indexOfLastJob);
  const totalPages = Math.ceil(totalJobs / jobsPerPage);

  // Get unique values for filter dropdowns
  const getUniqueJobTypes = () => {
    const types = new Set();
    jobs.forEach(job => {
      if (job.jobTypes && Array.isArray(job.jobTypes)) {
        job.jobTypes.forEach(type => types.add(type));
      }
    });
    return Array.from(types);
  };

  const getUniqueLocations = () => {
    const locations = new Set();
    jobs.forEach(job => {
      if (job.location) locations.add(job.location);
    });
    return Array.from(locations);
  };

  const getUniqueCompanies = () => {
    const companies = new Set();
    jobs.forEach(job => {
      if (job.company) companies.add(job.company);
    });
    return Array.from(companies);
  };

  // Remove the standalone JSX block and use the component in the return statement
  return (
    <div className="p-0 space-y-0">
      {!selectedJob ? (
        // Main job listing view
        <>
          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search jobs by position, company, location, or skills..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1); // Reset to first page on search
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => setViewSavedJobs(!viewSavedJobs)}
                className="px-4 py-2 bg-blue-100 text-gray-600 rounded hover:bg-blue-200 whitespace-nowrap"
              >
                {viewSavedJobs ? 'View All Jobs' : 'View Saved Jobs'}
              </button>
            </div>
            
            {/* Filter Controls */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <select
                value={filters.jobType}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, jobType: e.target.value }));
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Job Types</option>
                {getUniqueJobTypes().map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              
              <select
                value={filters.location}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, location: e.target.value }));
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Locations</option>
                {getUniqueLocations().map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
              
              <select
                value={filters.company}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, company: e.target.value }));
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Companies</option>
                {getUniqueCompanies().map(company => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
              
              <select
                value={filters.eligibility}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, eligibility: e.target.value }));
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Jobs</option>
                <option value="eligible">Eligible Only</option>
                <option value="not_eligible">Not Eligible</option>
              </select>
            </div>
            
            {/* Jobs Count */}
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>
                Showing {indexOfFirstJob + 1}-{Math.min(indexOfLastJob, totalJobs)} of {totalJobs} jobs
                {searchTerm && ` (filtered from ${jobs.length} total)`}
              </span>
              {totalPages > 1 && (
                <span>Page {currentPage} of {totalPages}</span>
              )}
            </div>
          </div>

          {loading ? (
      <div className="fixed top-0 left-0 right-0 bottom-0 bg-gray-100 bg-opacity-80 flex items-center justify-center z-50">
      <Loader />
    </div>
          ) : (
            <>
              {totalJobs > 0 ? (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {currentJobs.map(job => {
                      const isEligible = checkEligibility(job);
                      const isSaved = savedJobs.includes(job.id);
                      const isApplied = appliedJobs.includes(job.id);
        
                      return (
                        <div key={job.id} className="bg-white rounded-lg shadow-sm p-6">
                          {/* Header */}
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-xl font-medium">{job.position}</h3>
                              <p className="text-gray-600">{job.company}</p>
                            </div>
                            <div className="flex items-center">
                              <div className={`px-3 py-1 rounded text-sm ${
                                isEligible 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {isEligible ? 'Eligible' : 'Not Eligible'}
                              </div>
                              {!isEligible && (
                                <button 
                                  onClick={() => {
                                    const issues = getEligibilityDetails(job);
                                    issues.forEach(issue => toast.error(issue));
                                  }}
                                  className="ml-2 w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center hover:bg-gray-300"
                                  title="View eligibility issues"
                                >
                                  <span className="font-semibold text-xs">i</span>
                                </button>
                              )}
                            </div>
                          </div>

            
        
                          <div className="space-y-2 mb-4">
                          <p>

                            <span className="font-medium">Job Type:</span>{' '}
                            {Array.isArray(job.jobTypes) && job.jobTypes.length > 0 
                              ? job.jobTypes.join(', ') 
                              : 'Not specified'}
                          </p>

                            <p><span className="font-medium">Location:</span> {job.location || 'Not specified'}</p>
                            {job.jobTypes?.includes('Full-time') ? (
                              <p><span className="font-medium">CTC:</span> {job.ctc || 'Not specified'}</p>
                            ) : (
                              <p><span className="font-medium">Stipend:</span> {job.salary || 'Not specified'}</p>
                            )}
                            <p><span className="font-medium">Deadline:</span> {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'Not specified'}</p>
                            <p><span className="font-medium">Required CGPA:</span> {job.minCGPA || 'Not specified'}</p>
                            <p><span className="font-medium">Required Skills:</span> {job.skills?.join(', ') || 'None'}</p>
                            {job.skills && job.skills.length > 0 && studentProfile.skills && (
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
                            )}
                          </div>
        
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewDetails(job)}
                              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                              View Details
                            </button>
                            {isApplied ? (
                              <button
                                disabled
                                className="flex-1 px-4 py-2 bg-green-100 text-green-800 rounded cursor-not-allowed"
                              >
                                Applied
                              </button>
                            ) : (
                              !isSaved && (
                                <button
                                  onClick={() => handleSaveJob(job.id)}
                                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                >
                                  Save
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center mt-8 space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    
                    {/* Page Numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 border rounded-lg ${
                            currentPage === pageNum
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                )}
                </>
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
                      className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      View All Jobs
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        // Full page job details view
        <div className="container mx-auto px-3 sm:px-0 py-6">
            <button
              onClick={() => setSelectedJob(null)}
              className="mb-6 flex items-center text-gray-600 hover:text-gray-800"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Jobs
            </button>

            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="mb-6">
                <h2 className="text-3xl font-bold mb-2">{selectedJob.position}</h2>
                <div className="flex justify-between items-center">
                  <p className="text-xl text-gray-600">{selectedJob.company}</p>
                  <button
                    onClick={() => setShowChatPanel(!showChatPanel)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <MessageSquare size={18} />
                    Open Chat
                  </button>
                </div>
              </div>
              




 

              
              {showChatPanel && (
                <JobChat 
                  selectedJob={selectedJob} 
                  onClose={() => setShowChatPanel(false)} 
                />
              )}
              
              {/* Basic Job Information */}
              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h3 className="text-xl font-semibold mb-4">Job Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium">Position:</p>
                    <p>{selectedJob.position || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Company:</p>
                    <p>{selectedJob.company || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Job Type:</p>
                    <p>{Array.isArray(selectedJob.jobTypes) && selectedJob.jobTypes.length > 0 
                      ? selectedJob.jobTypes.join(', ') 
                      : 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Work Mode:</p>
                    <p>{selectedJob.workMode || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Location:</p>
                    <p>{selectedJob.location || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Deadline:</p>
                    <p>{selectedJob.deadline ? new Date(selectedJob.deadline).toLocaleDateString() : 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Interview Date:</p>
                    <p>{selectedJob.interviewDateTime ? new Date(selectedJob.interviewDateTime).toLocaleDateString() : 'Not scheduled'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Joining Date:</p>
                    <p>{selectedJob.joiningDate ? new Date(selectedJob.joiningDate).toLocaleDateString() : 'Not specified'}</p>
                  </div>
                  {selectedJob.jobTypes?.includes('Internship') && (
                    <div>
                      <p className="font-medium">Internship Duration:</p>
                      <p>{selectedJob.internshipDuration || 'Not specified'}</p>
                    </div>
                  )}
                  {selectedJob.jobTypes?.includes('Internship') ? (
                    <div>
                      <p className="font-medium">Stipend:</p>
                      <p>{selectedJob.salary || 'Not specified'}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">CTC:</p>
                      <p>{selectedJob.ctc || 'Not specified'}</p>
                    </div>
                  )}
                  <div>
                    <p className="font-medium">POP Opportunity:</p>
                    <p>{selectedJob.ppoPportunity ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
              
              {/* Eligibility Criteria */}
              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h3 className="text-xl font-semibold mb-4">Eligibility Criteria</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium">Minimum CGPA:</p>
                    <p>{selectedJob.minCGPA || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Gender Preference:</p>
                    <p>{selectedJob.genderPreference || 'Any'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Maximum Current Arrears:</p>
                    <p>{selectedJob.maxCurrentArrears || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Maximum History Arrears:</p>
                    <p>{selectedJob.maxHistoryArrears || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Eligible Batches:</p>
                    <p>{selectedJob.eligibleBatch && selectedJob.eligibleBatch.length > 0 
                      ? selectedJob.eligibleBatch.join(', ') 
                      : 'All batches'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Eligible Departments:</p>
                    <p>{selectedJob.eligibleDepartments && selectedJob.eligibleDepartments.length > 0 
                      ? selectedJob.eligibleDepartments.join(', ') 
                      : 'All departments'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Required Skills:</p>
                    <p>{selectedJob.skills && selectedJob.skills.length > 0 
                      ? selectedJob.skills.join(', ') 
                      : 'None'}</p>
                  </div>
                </div>
              </div>
              
              {/* Job Description - keep the conditional rendering but with improved styling */}
              {selectedJob.description && (
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <h3 className="text-xl font-semibold mb-4">Job Description</h3>
                  <p className="whitespace-pre-wrap">{selectedJob.description}</p>
                </div>
              )}
              
              {/* Additional Instructions */}
              {selectedJob.instructions && (
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <h3 className="text-xl font-semibold mb-4">Additional Instructions</h3>
                  <p className="whitespace-pre-wrap">{selectedJob.instructions}</p>
                </div>
              )}
              
              {/* Hiring Workflow Rounds */}
              {selectedJob.rounds && selectedJob.rounds.length > 0 && (
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <h3 className="text-xl font-semibold mb-4">Hiring Workflow Rounds</h3>
                  <div className="space-y-2">
                    {selectedJob.rounds.map((round, index) => (
                      <div key={index} className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-medium mr-3">
                          {index + 1}
                        </div>
                        <p>{round.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Screening Questions */}
              {selectedJob.screeningQuestions && selectedJob.screeningQuestions.length > 0 && (
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <h3 className="text-xl font-semibold mb-4">Screening Questions</h3>
                  <div className="space-y-4">
                    {selectedJob.screeningQuestions.map((question, index) => (
                      <div key={index} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <p className="font-medium mb-2">Question {index + 1}: {question.question}</p>
                        <p className="text-sm text-gray-600 mb-3">Type: {question.type}</p>
                        
                        <div>
                          {/* Radio buttons for yes/no questions */}
                          {(question.type === 'yes/no' || question.type === 'yesno') && (
                            <div className="space-x-4">
                              <label className="inline-flex items-center">
                                <input
                                  type="radio"
                                  name={`question-${index}`}
                                  value="yes"
                                  checked={screeningAnswers[index] === 'yes'}
                                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                                  className="mr-2"
                                />
                                Yes
                              </label>
                              <label className="inline-flex items-center">
                                <input
                                  type="radio"
                                  name={`question-${index}`}
                                  value="no"
                                  checked={screeningAnswers[index] === 'no'}
                                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                                  className="mr-2"
                                />
                                No
                              </label>
                            </div>
                          )}
                          
                          {/* Text input for text questions */}
                          {question.type === 'text' && (
                            <div>
                              <input
                                type="text"
                                placeholder="Your answer"
                                value={screeningAnswers[index] || ''}
                                onChange={(e) => handleAnswerChange(index, e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* File Attachments */}
              {selectedJob.attachments && selectedJob.attachments.length > 0 && (
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <h3 className="text-xl font-semibold mb-4">File Attachments</h3>
                  <div className="space-y-2">
                    {selectedJob.attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center">
                        <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <a 
                          href={attachment.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {attachment.name || 'Attachment'}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Keep the existing buttons for saving and applying */}
              <div className="flex gap-4 mt-8">
                {!savedJobs.includes(selectedJob.id) && (
                  <button
                    onClick={() => handleSaveJob(selectedJob.id)}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Save Job
                  </button>
                )}
                {!appliedJobs.includes(selectedJob.id) && checkEligibility(selectedJob) && (
                  (() => {
                    // Check if deadline is exceeded
                    const deadline = selectedJob.deadline ? new Date(selectedJob.deadline) : null;
                    const now = new Date();
                    if (deadline && deadline < now) {
                      return (
                        <button
                          disabled
                          className="flex-1 px-6 py-3 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed font-medium"
                        >
                          Time Exceeded
                        </button>
                      );
                    }
                    // Check if screening questions are required and not filled
                    const hasScreening = selectedJob.screeningQuestions && selectedJob.screeningQuestions.length > 0;
                    const allAnswered = hasScreening
                      ? selectedJob.screeningQuestions.every((_, idx) => {
                          const ans = screeningAnswers[idx];
                          return ans !== undefined && ans !== null && String(ans).trim() !== '';
                        })
                      : true;
                    return (
                      <button
                        onClick={() => {
                          if (hasScreening && !allAnswered) {
                            console.log('Screening validation failed', screeningAnswers);
                            toast.warning('Please answer all screening questions before applying.');
                            return;
                          }
                          handleApply(selectedJob.id);
                        }}
                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        Apply Now
                      </button>
                    );
                  })()
                )}
                {appliedJobs.includes(selectedJob.id) && (
                  <button
                    disabled
                    className="flex-1 px-6 py-3 bg-green-100 text-green-800 rounded-lg cursor-not-allowed font-medium"
                  >
                    Applied
                  </button>
                )}
              </div>
              
              {/* Add this new section to display screening answers */}
              {appliedJobs.includes(selectedJob.id) && selectedJob.screeningQuestions && selectedJob.screeningQuestions.length > 0 && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="text-xl font-semibold mb-4">Your Screening Answers</h3>
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    {selectedJob.screeningQuestions.map((question, index) => (
                      <div key={index} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <p className="font-medium mb-2">Question {index + 1}: {question.question}</p>
                        <p className="text-sm text-gray-600 mb-1">Type: {question.type}</p>
                        <div className="bg-white p-3 rounded border">
                          <p className="font-medium text-gray-700">Your Answer:</p>
                          <p className="mt-1">{applicationAnswers[selectedJob.id]?.[String(index)] || 'No answer provided'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        
      )}
    </div>
  );
};

export default JobPost;
