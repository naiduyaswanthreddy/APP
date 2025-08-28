import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  documentId
} from "firebase/firestore";
import { db } from '../../../firebase';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from 'xlsx';
import ApplicationsTable from './ApplicationsTable';
import JobDetailsEdit from './JobDetailsEdit';
import StudentDetailsModal from './StudentDetailsModal';
import JobLogs from './JobLogs';
import PageLoader from '../../ui/PageLoader';
import RoundProgressBar from './RoundProgressBar';
import RoundActionPanel from './RoundActionPanel';
import { createStatusUpdateNotification, createInterviewNotification, createSystemAlertNotification, sendSelectionNotification } from '../../../utils/notificationHelpers';
import { notifyApplicationStatusUpdate, notifyInterviewScheduled, notifyBulkStatusUpdate, notifyStudentSelection } from '../../../utils/adminNotificationHelpers';
import { logJobActivity } from '../../../utils/activityLogger';
import { formatINR } from '../../../utils/formatAmount';

// Dev flag to gate debug logs
const __DEV__ = process.env.NODE_ENV !== 'production';

const JobApplications = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  // State declarations
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdownId && !event.target.closest('.dropdown-container')) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [selectedApplications, setSelectedApplications] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editedJob, setEditedJob] = useState(null);
  const [filters, setFilters] = useState({
    eligibility: 'all',
    department: 'all',
    gender: 'all',
    cgpaMin: '',
    currentArrearsMax: '',
    historyArrearsMax: '',
    searchTerm: '',
    roundStatus: 'all',
  });
  const roundStatusConfig = {
    pending: { label: '⏳ Pending', class: 'bg-gray-100 text-gray-800', icon: '⏳' },
    shortlisted: { label: '✅ Shortlisted', class: 'bg-green-100 text-green-800', icon: '✅' },
    waitlisted: { label: '🟡 Waitlisted', class: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
    rejected: { label: '⚠️ Rejected', class: 'bg-red-100 text-red-800', icon: '⚠️' },
    selected: { label: '🌟 Selected', class: 'bg-purple-100 text-purple-800', icon: '🌟' },
    placed: { label: '🎉 Placed', class: 'bg-blue-100 text-blue-800', icon: '🎉' }
  };
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [applicationsPerPage, setApplicationsPerPage] = useState(25);
  // Round management states
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [editingRounds, setEditingRounds] = useState(false);
  const [roundShortlists, setRoundShortlists] = useState({});
  // New Round Information Module states
  const [selectedRoundTransition, setSelectedRoundTransition] = useState('');
  const [availableRounds, setAvailableRounds] = useState([]);
  const [currentRound, setCurrentRound] = useState('');
  const [roundLoading, setRoundLoading] = useState(false);
  // Column management
  const [visibleColumns, setVisibleColumns] = useState([
    'name', 'rollNumber', 'department', 'cgpa', 'email', 'phone', 'currentArrears', 'historyArrears',
    'skills', /* hide by default: 'tenthPercentage', 'twelfthPercentage', 'diplomaPercentage' */ 'gender', 'roundStatus', 'resume', 'predict',
    'question1', 'question2', 'feedback', 'rounds'
  ]);
  const allPossibleColumns = [
    'name', 'rollNumber', 'department', 'cgpa', 'email', 'phone', 'currentArrears', 'historyArrears',
    'skills', 'match', 'roundStatus', 'resume', 'predict', 'question1', 'question2', 'feedback',
    'tenthPercentage', 'twelfthPercentage', 'diplomaPercentage', 'gender', 'rounds' // Add more from student data
  ];
  // Fixed display order for columns in UI and table rendering
  const modalColumnOrder = [
    'name',
    'rollNumber',
    'department',
    'cgpa',
    'email',
    'phone',
    'currentArrears',
    'historyArrears',
    'skills',
    'tenthPercentage',
    'twelfthPercentage',
    'diplomaPercentage',
    'gender',
    'resume',
    'predict',
    'feedback',
    'roundStatus',
    'rounds'
  ];
  const orderedModalColumns = useMemo(() => {
    const set = new Set();
    const ordered = [];
    // 1) known columns in fixed order
    modalColumnOrder.forEach(k => {
      if (allPossibleColumns.includes(k)) { ordered.push(k); set.add(k); }
    });
    // 2) question columns q1..qN at the end in numeric order
    const qCols = allPossibleColumns.filter(c => /^q\d+$/i.test(c));
    qCols.sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    qCols.forEach(c => { if (!set.has(c)) { ordered.push(c); set.add(c); } });
    // 3) any remaining
    const remaining = allPossibleColumns.filter(c => !set.has(c));
    remaining.sort();
    remaining.forEach(c => ordered.push(c));
    return ordered;
  }, [allPossibleColumns, job?.screeningQuestions]);
  // Column selector modal state
  const [showColumnModal, setShowColumnModal] = useState(false);
  // Table settings: page size input shown in the Customize Columns modal
  const [pageSizeInput, setPageSizeInput] = useState(25);
  // Add state for dynamic question filters
  const [questionFilters, setQuestionFilters] = useState({});
  
  // Enhanced round management states
  const [applicantCounts, setApplicantCounts] = useState({});
  const [isRoundActionLoading, setIsRoundActionLoading] = useState(false);

  // Helper: resolve an existing round key in student's rounds to avoid creating new keys due to label variations
  const resolveExistingRoundKey = useCallback((desiredName, roundsMap) => {
    if (!desiredName || !roundsMap) return null;
    
    // First, try exact match (case-insensitive)
    const exactMatch = Object.keys(roundsMap).find(key => 
      key.toLowerCase().trim() === desiredName.toLowerCase().trim()
    );
    if (exactMatch) return exactMatch;
    
    // Second, try normalized exact match (remove extra spaces, normalize common variations)
    const norm = (s) => String(s || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/shortlisting/g, 'shortlist')
      .replace(/interview round/g, 'interview');
    
    const targetNorm = norm(desiredName);
    const normalizedMatch = Object.keys(roundsMap).find(key => 
      norm(key) === targetNorm
    );
    if (normalizedMatch) return normalizedMatch;
    
    // If no match found, return null to prevent creating new rounds
    // This ensures only existing rounds are updated
    return null;
  }, []);
  // Define fetchJobAndApplications before using it in useEffect
  const __DEV__ = process.env.NODE_ENV !== 'production';
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchJobAndApplications = useCallback(async () => {
    if (isFetchingRef.current) {
      __DEV__ && console.log('Fetch skipped: already in progress');
      return;
    }
    isFetchingRef.current = true;
    setLoading(true);
    __DEV__ && console.log('Fetching job and applications for jobId:', jobId);
    try {
      const jobRef = doc(db, "jobs", jobId);
      const jobSnap = await getDoc(jobRef);
      
      __DEV__ && console.log('Job snapshot exists:', jobSnap.exists());
      if (jobSnap.exists()) {
        __DEV__ && console.log('Job data:', jobSnap.data());
        // Add date validation helper function
        const validateDate = (dateValue) => {
          if (!dateValue) return null;
          // Handle Firestore Timestamp objects
          if (dateValue && typeof dateValue.toDate === 'function') {
            return dateValue.toDate();
          }
          // Handle regular date strings/objects
          const date = new Date(dateValue);
          return isNaN(date.getTime()) ? null : date;
        };
        const jobData = {
          id: jobSnap.id,
          ...jobSnap.data(),
          // Map all form fields with their possible alternative names
          company: jobSnap.data().company || jobSnap.data().companyName || '',
          position: jobSnap.data().position || '',
          description: jobSnap.data().description || jobSnap.data().jobDescription || '',
          location: jobSnap.data().location || jobSnap.data().jobLocation || '',
          // Complete salary/compensation data
          salary: jobSnap.data().salary || '',
          minSalary: jobSnap.data().minSalary || '',
          maxSalary: jobSnap.data().maxSalary || '',
          ctc: jobSnap.data().ctc || '',
          minCtc: jobSnap.data().minCtc || '',
          maxCtc: jobSnap.data().maxCtc || '',
          basePay: jobSnap.data().basePay || '',
          variablePay: jobSnap.data().variablePay || '',
          bonuses: jobSnap.data().bonuses || '',
          compensationType: jobSnap.data().compensationType || '',
          ctcUnit: jobSnap.data().ctcUnit || '',
          salaryUnit: jobSnap.data().salaryUnit || '',
          // Validate dates before assigning
          deadline: validateDate(jobSnap.data().deadline || jobSnap.data().applicationDeadline),
          interviewDateTime: validateDate(jobSnap.data().interviewDateTime || jobSnap.data().interviewDate),
          genderPreference: jobSnap.data().genderPreference || 'Any',
          jobType: jobSnap.data().jobType || (Array.isArray(jobSnap.data().jobTypes) ? jobSnap.data().jobTypes[0] : '') || '',
          experience: jobSnap.data().experience || jobSnap.data().requiredExperience || '',
          instructions: jobSnap.data().instructions || jobSnap.data().applicantInstructions || '',
          // Academic requirements
          minCGPA: jobSnap.data().minCGPA || jobSnap.data().eligibilityCriteria?.cgpa || '',
          maxCurrentArrears: jobSnap.data().maxCurrentArrears || jobSnap.data().eligibilityCriteria?.currentArrears || '',
          maxHistoryArrears: jobSnap.data().maxHistoryArrears || jobSnap.data().eligibilityCriteria?.historyArrears || '',
          // Arrays with fallbacks
          eligibleBatch: Array.isArray(jobSnap.data().eligibleBatch) ? jobSnap.data().eligibleBatch :
                        (jobSnap.data().eligibilityCriteria?.batch ? [jobSnap.data().eligibilityCriteria.batch] : []),
          eligibleDepartments: Array.isArray(jobSnap.data().eligibleDepartments) ? jobSnap.data().eligibleDepartments :
                              (Array.isArray(jobSnap.data().eligibilityCriteria?.department) ? jobSnap.data().eligibilityCriteria.department : []),
          skills: Array.isArray(jobSnap.data().skills) ? jobSnap.data().skills :
                 (Array.isArray(jobSnap.data().requiredSkills) ? jobSnap.data().requiredSkills : []),
          rounds: Array.isArray(jobSnap.data().rounds) ? jobSnap.data().rounds :
                 (Array.isArray(jobSnap.data().hiringWorkflow) ? jobSnap.data().hiringWorkflow : []),
          screeningQuestions: Array.isArray(jobSnap.data().screeningQuestions) ? jobSnap.data().screeningQuestions : [],
          attachments: Array.isArray(jobSnap.data().attachments) ? jobSnap.data().attachments :
                      (Array.isArray(jobSnap.data().fileAttachments) ? jobSnap.data().fileAttachments : []),
          currentRoundIndex: jobSnap.data().currentRoundIndex || 0, // Add current round index
          currentRound: jobSnap.data().currentRound || ''
        };
        setJob(jobData);
        setEditedJob(jobData); // This will ensure all fields are available in the edit modal
        setCurrentRoundIndex(jobData.currentRoundIndex);
        
        // Initialize currentRound based on currentRoundIndex
        const initialRoundName = Array.isArray(jobData.rounds) && jobData.rounds[jobData.currentRoundIndex || 0]
          ? (jobData.rounds[jobData.currentRoundIndex || 0]?.name || jobData.rounds[jobData.currentRoundIndex || 0]?.roundName || `Round ${(jobData.currentRoundIndex || 0) + 1}`)
          : '';
        setCurrentRound(initialRoundName);
        // Fetch applications for this job
        const applicationsRef = collection(db, "applications");
        // Try both field names to ensure we find applications
        const q1 = query(applicationsRef, where("jobId", "==", jobId));
        const q2 = query(applicationsRef, where("job_id", "==", jobId));
     
        const querySnapshot1 = await getDocs(q1);
        const querySnapshot2 = await getDocs(q2);
        
        __DEV__ && console.log('Query 1 results (jobId):', querySnapshot1.size);
        __DEV__ && console.log('Query 2 results (job_id):', querySnapshot2.size);
     
        // Combine results from both queries
        const combinedDocs = [...querySnapshot1.docs, ...querySnapshot2.docs];
        // Remove duplicates if any (in case an application has both fields)
        const uniqueDocs = combinedDocs.filter((doc, index, self) =>
          index === self.findIndex((d) => d.id === doc.id)
        );
        
        __DEV__ && console.log('Combined unique docs:', uniqueDocs.length);

        // Build base applications quickly without extra per-doc reads
        const baseApplications = uniqueDocs.map((appDoc) => ({ id: appDoc.id, ...appDoc.data() }));

        // Collect unique student IDs for batch fetch
        const uniqueStudentIds = Array.from(new Set(
          baseApplications
            .map(a => a.student_id || a.studentId || (a.student || a.studentData || {}).id)
            .filter(Boolean)
        ));

        // Helper to chunk arrays (Firestore 'in' max 10)
        const chunkArray = (arr, size = 10) => {
          const chunks = [];
          for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
          return chunks;
        };

        // Batch fetch students by ID
        const studentsRef = collection(db, 'students');
        const studentChunks = chunkArray(uniqueStudentIds, 10);
        const studentDocs = [];
        for (const ids of studentChunks) {
          const qs = query(studentsRef, where(documentId(), 'in', ids));
          const snap = await getDocs(qs);
          studentDocs.push(...snap.docs);
        }
        const studentMap = new Map(studentDocs.map(d => [d.id, d.data()]));

        // Merge student data and fallback to existing embedded data
        const applicationsData = baseApplications.map(appData => {
          const existingStudent = appData.student || appData.studentData || {};
          const candidateId = appData.student_id || appData.studentId || existingStudent.id;
          const fetchedStudent = candidateId ? studentMap.get(candidateId) : null;

          const findStudentField = (fieldName, alternatives = []) => {
            if (existingStudent[fieldName]) return existingStudent[fieldName];
            for (const alt of alternatives) { if (appData[alt]) return appData[alt]; }
            const variations = [
              fieldName,
              `student_${fieldName}`,
              `student${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`,
              fieldName.toLowerCase(),
              fieldName.toUpperCase()
            ];
            for (const variation of variations) { if (appData[variation]) return appData[variation]; }
            return null;
          };

          const mergedStudent = {
            id: candidateId || 'unknown',
            name: (fetchedStudent?.name) || findStudentField('name', ['studentName','fullName','student_name']) || 'N/A',
            rollNumber: (fetchedStudent?.rollNumber) || findStudentField('rollNumber', ['roll','studentRollNumber','student_rollNumber']) || 'N/A',
            department: (fetchedStudent?.department) || findStudentField('department', ['dept','studentDepartment','student_department']) || 'N/A',
            cgpa: (fetchedStudent?.cgpa) || findStudentField('cgpa', ['gpa','studentCgpa','student_cgpa']) || '0',
            email: (fetchedStudent?.email) || findStudentField('email', ['studentEmail','student_email']) || 'N/A',
            phone: (fetchedStudent?.phone) || findStudentField('phone', ['mobile','contact','studentPhone','student_phone']) || 'N/A',
            currentArrears: (fetchedStudent?.currentArrears) || findStudentField('currentArrears', ['arrears','current_arrears','studentCurrentArrears']) || '0',
            historyArrears: (fetchedStudent?.historyArrears) || findStudentField('historyArrears', ['history_arrears','studentHistoryArrears']) || '0',
            skills: Array.isArray(fetchedStudent?.skills) ? fetchedStudent.skills : (Array.isArray(existingStudent.skills) ? existingStudent.skills : []),
            tenthPercentage: (fetchedStudent?.tenthPercentage) || findStudentField('tenthPercentage', ['tenth','10th','studentTenthPercentage']) || 'N/A',
            twelfthPercentage: (fetchedStudent?.twelfthPercentage) || findStudentField('twelfthPercentage', ['twelfth','12th','studentTwelfthPercentage']) || 'N/A',
            diplomaPercentage: (fetchedStudent?.diplomaPercentage) || findStudentField('diplomaPercentage', ['diploma','studentDiplomaPercentage']) || 'N/A',
            gender: (fetchedStudent?.gender) || findStudentField('gender', ['sex','studentGender']) || 'N/A',
            // Merge rounds from multiple sources, prioritize application document data
            rounds: {
              ...(fetchedStudent?.rounds || {}),
              ...(existingStudent.rounds || {}),
              ...(appData.student_rounds || {}),
              // Write application-level last so it takes precedence
              ...(appData.student?.rounds || {}),
              ...(appData.rounds || {})
            }
          };

          return {
            ...appData,
            student: mergedStudent,
            reachedRound: appData.reachedRound || 0,
          };
        });

        __DEV__ && console.log('Fetched applications (optimized):', applicationsData.length);
        if (!isMountedRef.current) return;
        setApplications(applicationsData);
        setFilteredApplications(applicationsData);
        // Initialize round shortlists and calculate applicant counts
        const shortlists = {};
        const counts = {};
        if (Array.isArray(jobData.rounds)) {
          jobData.rounds.forEach((_, index) => {
            const roundApplicants = applicationsData.filter(app => {
              const studentRounds = app.student?.rounds || {};
              const appRounds = app.rounds || {};
              // For round 0, show all applicants
              if (index === 0) return true;
              // For subsequent rounds, only show shortlisted from previous round
              const prevRoundName = jobData.rounds[index - 1]?.name || jobData.rounds[index - 1]?.roundName || `Round ${index}`;
              const resolvedPrevKey = resolveExistingRoundKey(prevRoundName, studentRounds) || resolveExistingRoundKey(prevRoundName, appRounds) || prevRoundName;
              const prevStatus = studentRounds[resolvedPrevKey] || appRounds[resolvedPrevKey] || 'pending';
              return prevStatus === 'shortlisted';
            });
            shortlists[index] = roundApplicants.map(app => app.id);
            counts[index] = roundApplicants.length;
          });
          // Count selected candidates
          counts.selected = applicationsData.filter(app => {
            const studentRounds = app.student?.rounds || {};
            const appRounds = app.rounds || {};
            return [...Object.values(studentRounds), ...Object.values(appRounds)].includes('selected');
          }).length;
        }
        setRoundShortlists(shortlists);
        setApplicantCounts(counts);
      } else {
        toast.error("Job not found!");
        navigate('/admin/manage-applications');
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      if (isMountedRef.current) toast.error("Error loading job data");
    } finally {
      if (isMountedRef.current) setLoading(false);
      isFetchingRef.current = false;
    }
  }, [jobId, navigate]);
  // Fetch data on mount and when jobId changes (avoid dependency on function identity)
  useEffect(() => {
    fetchJobAndApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);
  // Filter applications based on round information module
  useEffect(() => {
    if (!job) return;
    let filtered = applications;
    // Round eligibility filter
    if (selectedRoundTransition && currentRound) {
      filtered = filtered.filter(app => {
        const studentData = app.studentData || app.student || {};
        const rounds = studentData.rounds || {};
        return isStudentEligibleForRound(studentData, currentRound, rounds);
      });
    }
    // Eligibility filter
    if (filters.eligibility !== 'all') {
      const isEligible = filters.eligibility === 'eligible';
      filtered = filtered.filter(app => {
        const student = app.student || {};
        const meetsGPA = !job.minCGPA || parseFloat(student.cgpa || '0') >= parseFloat(job.minCGPA);
        const meetsCurrentArrears = !job.maxCurrentArrears || parseInt(student.currentArrears || '0') <= parseInt(job.maxCurrentArrears);
        const meetsHistoryArrears = !job.maxHistoryArrears || parseInt(student.historyArrears || '0') <= parseInt(job.maxHistoryArrears);
        return isEligible ? (meetsGPA && meetsCurrentArrears && meetsHistoryArrears) : !(meetsGPA && meetsCurrentArrears && meetsHistoryArrears);
      });
    }
    // Department filter (single-select)
    if (filters.department && filters.department !== 'all') {
      filtered = filtered.filter(app => (app.student?.department || '') === filters.department);
    }
    // Gender filter (single-select)
    if (filters.gender && filters.gender !== 'all') {
      const g = app => (app.student?.gender || 'N/A');
      filtered = filtered.filter(app => g(app) === filters.gender);
    }
    // CGPA min filter
    if (filters.cgpaMin !== '' && filters.cgpaMin !== null && filters.cgpaMin !== undefined) {
      filtered = filtered.filter(app => parseFloat(app.student?.cgpa || '0') >= parseFloat(filters.cgpaMin));
    }
    // Current arrears max filter
    if (filters.currentArrearsMax !== '' && filters.currentArrearsMax !== null && filters.currentArrearsMax !== undefined) {
      filtered = filtered.filter(app => parseInt(app.student?.currentArrears || '0') <= parseInt(filters.currentArrearsMax));
    }
    // History arrears max filter
    if (filters.historyArrearsMax !== '' && filters.historyArrearsMax !== null && filters.historyArrearsMax !== undefined) {
      filtered = filtered.filter(app => parseInt(app.student?.historyArrears || '0') <= parseInt(filters.historyArrearsMax));
    }
    // Search filter (space-separated multi-term)
    if (filters.searchTerm) {
      const terms = filters.searchTerm.trim().split(/\s+/);
      filtered = filtered.filter(app => {
        const name = (app.student?.name || '').toLowerCase();
        const roll = (app.student?.rollNumber || '').toLowerCase();
        return terms.some(term =>
          name.includes(term.toLowerCase()) ||
          roll.includes(term.toLowerCase())
        );
      });
    }
    // Round status filter
    if (filters.roundStatus && filters.roundStatus !== 'all') {
      filtered = filtered.filter(app => {
        const studentData = app.studentData || app.student || {};
        const rounds = studentData.rounds || {};
        return (rounds[currentRound] || 'pending') === filters.roundStatus;
      });
    }
    // Add per-question filtering logic
    if (job && Array.isArray(job.screeningQuestions)) {
      job.screeningQuestions.forEach((q, i) => {
        const col = `q${i + 1}`;
        if (visibleColumns.includes(col)) {
          if (q.type === 'Yes/No' && questionFilters[col] && questionFilters[col] !== 'all') {
            filtered = filtered.filter(app => {
              const ans = (app.screening_answers && app.screening_answers[i]) || '';
              return ans === questionFilters[col];
            });
          } else if (q.type === 'Number' && questionFilters[col]) {
            filtered = filtered.filter(app => {
              const ans = parseFloat((app.screening_answers && app.screening_answers[i]) || '');
              return !isNaN(ans) && ans >= parseFloat(questionFilters[col]);
            });
          }
        }
      });
    }
    __DEV__ && console.debug('Filtering debug:', {
      originalApplicationsLength: applications.length,
      filteredApplicationsLength: filtered.length,
      filters
    });
    setFilteredApplications(filtered);
  }, [applications, filters, job, selectedRoundTransition, currentRound, visibleColumns, questionFilters]);
  
  // Also update applicant counts for the current round when filteredApplications change
  useEffect(() => {
    // Safeguards
    if (!job || !Array.isArray(job.rounds)) return;
    const counts = { ...applicantCounts };
    counts[currentRoundIndex] = filteredApplications.length;
    setApplicantCounts(counts);
  }, [filteredApplications, job, currentRoundIndex]);
  // Pagination logic (memoized to stabilize props)
  const { indexOfFirstApp, indexOfLastApp, currentApplications, totalPages } = useMemo(() => {
    const last = currentPage * applicationsPerPage;
    const first = last - applicationsPerPage;
    const slice = filteredApplications.slice(first, last);
    return {
      indexOfFirstApp: first,
      indexOfLastApp: last,
      currentApplications: slice,
      totalPages: Math.ceil(filteredApplications.length / applicationsPerPage)
    };
  }, [filteredApplications, currentPage, applicationsPerPage]);

  __DEV__ && console.debug('Pagination debug:', {
    filteredApplicationsLength: filteredApplications.length,
    currentPage,
    applicationsPerPage,
    indexOfFirstApp,
    indexOfLastApp,
    currentApplicationsLength: currentApplications.length,
    totalPages
  });
  // Update the handleStudentClick function to ensure skills is always an array
  // Update the handleStudentClick function to fetch student's applications
  const handleStudentClick = async (student) => {
    // Make sure skills is always an array before setting the selected student
    const studentWithValidSkills = {
      ...student,
      skills: Array.isArray(student.skills) ? student.skills : []
    };
 
    try {
      // Fetch all applications for this student
      const applicationsRef = collection(db, "applications");
      const q = query(applicationsRef, where("student_id", "==", student.id));
      const querySnapshot = await getDocs(q);
   
      const studentApplications = [];
   
      // Process each application and get job details
      await Promise.all(querySnapshot.docs.map(async (appDoc) => {
        const appData = { id: appDoc.id, ...appDoc.data() };
     
        // Fetch job details for this application
        try {
          const jobId = appData.jobId || appData.job_id;
          if (jobId) {
            const jobRef = doc(db, "jobs", jobId);
            const jobSnap = await getDoc(jobRef);
         
            if (jobSnap.exists()) {
              appData.job = {
                id: jobSnap.id,
                ...jobSnap.data()
              };
            }
          }
        } catch (error) {
          console.error("Error fetching job details:", error);
        }
     
        studentApplications.push(appData);
      }));
   
      // Add applications data and analytics to student object
      studentWithValidSkills.applications = studentApplications;
   
      // Calculate analytics
      const statusCounts = studentApplications.reduce((acc, app) => {
        const status = app.student?.rounds?.[currentRound] || 'pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
   
      studentWithValidSkills.analytics = {
        totalApplications: studentApplications.length,
        statusCounts
      };
   
      setSelectedStudent(studentWithValidSkills);
    } catch (error) {
      console.error("Error fetching student applications:", error);
      toast.error("Failed to load student application data");
      setSelectedStudent(studentWithValidSkills);
    }
  };
  // Function to delete job
  const handleDeleteJob = async () => {
    try {
      await deleteDoc(doc(db, "jobs", jobId));
      toast.success("Job deleted successfully");
      navigate('/admin/manage-applications');
      // Log activity (best effort)
      try { await logJobActivity(jobId, 'job_deleted', { company: job?.company, position: job?.position }); } catch {}
    } catch (error) {
      console.error("Error deleting job:", error);
      toast.error("Failed to delete job");
    }
  };
  // Function to update company statistics when application status changes
  const updateCompanyStats = async (companyName) => {
    try {
      if (!companyName) return;
      const companyQuery = query(collection(db, 'companies'), where('companyName', '==', companyName));
      const companySnapshot = await getDocs(companyQuery);
      if (!companySnapshot.empty) {
        const companyDoc = companySnapshot.docs[0];
        const companyRef = doc(db, 'companies', companyDoc.id);

        // Count total jobs posted by company
        const jobsQuery = query(collection(db, 'jobs'), where('company', '==', companyName));
        const jobsSnapshot = await getDocs(jobsQuery);
        const jobCount = jobsSnapshot.size;

        // Count total applications for company's jobs
        let totalApplications = 0;
        let selectedCount = 0;
        for (const jobDoc of jobsSnapshot.docs) {
          const applicationsQuery = query(collection(db, 'applications'), where('job_id', '==', jobDoc.id));
          const applicationsSnapshot = await getDocs(applicationsQuery);
          totalApplications += applicationsSnapshot.size;
          selectedCount += applicationsSnapshot.docs.filter(app => app.data().status === 'selected').length;
        }

        await updateDoc(companyRef, {
          jobPostingsCount: jobCount,
          totalApplications: totalApplications,
          selectedStudentsCount: selectedCount
        });
      }
    } catch (error) {
      console.error('Error updating company stats:', error);
    }
  };

  // Function to update round status with validation
  const handleRoundStatusUpdate = async (applicationId, newStatus) => {
    try {
      // Validate the new status
      if (!Object.keys(roundStatusConfig).includes(newStatus)) {
        toast.error("Invalid round status value");
        return;
      }
      // Find the application to update
      const applicationToUpdate = applications.find(app => app.id === applicationId);
      if (!applicationToUpdate) {
        toast.error("Application not found");
        return;
      }
      const applicationRef = doc(db, "applications", applicationId);
      // Resolve the correct existing round key to avoid creating a new round label
      const studentRoundsMap = applicationToUpdate?.student?.rounds || {};
      const resolvedKey = resolveExistingRoundKey(currentRound, studentRoundsMap) || currentRound;

      // Determine where the rounds map exists in this document
      const hasTopLevelRounds = applicationToUpdate && typeof applicationToUpdate.rounds === 'object' && applicationToUpdate.rounds !== null;

      // Build field-path updates to only touch the intended round key
      const fieldUpdates = {
        updatedAt: new Date(),
        lastModifiedBy: 'admin',
        companyName: job?.company
      };

      if (hasTopLevelRounds) {
        fieldUpdates[`rounds.${resolvedKey}`] = newStatus;
      } else {
        fieldUpdates[`student.rounds.${resolvedKey}`] = newStatus;
      }

      await updateDoc(applicationRef, fieldUpdates);
      // Update company stats after status change
      await updateCompanyStats(job?.company);
      // Log activity for round status update (best effort)
      try {
        await logJobActivity(jobId, 'round_status_updated', {
          applicationId,
          studentId: applicationToUpdate.student?.id || applicationToUpdate.studentId || applicationToUpdate.student_id,
          round: resolvedKey,
          status: newStatus
        });
      } catch {}
      // Update local state
      const updatedApplications = applications.map(app => {
        if (app.id !== applicationId) return app;

        const nextApp = { ...app };
        // Sync student.rounds
        nextApp.student = {
          ...(app.student || {}),
          rounds: {
            ...(app.student?.rounds || {}),
            [resolvedKey]: newStatus
          }
        };
        // Sync top-level rounds if it exists on this document
        if (hasTopLevelRounds) {
          nextApp.rounds = {
            ...(app.rounds || {}),
            [resolvedKey]: newStatus
          };
        }
        nextApp.updatedAt = new Date();
        nextApp.lastModifiedBy = 'admin';
        nextApp.companyName = job?.company;
        return nextApp;
      });
      setApplications(updatedApplications);
      setFilteredApplications(updatedApplications);
      setOpenDropdownId(null); // Close dropdown
      toast.success(`Round status updated to ${newStatus}`);

      // Recalculate selected count for progress bar immediately
      try {
        const counts = { ...applicantCounts };
        counts.selected = updatedApplications.filter(app => {
          const studentRounds = app.student?.rounds || {};
          const appRounds = app.rounds || {};
          return [...Object.values(studentRounds), ...Object.values(appRounds)].includes('selected');
        }).length;
        setApplicantCounts(counts);
      } catch (e) {
        console.warn('Failed to recompute applicantCounts.selected', e);
      }

      // Send student notification with push notification
      try {
        const recipientId = applicationToUpdate.student?.id || applicationToUpdate.studentId || applicationToUpdate.student_id;
        if (recipientId) {
          // Send push notification
          await notifyApplicationStatusUpdate({
            job: { position: job?.position || 'Unknown Position', company: job?.company || 'Company' },
            status: newStatus
          }, recipientId);
          
          // Also send traditional notification
          const sendEmail = window.confirm('Also email the student about this status update?');
          await createStatusUpdateNotification(recipientId, {
            job: { position: job?.position || 'Unknown Position', company: job?.company || 'Company' },
            status: newStatus
          }, sendEmail);
        }
      } catch (notifyErr) {
        console.error('Error sending status update notification/email:', notifyErr);
      }
    } catch (error) {
      console.error("Error updating round status:", error);
      toast.error(`Failed to update round status: ${error.message}`);
    }
  };
  // Enhanced bulk actions handler
  const handleEnhancedBulkAction = async (actionType) => {
    if (!job || !job.rounds) {
      toast.error('Job rounds not configured');
      return;
    }

    setIsRoundActionLoading(true);
    
    try {
      const batch = writeBatch(db);
      const timestamp = new Date();
      const currentRoundName = job.rounds[currentRoundIndex]?.name || job.rounds[currentRoundIndex]?.roundName || `Round ${currentRoundIndex + 1}`;
      const nextRoundName = job.rounds[currentRoundIndex + 1]?.name || job.rounds[currentRoundIndex + 1]?.roundName || `Round ${currentRoundIndex + 2}`;
      const isFinalRound = currentRoundIndex >= job.rounds.length - 1;
      
      let applicationsToProcess = [];
      let applicationsToReject = [];
      
      let applicationsToWaitlist = [];
      
      switch (actionType) {
        case 'shortlist':
          applicationsToProcess = applications.filter(app => selectedApplications.includes(app.id));
          applicationsToReject = filteredApplications.filter(app => !selectedApplications.includes(app.id));
          break;
          
        case 'select':
          applicationsToProcess = applications.filter(app => selectedApplications.includes(app.id));
          applicationsToReject = filteredApplications.filter(app => !selectedApplications.includes(app.id));
          break;
          
        case 'waitlist':
          applicationsToWaitlist = applications.filter(app => selectedApplications.includes(app.id));
          break;
          
        case 'reject':
          applicationsToReject = applications.filter(app => selectedApplications.includes(app.id));
          break;
          
        
          
        case 'reject-remaining':
          applicationsToProcess = applications.filter(app => selectedApplications.includes(app.id));
          applicationsToReject = filteredApplications.filter(app => !selectedApplications.includes(app.id));
          break;
      }
      
      // Process shortlisted/selected applications (create or update the current round key)
      for (const app of applicationsToProcess) {
        const studentRounds = app.student?.rounds || {};
        const currentKey = resolveExistingRoundKey(currentRoundName, studentRounds) || currentRoundName;

        const statusForApp = (actionType === 'select' || (isFinalRound && actionType === 'shortlist')) ? 'selected' : 'shortlisted';
        const appRef = doc(db, 'applications', app.id);

        const updates = {
          updatedAt: timestamp,
          lastModifiedBy: 'admin',
          status: statusForApp
        };

        const hasTopLevelRounds = app && typeof app.rounds === 'object' && app.rounds !== null;
        // Always write to both application-level maps for robustness
        updates[`rounds.${currentKey}`] = statusForApp;
        updates[`student.rounds.${currentKey}`] = statusForApp;

        batch.update(appRef, updates);

        // Optionally reflect on student doc as a single-field path update
        if (app.student?.id) {
          const studentRef = doc(db, 'students', app.student.id);
          batch.update(studentRef, {
            [`rounds.${currentKey}`]: statusForApp
          });
        }
        
        // Send notifications
        try {
          if (actionType === 'select' || (isFinalRound && actionType === 'shortlist')) {
            await sendSelectionNotification(
              app.student?.id,
              jobId,
              job?.position || 'Unknown Position',
              job?.company || 'Company',
              true
            );
          } else {
            await createStatusUpdateNotification(app.student?.id, {
              job: { position: job?.position, company: job?.company },
              status: 'shortlisted'
            });
          }
        } catch (notifyErr) {
          console.error('Error sending notification:', notifyErr);
        }
      }
      
      // Process waitlisted applications (create or update the current round key)
      for (const app of applicationsToWaitlist) {
        const studentRounds = app.student?.rounds || {};
        const currentKey = resolveExistingRoundKey(currentRoundName, studentRounds) || currentRoundName;

        const appRef = doc(db, 'applications', app.id);
        const updates = {
          updatedAt: timestamp,
          lastModifiedBy: 'admin',
          status: 'onHold'
        };
        const hasTopLevelRounds = app && typeof app.rounds === 'object' && app.rounds !== null;
        updates[`rounds.${currentKey}`] = 'waitlisted';
        updates[`student.rounds.${currentKey}`] = 'waitlisted';
        batch.update(appRef, updates);

        if (app.student?.id) {
          const studentRef = doc(db, 'students', app.student.id);
          batch.update(studentRef, {
            [`rounds.${currentKey}`]: 'waitlisted'
          });
        }
        
        // Send waitlist notification
        try {
          await createStatusUpdateNotification(app.student?.id, {
            job: { position: job?.position, company: job?.company },
            status: 'waitlisted'
          });
        } catch (notifyErr) {
          console.error('Error sending waitlist notification:', notifyErr);
        }
      }
      
      // Process rejected applications (create or update the current round key)
      for (const app of applicationsToReject) {
        const studentRounds = app.student?.rounds || {};
        const currentKey = resolveExistingRoundKey(currentRoundName, studentRounds) || currentRoundName;

        const appRef = doc(db, 'applications', app.id);
        const updates = {
          updatedAt: timestamp,
          lastModifiedBy: 'admin'
        };
        const hasTopLevelRounds = app && typeof app.rounds === 'object' && app.rounds !== null;
        updates[`rounds.${currentKey}`] = 'rejected';
        updates[`student.rounds.${currentKey}`] = 'rejected';
        batch.update(appRef, updates);

        if (app.student?.id) {
          const studentRef = doc(db, 'students', app.student.id);
          batch.update(studentRef, {
            [`rounds.${currentKey}`]: 'rejected'
          });
        }
        
        // Send rejection notification
        try {
          await createStatusUpdateNotification(app.student?.id, {
            job: { position: job?.position, company: job?.company },
            status: 'rejected'
          });
        } catch (notifyErr) {
          console.error('Error sending rejection notification:', notifyErr);
        }
      }
      
      await batch.commit();
      
      // Update job's current round ONLY if operating on the job's current round view and moving forward
      const jobCurrentIdx = job?.currentRoundIndex ?? 0;
      if (
        currentRoundIndex === jobCurrentIdx &&
        applicationsToProcess.length > 0 &&
        !isFinalRound &&
        (actionType === 'shortlist' || actionType === 'reject-remaining')
      ) {
        const nextIndex = currentRoundIndex + 1;
        await updateDoc(doc(db, 'jobs', jobId), {
          currentRoundIndex: nextIndex,
          currentRound: nextRoundName
        });
        setCurrentRoundIndex(nextIndex);
        setJob(prev => ({ ...prev, currentRoundIndex: nextIndex, currentRound: nextRoundName }));
        // Log current round changed
        try { await logJobActivity(jobId, 'current_round_changed', { fromIndex: nextIndex - 1, toIndex: nextIndex, toName: nextRoundName }); } catch {}
      }
      
      // Send admin notification
      try {
        await createSystemAlertNotification(
          'Round Action Completed',
          `${applicationsToProcess.length} students processed, ${applicationsToReject.length} students rejected for ${currentRoundName}`,
          `/admin/job-applications/${jobId}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }
      
      toast.success(`Action completed successfully! ${applicationsToProcess.length} shortlisted, ${applicationsToReject.length} rejected.`);
      setSelectedApplications([]);
      await fetchJobAndApplications(); // Refresh data
      
    } catch (error) {
      console.error('Error in enhanced bulk action:', error);
      toast.error(`Failed to complete action: ${error.message}`);
    } finally {
      setIsRoundActionLoading(false);
    }
  };

  // Function to handle bulk actions with validation (legacy support)
  const handleBulkAction = async (newStatus) => {
    if (selectedApplications.length === 0) {
      toast.warning("No applications selected");
      return;
    }
    // Validate the new status
    if (!Object.keys(roundStatusConfig).includes(newStatus)) {
      toast.error("Invalid round status value");
      return;
    }
    try {
      const batch = writeBatch(db);
      const timestamp = new Date();
      // Get current status of all selected applications for tracking changes
      const selectedApps = applications.filter(app => selectedApplications.includes(app.id));
      
      // Determine the current round name from the job data and current round index
      const actualCurrentRound = job?.rounds?.[currentRoundIndex]?.name || job?.rounds?.[currentRoundIndex]?.roundName || `Round ${currentRoundIndex + 1}`;
      console.log(`Bulk action for round: "${actualCurrentRound}" (index: ${currentRoundIndex})`);
      
      for (const app of selectedApps) {
        const applicationId = app.id;
        const studentRoundsMap = app.student?.rounds || {};
        console.log(`Processing app ${applicationId}, student rounds:`, Object.keys(studentRoundsMap));
        
        const resolvedKey = resolveExistingRoundKey(actualCurrentRound, studentRoundsMap);
        console.log(`Resolved key for "${actualCurrentRound}": "${resolvedKey}"`);
        
        // Only update if we found an exact match for the round
        if (resolvedKey && resolvedKey in studentRoundsMap) {
          const appRef = doc(db, "applications", applicationId);
          batch.update(appRef, {
            [`student.rounds.${resolvedKey}`]: newStatus,
            updatedAt: timestamp,
            lastModifiedBy: 'admin',
            bulkUpdateId: timestamp.getTime(),
            companyName: job?.company
          });
          console.log(`Updated app ${applicationId}: ${resolvedKey} -> ${newStatus}`);
        } else {
          console.warn(`Skipping application ${applicationId}: Round "${actualCurrentRound}" not found in student rounds. Available rounds:`, Object.keys(studentRoundsMap));
        }
      }
      await batch.commit();
      // Update local state with full change tracking using the actual current round
      const updatedApplications = applications.map(app => {
        if (selectedApplications.includes(app.id)) {
          const studentRoundsMap = app.student?.rounds || {};
          const resolvedKey = resolveExistingRoundKey(actualCurrentRound, studentRoundsMap);
          
          if (resolvedKey && resolvedKey in studentRoundsMap) {
            return {
              ...app,
              student: {
                ...app.student || {},
                rounds: {
                  ...app.student?.rounds || {},
                  [resolvedKey]: newStatus
                }
              },
              updatedAt: timestamp,
              lastModifiedBy: 'admin',
              bulkUpdateId: timestamp.getTime(),
              companyName: job?.company
            };
          }
        }
        return app;
      });
      setApplications(updatedApplications);
      setFilteredApplications(updatedApplications);
      const statusChanges = selectedApps.map(app => `${app.student?.name || 'Unknown Student'} → ${newStatus}`).join('\n');
      toast.success(
        `Successfully updated ${selectedApplications.length} applications\n${statusChanges}`,
        { autoClose: 5000 } // Give users more time to read the detailed message
      );
      // Ask once whether to email students
      const sendEmailAll = window.confirm('Send email to all selected students about this update?');

      try {
        for (const app of selectedApps) {
          const recipientId = app.student?.id || app.studentId || app.student_id;
          if (!recipientId) continue;
          await createStatusUpdateNotification(recipientId, {
            job: { position: job?.position || 'Unknown Position', company: job?.company || 'Company' },
            status: newStatus
          }, sendEmailAll);
        }
      } catch (notifyBulkErr) {
        console.error('Error sending bulk status notifications/emails:', notifyBulkErr);
      }

      setSelectedApplications([]); // Clear selection
    } catch (error) {
      console.error("Error in bulk update:", error);
      toast.error(`Failed to update applications: ${error.message}`);
    }
  };
  // Function to shortlist for next round (bulk shortlist)
  const handleShortlistForNextRound = async () => {
    if (selectedApplications.length === 0) {
      toast.warning("No applications selected");
      return;
    }
    try {
      const batch = writeBatch(db);
      const nextRound = currentRoundIndex + 1;
      selectedApplications.forEach(appId => {
        const appRef = doc(db, "applications", appId);
        batch.update(appRef, { reachedRound: nextRound });
      });
      await batch.commit();
      const updatedApps = applications.map(app =>
        selectedApplications.includes(app.id) ? { ...app, reachedRound: nextRound } : app
      );
      setApplications(updatedApps);
      setFilteredApplications(updatedApps);
      // Update shortlists
      const newShortlists = { ...roundShortlists };
      if (!newShortlists[nextRound]) newShortlists[nextRound] = [];
      newShortlists[nextRound].push(...selectedApplications);
      setRoundShortlists(newShortlists);
      toast.success(`Shortlisted ${selectedApplications.length} candidates for next round`);
      setSelectedApplications([]);
    } catch (error) {
      toast.error("Failed to shortlist candidates");
    }
  };
  // Function to complete current round
  const handleCompleteRound = async () => {
    const nextIndex = currentRoundIndex + 1;
    if (nextIndex >= job.rounds.length) {
      toast.warning("All rounds completed");
      return;
    }
    try {
      const jobRef = doc(db, "jobs", jobId);
      await updateDoc(jobRef, { currentRoundIndex: nextIndex });
      setCurrentRoundIndex(nextIndex);
      setJob({ ...job, currentRoundIndex: nextIndex });
      toast.success("Round completed successfully");
      // Log round completed
      try {
        await logJobActivity(jobId, 'round_completed', {
          fromIndex: nextIndex - 1,
          toIndex: nextIndex,
        });
      } catch {}
    } catch (error) {
      toast.error("Failed to complete round");
    }
  };
  // Function to edit round shortlist
  const handleEditRoundShortlist = (roundIndex, newShortlist) => {
    const newShortlists = { ...roundShortlists, [roundIndex]: newShortlist };
    setRoundShortlists(newShortlists);
    // Persist to DB if needed (batch update applications' reachedRound)
  };
  // Function to edit rounds
  const handleEditRounds = async (newRounds) => {
    try {
      const jobRef = doc(db, "jobs", jobId);
      await updateDoc(jobRef, { rounds: newRounds });
      setJob({ ...job, rounds: newRounds });
      setEditingRounds(false);
      toast.success("Rounds updated successfully");
      // Log rounds edited
      try {
        await logJobActivity(jobId, 'rounds_updated', {
          rounds: (newRounds || []).map(r => r?.name || r?.roundName || '').filter(Boolean),
          count: (newRounds || []).length
        });
      } catch {}
    } catch (error) {
      toast.error("Failed to update rounds");
    }
  };
  
  // Handle round click from progress bar
  const handleRoundClick = (roundIndex) => {
    // Allow navigation to any completed round and the current job round
    const maxNavigableIndex = Math.max(currentRoundIndex, job?.currentRoundIndex ?? 0);
    if (roundIndex <= maxNavigableIndex) {
      setCurrentRoundIndex(roundIndex);
      const roundName = job?.rounds?.[roundIndex]?.name || job?.rounds?.[roundIndex]?.roundName || `Round ${roundIndex + 1}`;
      setCurrentRound(roundName);
      // Log round view change (best effort)
      try { logJobActivity(jobId, 'round_view_changed', { roundIndex, roundName }); } catch {}
    }
  };
  
  // Handle select all in current filtered view
  const handleSelectAllApplications = () => {
    try {
      const allIds = filteredApplications.map(app => app.id);
      setSelectedApplications(allIds);
    } catch (e) {
      console.warn('handleSelectAllApplications failed', e);
    }
  };
  
  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedApplications([]);
  };

  // Jump back to the job's current round quickly
  const goToCurrentRound = () => {
    const jobIdx = job?.currentRoundIndex ?? 0;
    setCurrentRoundIndex(jobIdx);
    const roundName = job?.rounds?.[jobIdx]?.name || job?.rounds?.[jobIdx]?.roundName || `Round ${jobIdx + 1}`;
    setCurrentRound(roundName);
    try { logJobActivity(jobId, 'round_view_changed', { roundIndex: jobIdx, roundName }); } catch {}
  };
  // Function to export data to Excel with all content
  const exportToExcel = () => {
    if (selectedApplications.length === 0) {
      toast.warning("No applications selected for export");
      return;
    }

    // Filter selected applications
    const selectedData = applications.filter(app => selectedApplications.includes(app.id));

    // Format data for Excel with all possible fields
    const excelData = selectedData.map(app => {
      const row = {
        'Name': app.student?.name || 'N/A',
        'Roll Number': app.student?.rollNumber || 'N/A',
        'Department': app.student?.department || 'N/A',
        'CGPA': app.student?.cgpa || 'N/A',
        'Email': app.student?.email || 'N/A',
        'Phone': app.student?.phone || 'N/A',
        'Current Arrears': app.student?.currentArrears || 'N/A',
        'History Arrears': app.student?.historyArrears || 'N/A',
        'Skills': Array.isArray(app.student?.skills) ? app.student.skills.join(', ') : 'N/A',
        '10th Percentage': app.student?.tenthPercentage || 'N/A',
        '12th Percentage': app.student?.twelfthPercentage || 'N/A',
        'Diploma Percentage': app.student?.diplomaPercentage || 'N/A',
        'Gender': app.student?.gender || 'N/A',
        'Round Status': roundStatusConfig?.[app.student?.rounds?.[currentRound]]?.label || 'Pending',
        'Feedback': app.feedback || '',
        'Resume': app.resume || '',
        'Predict': app.predict || ''
      };

      // Add dynamic screening question columns aligned with answers
      const questions = Array.isArray(job?.screeningQuestions) ? job.screeningQuestions : [];
      const answers = Array.isArray(app.screening_answers) ? app.screening_answers : [];

      if (questions.length > 0) {
        questions.forEach((q, idx) => {
          const labelBase = q?.question ? `Q${idx + 1}: ${q.question}` : `Q${idx + 1}`;
          const ans = answers[idx];
          row[labelBase] = (ans !== undefined && ans !== null) ? ans : '';
        });
      } else if (Array.isArray(app.answers)) {
        // Legacy fallback if job questions are unavailable but answers exist under a legacy key
        app.answers.forEach((ans, idx) => {
          row[`Q${idx + 1}`] = (ans !== undefined && ans !== null) ? ans : '';
        });
      }

      return row;
    });

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Applications");
 
    // Generate Excel file
    XLSX.writeFile(workbook, `${job?.company}_${job?.position}_Applications.xlsx`);
    toast.success("Excel file exported successfully");
  };
  // Function to export data to PDF
  const exportToPDF = () => {
    // This is a placeholder - you would need to implement PDF export
    // using a library like jsPDF or react-pdf
    toast.info("PDF export functionality will be implemented soon");
  };
  const legacyCurrentRound = job?.rounds?.[currentRoundIndex]?.name || job?.rounds?.[currentRoundIndex]?.roundName || job?.currentRound || 'N/A';
  const legacyNextRound = job?.rounds?.[currentRoundIndex + 1]?.name || job?.rounds?.[currentRoundIndex + 1]?.roundName || 'N/A';
  // Round Information Module functions
  const generateRoundTransitions = (rounds) => {
    if (!Array.isArray(rounds) || rounds.length < 1) {
      return [];
    }
 
    const transitions = [];
    for (let i = 0; i < rounds.length - 1; i++) {
      const roundName = rounds[i].name || rounds[i].roundName || `R${i + 1}`;
      const nextRoundName = rounds[i + 1].name || rounds[i + 1].roundName || `R${i + 2}`;
      transitions.push(`${roundName} ➝ ${nextRoundName}`);
    }
    if (rounds.length > 0) {
      const lastRoundName = rounds[rounds.length - 1].name || rounds[rounds.length - 1].roundName || `R${rounds.length}`;
      transitions.push(lastRoundName);
    }
    return transitions;
  };
  const getCurrentRoundFromTransition = (transition) => {
    if (!transition) return '';
    if (!transition.includes(' ➝ ')) return transition;
    const parts = transition.split(' ➝ ');
    return parts[0] || '';
  };
  const getNextRoundFromTransition = (transition) => {
    if (!transition) return '';
    if (!transition.includes(' ➝ ')) return '';
    const parts = transition.split(' ➝ ');
    return parts[1] || '';
  };
  const isStudentEligibleForRound = (studentData, roundName, roundsStatus) => {
    if (!job || !job.rounds) return false;
    const roundIndex = job.rounds.findIndex(r => (r.name || r.roundName) === roundName);
    if (roundIndex === -1) return false;
    if (roundIndex === 0) return true;
    const prevRoundName = job.rounds[roundIndex - 1].name || job.rounds[roundIndex - 1].roundName;
    return roundsStatus[prevRoundName] === 'shortlisted';
  };
  const handleRoundTransitionChange = (transition) => {
    setSelectedRoundTransition(transition);
    const currentRoundName = getCurrentRoundFromTransition(transition);
    setCurrentRound(currentRoundName);
    setSelectedApplications([]);
  };
  const handleShortlistStudents = async () => {
    if (selectedApplications.length === 0) {
      toast.error('Please select at least one student to shortlist');
      return;
    }
    setRoundLoading(true);
    try {
      const batch = writeBatch(db);
      
      // Determine next round based on selected transition
      const nextRound = selectedRoundTransition ? getNextRoundFromTransition(selectedRoundTransition) : null;
    
      // Shortlist selected
      for (const applicationId of selectedApplications) {
        const application = applications.find(app => app.id === applicationId);
        if (application) {
          const studentData = application.student || {};
          const currentRounds = studentData.rounds || {};
      
          const updatedRounds = { ...currentRounds };
          const currentKey = resolveExistingRoundKey(currentRound, currentRounds) || currentRound;
          const nextKey = nextRound ? resolveExistingRoundKey(nextRound, currentRounds) : null;
          if (nextRound) {
            if (currentKey in updatedRounds) {
              updatedRounds[currentKey] = 'shortlisted';
            }
            if (nextKey && (nextKey in updatedRounds)) {
              updatedRounds[nextKey] = 'pending';
            }
          } else {
            // Finalize at last round → mark as selected in rounds
            if (currentKey in updatedRounds) {
              updatedRounds[currentKey] = 'selected';
            }
          }
       
          const studentRef = doc(db, "students", application.student.id);
          batch.update(studentRef, {
            rounds: updatedRounds
          });
       
          const applicationRef = doc(db, "applications", applicationId);
          batch.update(applicationRef, {
            [`student.rounds`]: updatedRounds,
            // If this is the final round and we are finalizing (no nextRound), mark as selected
            ...(nextRound ? {} : { status: 'selected' })
          });

          // Send notification to student
          try {
            if (nextRound) {
              await createStatusUpdateNotification(application.student.id, {
                job: { position: application.job?.position || 'Unknown Position', company: application.job?.company || job?.company },
                status: 'shortlisted'
              });
            } else {
              // Finalize shortlist at final round → Selected and notify to accept/reject
              await createStatusUpdateNotification(application.student.id, {
                job: { position: application.job?.position || 'Unknown Position', company: application.job?.company || job?.company },
                status: 'selected'
              });
              await sendSelectionNotification(
                application.student.id,
                application.jobId || application.job_id || jobId,
                application.job?.position || job?.position || 'Unknown Position',
                application.job?.company || job?.company || 'Company',
                true
              );
            }
          } catch (error) {
            console.error('Error sending shortlist notification:', error);
          }
        }
      }
      // Reject remaining eligible students for current round
      const eligibleIds = filteredApplications.map(app => app.id);
      const remainingIds = eligibleIds.filter(id => !selectedApplications.includes(id));
      for (const applicationId of remainingIds) {
        const application = applications.find(app => app.id === applicationId);
        if (application) {
          const studentData = application.student || {};
          const currentRounds = studentData.rounds || {};
          const updatedRounds = { ...currentRounds };
          const currentKey = resolveExistingRoundKey(currentRound, currentRounds) || currentRound;
          if (currentKey in updatedRounds) {
            updatedRounds[currentKey] = 'rejected';
          }
          const studentRef = doc(db, "students", application.student.id);
          batch.update(studentRef, {
            rounds: updatedRounds
          });
       
          const applicationRef = doc(db, "applications", applicationId);
          batch.update(applicationRef, {
            [`student.rounds`]: updatedRounds
          });

          // Send notification to student
          try {
            await createStatusUpdateNotification(application.student.id, {
              job: { position: application.job?.position || 'Unknown Position', company: application.job?.company || job?.company },
              status: 'rejected'
            });
          } catch (error) {
            console.error('Error sending rejection notification:', error);
          }
        }
      }
   
      await batch.commit();
   
      // Update current round to next round if exists (keep index and name in sync)
      if (nextRound) {
        const nextIndex = Array.isArray(job?.rounds)
          ? job.rounds.findIndex(r => (r.name || r.roundName) === nextRound)
          : -1;
        await updateDoc(doc(db, "jobs", jobId), {
          currentRound: nextRound,
          ...(nextIndex >= 0 ? { currentRoundIndex: nextIndex } : {})
        });
        if (nextIndex >= 0) {
          setCurrentRoundIndex(nextIndex);
          setJob(prev => prev ? { ...prev, currentRoundIndex: nextIndex, currentRound: nextRound } : prev);
        } else {
          setJob(prev => prev ? { ...prev, currentRound: nextRound } : prev);
        }
      } else {
        // No next round: finalized. Leave job current round as is
      }

      // Send admin notification about the action
      try {
        await createSystemAlertNotification(
          'Students Shortlisted',
          `${selectedApplications.length} students have been shortlisted for ${currentRound} round. ${remainingIds.length} students were rejected.`,
          `/admin/job-applications/${jobId}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }
   
      toast.success(`${selectedApplications.length} students shortlisted successfully!`);
      setSelectedApplications([]);
      fetchJobAndApplications();
    } catch (error) {
      console.error('Error shortlisting students:', error);
      toast.error('Failed to shortlist students');
    } finally {
      setRoundLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      const applicationsRef = collection(db, "applications");
      const q = query(applicationsRef, where("jobId", "==", jobId));
      const querySnapshot = await getDocs(q);
      
      const applicationsData = [];
      for (const doc of querySnapshot.docs) {
        const applicationData = doc.data();
        const studentRef = doc(db, "students", applicationData.studentId);
        const studentSnap = await getDoc(studentRef);
        
        if (studentSnap.exists()) {
          applicationsData.push({
            id: doc.id,
            ...applicationData,
            student: {
              id: studentSnap.id,
              ...studentSnap.data()
            }
          });
        }
      }
      
      setApplications(applicationsData);
      setFilteredApplications(applicationsData);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to fetch applications');
    }
  };

  const handleRejectStudents = async () => {
    if (selectedApplications.length === 0) {
      toast.error('Please select students to reject');
      return;
    }

    try {
      setRoundLoading(true);
      const batch = writeBatch(db);

      for (const applicationId of selectedApplications) {
        const application = applications.find(app => app.id === applicationId);
        if (application) {
          const studentData = application.student || {};
          const currentRounds = studentData.rounds || {};
       
          const updatedRounds = {
            ...currentRounds,
            [currentRound]: 'rejected'
          };
       
          const studentRef = doc(db, "students", application.student.id);
          batch.update(studentRef, {
            rounds: updatedRounds
          });
       
          const applicationRef = doc(db, "applications", applicationId);
          batch.update(applicationRef, {
            [`student.rounds`]: updatedRounds
          });

          // Send notification to student
          try {
            await createStatusUpdateNotification(application.student.id, {
              job: { position: application.job?.position || 'Unknown Position' },
              status: 'rejected'
            });
          } catch (error) {
            console.error('Error sending rejection notification:', error);
          }
        }
      }
   
      await batch.commit();

      // Send admin notification about the action
      try {
        await createSystemAlertNotification(
          'Students Rejected',
          `${selectedApplications.length} students have been rejected for ${currentRound} round.`,
          `/admin/job-applications/${jobId}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }
   
      toast.success(`${selectedApplications.length} students rejected successfully!`);
      setSelectedApplications([]);
      fetchJobAndApplications();
    } catch (error) {
      console.error('Error rejecting students:', error);
      toast.error('Failed to reject students');
    } finally {
      setRoundLoading(false);
    }
  };

  const scheduleInterview = async (applicationId, interviewDateTime) => {
    try {
      const application = applications.find(app => app.id === applicationId);
      if (!application) return;

        const applicationRef = doc(db, "applications", applicationId);
      await updateDoc(applicationRef, {
        interviewDateTime: interviewDateTime,
        status: 'interview_scheduled',
        updatedAt: new Date()
      });

      // Send interview notification to student
      try {
        await createInterviewNotification(application.student.id, {
          job: { position: application.job?.position || 'Unknown Position' },
          interviewDateTime: interviewDateTime
        });
      } catch (error) {
        console.error('Error sending interview notification:', error);
      }

      // Send admin notification
      try {
        await createSystemAlertNotification(
          'Interview Scheduled',
          `Interview scheduled for ${application.student?.name || 'Student'} on ${interviewDateTime.toDate ? interviewDateTime.toDate().toLocaleString() : new Date(interviewDateTime).toLocaleString()}`,
          `/admin/job-applications/${jobId}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success('Interview scheduled successfully!');
      fetchApplications();
    } catch (error) {
      console.error('Error scheduling interview:', error);
      toast.error('Failed to schedule interview');
    }
  };
  // Initialize round transitions when job data is loaded
  useEffect(() => {
    if (job) {
      const roundsArray = job.rounds || job.hiringWorkflow || [];
      const transitions = generateRoundTransitions(roundsArray);
      setAvailableRounds(transitions);
      // Prefer the job's current round if available
      const preferredRoundName = job.currentRound || roundsArray?.[currentRoundIndex]?.name || roundsArray?.[currentRoundIndex]?.roundName || '';
      if (preferredRoundName) {
        const match = transitions.find(t => getCurrentRoundFromTransition(t) === preferredRoundName) || transitions[0];
        if (match) {
          setSelectedRoundTransition(match);
          setCurrentRound(getCurrentRoundFromTransition(match));
        }
      } else if (transitions.length > 0 && !selectedRoundTransition) {
        setSelectedRoundTransition(transitions[0]);
        const currentRoundName = getCurrentRoundFromTransition(transitions[0]);
        setCurrentRound(currentRoundName);
      }
    }
  }, [job, currentRoundIndex]);
  // When job is loaded, update columns and filters for dynamic questions
  useEffect(() => {
    if (job && Array.isArray(job.screeningQuestions)) {
      // Add dynamic question columns (q1, q2, ...) to allPossibleColumns and visibleColumns if not present
      const dynamicCols = job.screeningQuestions.map((q, i) => `q${i + 1}`);
      // Merge with static columns
      const newAllPossibleColumns = [
        'name', 'rollNumber', 'department', 'cgpa', 'email', 'phone', 'currentArrears', 'historyArrears',
        'skills', 'match', 'roundStatus', 'resume', 'predict', 'feedback', 'tenthPercentage', 'twelfthPercentage', 'diplomaPercentage', 'gender', 'rounds',
        ...dynamicCols
      ];
      // Only add new dynamic columns to visibleColumns if not already present
      setVisibleColumns(prev => {
        const base = prev.filter(col => !col.startsWith('q'));
        return [...base, ...dynamicCols];
      });
      // Update allPossibleColumns
      // (If you want to keep it in state, otherwise just use this array in the column selector)
      // Initialize questionFilters for each question
      const newFilters = {};
      job.screeningQuestions.forEach((q, i) => {
        if (q.type === 'Yes/No') newFilters[`q${i + 1}`] = 'all';
        else if (q.type === 'Number') newFilters[`q${i + 1}`] = '';
        else newFilters[`q${i + 1}`] = '';
      });
      setQuestionFilters(newFilters);
    }
  }, [job]);
  
  
  return (
    <div className="p-7 sm:px-6 lg:px-8 max-w-[1170px] mx-auto">
      <ToastContainer />
      {/* Back Button */}
      <div className="flex items-center -mt-6 mb-2">
        <button onClick={() => navigate('/admin/manage-applications')} className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 mr-4">
          ← Back to All Jobs
        </button>
      </div>
      {/* Main Content */}
      <div className="space-y-8">
        {/* Header Section with Job Details */}
        <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-lg border border-blue-100 overflow-hidden mt-4">
           {/* Header with gradient background */}
           <div className="bg-gradient-to-r from-slate-300 to-slate-400 p-6 text-gray-800">
             <div className="flex justify-between items-start">
               <div className="flex-1">
                 <div className="flex items-center gap-3 mb-2">
                   <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                     <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                       <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
                     </svg>
                   </div>
                   <div>
                     <h1 className="text-3xl text-gray-800 font-bold">{job?.company}</h1>
                     <p className="text-gray-800 text-lg">{job?.position}</p>
                   </div>
                 </div>
              
                 {/* Status Badge */}
                 <div className="flex items-center gap-4 mt-3">
                   <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                     job?.jobStatus === 'Open for Applications' ? 'bg-green-500 text-white' :
                     job?.jobStatus === 'Closed' ? 'bg-red-500 text-white' :
                     job?.jobStatus === 'Yet to Open' ? 'bg-yellow-500 text-white' :
                     'bg-gray-500 text-white'
                   }`}>
                     {job?.jobStatus || 'N/A'}
                   </span>
                   <div className="flex items-center gap-2 text-gray-800">
                     <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                     </svg>
                     <span>Deadline: {job?.deadline && (job.deadline.toDate ? job.deadline.toDate().toLocaleDateString() : new Date(job.deadline).toLocaleDateString())}</span>
                   </div>
                 </div>
               </div>
            
               {/* Action Buttons */}
               <div className="flex gap-2 items-center">
                 {/* Total Applicants Display */}
                 <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 text-gray-1000 border border-emerald-500 hover:border-emerald-500 transition-colors duration-200 font-semibold">
                 <span className="text-lg font-semibold ">Total Applicants: {applications.length}</span>
                 </div>
                 <button
                   onClick={() => setShowJobDetails(!showJobDetails)}
                   className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-200 flex items-center gap-2 backdrop-blur-sm"
                 >
                   {showJobDetails ? (
                     <>
                       <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                         <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                       </svg>
                       Hide Details
                     </>
                   ) : (
                     <>
                       <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                         <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                       </svg>
                       View Details
                     </>
                   )}
                 </button>
                 <button
                   onClick={() => navigate(`/admin/jobpost?jobId=${jobId}`)}
                   className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all duration-200 flex items-center gap-2"
                 >
                   <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                     <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                   </svg>
                   Edit
                 </button>
                 <button
                   onClick={() => {
                     if (window.confirm('Are you sure you want to delete this job?')) {
                       handleDeleteJob();
                     }
                   }}
                   className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 flex items-center gap-2"
                 >
                   <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                   </svg>
                   Delete
                 </button>
               </div>
             </div>
           </div>
        
           {/* Job Details Grid */}
           <div className="p-4">
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
               {/* Job Type */}
               <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex items-center gap-2 mb-1">
                   <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                     <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                       <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                   </div>
                   <span className="text-xs font-medium text-gray-500">Job Type</span>
                 </div>
                 <p className="text-sm text-gray-900 font-semibold">{job?.jobTypes || 'N/A'}</p>
               </div>
            
               {/* Category */}
               <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex items-center gap-2 mb-1">
                   <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                     <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                       <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                     </svg>
                   </div>
                   <span className="text-xs font-medium text-gray-500">Category</span>
                 </div>
                 <p className="text-sm text-gray-900 font-semibold">{job?.jobCategory || 'N/A'}</p>
               </div>
            
               {/* Location */}
               <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex items-center gap-2 mb-1">
                   <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
                     <svg className="w-3 h-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                       <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                     </svg>
                   </div>
                   <span className="text-xs font-medium text-gray-500">Location</span>
                 </div>
                 <p className="text-sm text-gray-900 font-semibold">{job?.location || 'N/A'}</p>
               </div>
            
               {/* Work Mode */}
               <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex items-center gap-2 mb-1">
                   <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
                     <svg className="w-3 h-3 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                       <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                     </svg>
                   </div>
                   <span className="text-xs font-medium text-gray-500">Work Mode</span>
                 </div>
                 <p className="text-sm text-gray-900 font-semibold">{job?.workMode || 'N/A'}</p>
               </div>
            




                {/* Stipend Card */}
                <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-gray-500">Stipend</span>
                  </div>
                  <div className="text-sm text-gray-900 font-semibold space-y-1">
                    <div>
                      <span className="text-gray-500 mr-2">Stipend:</span>
                      {(() => {
                        const hasRange = job?.minSalary && job?.maxSalary;
                        const unit = job?.salaryUnit || '';
                        if (hasRange) return `${formatINR(job.minSalary)} - ${formatINR(job.maxSalary)} ${unit}`.trim();
                        if (job?.salary) return `${formatINR(job.salary)} ${unit}`.trim();
                        return 'N/A';
                      })()}
                    </div>
                  </div>
                </div>

                {/* CTC Card */}
                <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-gray-500">CTC</span>
                  </div>
                  <div className="text-sm text-gray-900 font-semibold space-y-1">
                    <div>
                      <span className="text-gray-500 mr-2">CTC:</span>
                      {(() => {
                        const hasRange = job?.minCtc && job?.maxCtc;
                        const unit = job?.ctcUnit || '';
                        if (hasRange) return `${formatINR(job.minCtc)} - ${formatINR(job.maxCtc)} ${unit}`.trim();
                        if (job?.ctc) return `${formatINR(job.ctc)} ${unit}`.trim();
                        return 'N/A';
                      })()}
                    </div>
                  </div>
                </div>






            
               {/* Internship Duration */}
               <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex items-center gap-2 mb-1">
                   <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center">
                     <svg className="w-3 h-3 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                     </svg>
                   </div>
                   <span className="text-xs font-medium text-gray-500">Duration</span>
                 </div>
                 <p className="text-sm text-gray-900 font-semibold">
                   {job?.internshipDuration ? `${job.internshipDuration} ${job.internshipDurationUnit || ''}` : 'N/A'}
                 </p>
               </div>
            
               {/* Job Source */}
               <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex items-center gap-2 mb-1">
                   <div className="w-6 h-6 bg-pink-100 rounded-lg flex items-center justify-center">
                     <svg className="w-3 h-3 text-pink-600" fill="currentColor" viewBox="0 0 20 20">
                       <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                   </div>
                   <span className="text-xs font-medium text-gray-500">Source</span>
                 </div>
                 <p className="text-sm text-gray-900 font-semibold">{job?.jobSource || 'N/A'}</p>
               </div>
            
               {/* Visit Details */}
               <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex items-center gap-2 mb-1">
                   <div className="w-6 h-6 bg-teal-100 rounded-lg flex items-center justify-center">
                     <svg className="w-3 h-3 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                       <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                     </svg>
                   </div>
                   <span className="text-xs font-medium text-gray-500">Visit</span>
                 </div>
                 <p className="text-gray-900 font-semibold text-sm">{job?.modeOfVisit || 'N/A'}</p>
                 <p className="text-xs text-gray-500">
                   {job?.dateOfVisit ? (job.dateOfVisit.toDate ? job.dateOfVisit.toDate().toLocaleDateString() : new Date(job.dateOfVisit).toLocaleDateString()) : 'N/A'}
                 </p>
               </div>
             </div>
           </div>
         
                     {/* Enhanced Job Details Section */}
           {showJobDetails && (
             <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Left Column */}
                 <div className="space-y-6">
                   {/* Basic Information */}
                   <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                     <div className="flex items-center gap-3 mb-4">
                       <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                         <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
                         </svg>
                       </div>
                       <h4 className="text-xl font-bold text-gray-800">Basic Information</h4>
                     </div>
                          <div className="space-y-3">
                       <div className="flex justify-between items-center py-2 border-b border-gray-100">
                         <span className="text-gray-600 font-medium">Company Name</span>
                         <span className="text-gray-900 font-semibold">{job?.company || job?.companyName || 'N/A'}</span>
                       </div>
                       <div className="flex justify-between items-center py-2 border-b border-gray-100">
                         <span className="text-gray-600 font-medium">Position</span>
                         <span className="text-gray-900 font-semibold">{job?.position || 'N/A'}</span>
                       </div>
                       <div className="py-2">
                         <span className="text-gray-600 font-medium block mb-2">Job Description</span>
                          <div
                            className="text-gray-700 bg-gray-50 rounded-lg p-3 text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: require('../../../utils/sanitize').sanitizeHtml(job?.description || job?.jobDescription || 'N/A')
                            }}
                          />
                       </div>
                     </div>
                   </div>
                   {/* Academic Requirements */}
                   <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                     <div className="flex items-center gap-3 mb-4">
                       <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                         <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                           <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                         </svg>
                       </div>
                       <h4 className="text-xl font-bold text-gray-800">Academic Requirements</h4>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="bg-gray-50 rounded-lg p-3">
                         <span className="text-sm text-gray-500 font-medium">Minimum CGPA</span>
                         <p className="text-lg font-bold text-gray-900">{job?.minCGPA || job?.eligibilityCriteria?.cgpa || 'N/A'}</p>
                       </div>
                       <div className="bg-gray-50 rounded-lg p-3">
                         <span className="text-sm text-gray-500 font-medium">Max Current Arrears</span>
                         <p className="text-lg font-bold text-gray-900">{job?.maxCurrentArrears || job?.eligibilityCriteria?.currentArrears || 'N/A'}</p>
                       </div>
                       <div className="bg-gray-50 rounded-lg p-3">
                         <span className="text-sm text-gray-500 font-medium">Max History Arrears</span>
                         <p className="text-lg font-bold text-gray-900">{job?.maxHistoryArrears || job?.eligibilityCriteria?.historyArrears || 'N/A'}</p>
                       </div>
                       <div className="bg-gray-50 rounded-lg p-3">
                         <span className="text-sm text-gray-500 font-medium">Eligible Batch</span>
                         <p className="text-lg font-bold text-gray-900">
                           {Array.isArray(job?.eligibleBatch) && job.eligibleBatch.length > 0
                             ? job.eligibleBatch.join(', ')
                             : job?.eligibilityCriteria?.batch || 'N/A'}
                         </p>
                       </div>
                     </div>
                     <div className="mt-4 bg-gray-50 rounded-lg p-3">
                       <span className="text-sm text-gray-500 font-medium">Eligible Departments</span>
                       <p className="text-lg font-bold text-gray-900">
                         {Array.isArray(job?.eligibleDepartments) && job.eligibleDepartments.length > 0
                           ? job.eligibleDepartments.join(', ')
                           : Array.isArray(job?.eligibilityCriteria?.department) && job.eligibilityCriteria.department.length > 0
                             ? job.eligibilityCriteria.department.join(', ')
                             : 'N/A'}
                       </p>
                     </div>
                   </div>
                 </div>
                 {/* Right Column */}
                 <div className="space-y-6">
                   {/* Job Details */}
                   <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                     <div className="flex items-center gap-3 mb-4">
                       <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                         <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                         </svg>
                       </div>
                       <h4 className="text-xl font-bold text-gray-800">Job Details</h4>
                     </div>
                      <div className="space-y-3">
                       <div className="flex justify-between items-center py-2 border-b border-gray-100">
                         <span className="text-gray-600 font-medium">Location</span>
                         <span className="text-gray-900 font-semibold">{job?.location || job?.jobLocation || 'N/A'}</span>
                       </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-gray-600 font-medium">Salary/Stipend</span>
                          <span className="text-gray-900 font-semibold">
                            {(() => {
                              const hasRange = job?.minSalary && job?.maxSalary;
                              const unit = job?.salaryUnit || '';
                              if (hasRange) return `${formatINR(job.minSalary)} - ${formatINR(job.maxSalary)} ${unit}`.trim();
                              if (job?.salary) return `${formatINR(job.salary)} ${unit}`.trim();
                              return 'N/A';
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-gray-600 font-medium">CTC</span>
                          <span className="text-gray-900 font-semibold">
                            {(() => {
                              const hasRange = job?.minCtc && job?.maxCtc;
                              const unit = job?.ctcUnit || '';
                              if (hasRange) return `${formatINR(job.minCtc)} - ${formatINR(job.maxCtc)} ${unit}`.trim();
                              if (job?.ctc) return `${formatINR(job.ctc)} ${unit}`.trim();
                              return 'N/A';
                            })()}
                          </span>
                        </div>
                       <div className="flex justify-between items-center py-2 border-b border-gray-100">
                         <span className="text-gray-600 font-medium">Application Deadline</span>
                         <span className="text-gray-900 font-semibold">
                           {job?.deadline
                             ? (job.deadline.toDate ? job.deadline.toDate().toLocaleString() : new Date(job.deadline).toLocaleString())
                             : job?.applicationDeadline
                               ? (job.applicationDeadline.toDate ? job.applicationDeadline.toDate().toLocaleString() : new Date(job.applicationDeadline).toLocaleString())
                               : 'N/A'}
                         </span>
                       </div>
                       <div className="flex justify-between items-center py-2 border-b border-gray-100">
                         <span className="text-gray-600 font-medium">Interview Date & Time</span>
                         <span className="text-gray-900 font-semibold">
                           {job?.interviewDateTime
                             ? (job.interviewDateTime.toDate ? job.interviewDateTime.toDate().toLocaleString() : new Date(job.interviewDateTime).toLocaleString())
                             : job?.interviewDate
                               ? (job.interviewDate.toDate ? job.interviewDate.toDate().toLocaleString() : new Date(job.interviewDate).toLocaleString())
                               : 'N/A'}
                         </span>
                       </div>
                       <div className="flex justify-between items-center py-2 border-b border-gray-100">
                         <span className="text-gray-600 font-medium">Gender Preference</span>
                         <span className="text-gray-900 font-semibold">{job?.genderPreference || 'Any'}</span>
                       </div>
                       <div className="flex justify-between items-center py-2 border-b border-gray-100">
                         <span className="text-gray-600 font-medium">Job Type</span>
                                        <p className="text-sl text-gray-900 font-semibold">{job?.jobTypes || 'N/A'}</p>

                       </div>
                       <div className="flex justify-between items-center py-2">
                         <span className="text-gray-600 font-medium">Experience</span>
                         <span className="text-gray-900 font-semibold">{job?.experience || job?.requiredExperience || 'N/A'}</span>
                       </div>
                     </div>
                   </div>
                   {/* Required Skills */}
                   <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                     <div className="flex items-center gap-3 mb-4">
                       <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                         <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                         </svg>
                       </div>
                       <h4 className="text-xl font-bold text-gray-800">Required Skills</h4>
                     </div>
                     <div className="flex flex-wrap gap-2">
                       {Array.isArray(job?.skills) && job.skills.length > 0 ? (
                         job.skills.map((skill, index) => (
                           <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                             {skill}
                           </span>
                         ))
                       ) : Array.isArray(job?.requiredSkills) && job.requiredSkills.length > 0 ? (
                         job.requiredSkills.map((skill, index) => (
                           <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                             {skill}
                           </span>
                         ))
                       ) : (
                         <span className="text-gray-500">No skills specified</span>
                       )}
                     </div>
                   </div>
                 </div>
               </div>
               {/* Bottom Section - Full Width */}
               <div className="mt-8 space-y-6">
                 {/* Instructions to Applicants */}
                 <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                   <div className="flex items-center gap-3 mb-4">
                     <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                       <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                         <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                       </svg>
                     </div>
                     <h4 className="text-xl font-bold text-gray-800">Instructions to Applicants</h4>
                   </div>
                   <div className="bg-gray-50 rounded-lg p-4">
                     <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                       {job?.instructions || job?.applicantInstructions || 'No instructions provided'}
                     </p>
                   </div>
                 </div>
                 {/* Hiring Workflow & Screening Questions */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   {/* Hiring Workflow Rounds */}
                   <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                     <div className="flex items-center gap-3 mb-4">
                       <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                         <svg className="w-5 h-5 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                         </svg>
                       </div>
                       <h4 className="text-xl font-bold text-gray-800">Hiring Workflow</h4>
                     </div>
                     <div className="space-y-2">
                       {Array.isArray(job?.rounds) && job.rounds.length > 0 ? (
                         job.rounds.map((round, index) => (
                           <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                             <div className="w-6 h-6 bg-teal-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                               {index + 1}
                             </div>
                             <span className="font-medium text-gray-800">{round.name || round.roundName || `Round ${index + 1}`}</span>
                           </div>
                         ))
                       ) : Array.isArray(job?.hiringWorkflow) && job.hiringWorkflow.length > 0 ? (
                         job.hiringWorkflow.map((round, index) => (
                           <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                             <div className="w-6 h-6 bg-teal-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                               {index + 1}
                             </div>
                             <span className="font-medium text-gray-800">{round.name || round.roundName || `Round ${index + 1}`}</span>
                           </div>
                         ))
                       ) : (
                         <div className="text-gray-500 text-center py-4">No workflow defined</div>
                       )}
                     </div>
                   </div>
                   {/* Screening Questions */}
                   <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                     <div className="flex items-center gap-3 mb-4">
                       <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                         <svg className="w-5 h-5 text-pink-600" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                         </svg>
                       </div>
                       <h4 className="text-xl font-bold text-gray-800">Screening Questions</h4>
                     </div>
                      <div className="space-y-3">
                        {Array.isArray(job?.screeningQuestions) && job.screeningQuestions.length > 0 ? (
                          job.screeningQuestions.map((q, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-start gap-2">
                                <span className="text-sm font-bold text-gray-500">Q{index + 1}:</span>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-800 mb-1">{q.question || `Question ${index + 1}`}</p>
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full" aria-label="question-type">
                                    {q.type || 'Text Input'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-500 text-center py-4">No screening questions</div>
                        )}
                      </div>
                   </div>
                 </div>
                 {/* File Attachments */}
                 <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                   <div className="flex items-center gap-3 mb-4">
                     <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                       <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                         <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                       </svg>
                     </div>
                     <h4 className="text-xl font-bold text-gray-800">File Attachments</h4>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {Array.isArray(job?.attachments) && job.attachments.length > 0 ? (
                       job.attachments.map((file, index) => (
                         <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                           <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                             <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
                           </svg>
                           <div className="flex-1 min-w-0">
                             <p className="text-sm font-medium text-gray-800 truncate">{file.name || `File ${index + 1}`}</p>
                             <a href={file.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                               {file.link || 'N/A'}
                             </a>
                           </div>
                         </div>
                       ))
                     ) : Array.isArray(job?.fileAttachments) && job.fileAttachments.length > 0 ? (
                       job.fileAttachments.map((file, index) => (
                         <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                           <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                             <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
                           </svg>
                           <div className="flex-1 min-w-0">
                             <p className="text-sm font-medium text-gray-800 truncate">{file.name || `File ${index + 1}`}</p>
                             <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                               {file.url || 'N/A'}
                             </a>
                           </div>
                         </div>
                       ))
                     ) : (
                       <div className="text-gray-500 text-center py-4 col-span-full">No file attachments</div>
                     )}
                   </div>
                 </div>
               </div>
             </div>
           )}
       </div>
        {/* Recruitment Pipeline (moved below company details) */}
        {/* Round Progress Bar */}
        {job && job.rounds && job.rounds.length > 0 && (
          <RoundProgressBar
            rounds={job.rounds}
            currentRoundIndex={currentRoundIndex}
            onRoundClick={handleRoundClick}
            applicantCounts={applicantCounts}
          />
        )}
        
        {/* Viewing Past Round Banner + Action Panel */}
        {job && job.rounds && job.rounds.length > 0 && (
          <>
            {typeof job.currentRoundIndex === 'number' && currentRoundIndex < job.currentRoundIndex && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                <div className="text-sm">
                  <strong>Viewing Past Round:</strong> You are viewing {job.rounds[currentRoundIndex]?.name || job.rounds[currentRoundIndex]?.roundName || `Round ${currentRoundIndex + 1}`}.
                </div>
                <button onClick={goToCurrentRound} className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700">
                  Back to Current Round
                </button>
              </div>
            )}
            <RoundActionPanel
              currentRound={job.rounds[currentRoundIndex]?.name || job.rounds[currentRoundIndex]?.roundName || `Round ${currentRoundIndex + 1}`}
              selectedApplications={selectedApplications}
              filteredApplications={filteredApplications}
              onBulkAction={handleEnhancedBulkAction}
              onSelectAll={handleSelectAllApplications}
              onClearSelection={handleClearSelection}
              isLoading={isRoundActionLoading}
              isFinalRound={currentRoundIndex >= job.rounds.length - 1}
            />
          </>
        )}
        {/* Removed old 'Customize Table Columns' button above filters */}
        {/* Enhanced Filters Section */}
        <div className="p-0 -mb-8">
          {/* Search bar above all filters */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="🔍 Search by name or roll number"
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {/* Filter controls and bulk action buttons */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Eligibility */}
            <select
              value={filters.eligibility}
              onChange={(e) => setFilters({ ...filters, eligibility: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Candidates</option>
              <option value="eligible">Eligible</option>
              <option value="not_eligible">Not Eligible</option>
            </select>
            {/* Department dropdown */}
            <select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Departments</option>
              <option value="CSE">CSE</option>
              <option value="IT">IT</option>
              <option value="ECE">ECE</option>
            </select>
            {/* Gender dropdown */}
            <select
              value={filters.gender}
              onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="N/A">Not Specified</option>
            </select>
            {/* CGPA min */}
            <input
              type="number"
              placeholder="Min CGPA"
              value={filters.cgpaMin}
              onChange={(e) => setFilters({ ...filters, cgpaMin: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {/* Current arrears max */}
            <input
              type="number"
              placeholder="Max Current Arrears"
              value={filters.currentArrearsMax}
              onChange={(e) => setFilters({ ...filters, currentArrearsMax: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {/* History arrears max */}
            <input
              type="number"
              placeholder="Max History Arrears"
              value={filters.historyArrearsMax}
              onChange={(e) => setFilters({ ...filters, historyArrearsMax: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {/* Status filter with pen icon on the right */}
            <div className="flex items-center gap-2 md:col-span-2">
              <select
                value={filters.roundStatus}
                onChange={e => setFilters({ ...filters, roundStatus: e.target.value })}
                className="flex-1 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="rejected">Rejected</option>
                <option value="pending">Pending</option>
              </select>
              <button
                onClick={() => { setPageSizeInput(applicationsPerPage); setShowColumnModal(true); }}
                title="Customize Columns"
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-300 shadow-sm transition-colors duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600">
                  <path d="M15.502 1.94a1.5 1.5 0 0 1 2.121 2.12l-1.06 1.062-2.122-2.12 1.06-1.062z"/>
                  <path d="M14.09 4.353 4.5 13.94V16.5h2.56l9.59-9.588-2.56-2.56z"/>
                </svg>
              </button>
            </div>
            {/* Dynamic question filters */}
            {job && Array.isArray(job.screeningQuestions) && visibleColumns.filter(col => col.startsWith('q')).map(col => {
              const idx = parseInt(col.replace('q', '')) - 1;
              const q = job.screeningQuestions[idx];
              if (!q) return null;
              if (q.type === 'Yes/No') {
                return (
                  <select
                    key={col}
                    value={questionFilters[col] || 'all'}
                    onChange={e => setQuestionFilters(f => ({ ...f, [col]: e.target.value }))}
                    className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                );
              } else if (q.type === 'Number') {
                return (
                  <input
                    key={col}
                    type="number"
                    placeholder={`Min ${q.question || col}`}
                    value={questionFilters[col] || ''}
                    onChange={e => setQuestionFilters(f => ({ ...f, [col]: e.target.value }))}
                    className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                );
              }
              // For other types, no filter or a simple text input if needed
              return null;
            })}
          </div>
          {selectedApplications.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3 justify-end">
              <div className="flex gap-3">
                <button
                  onClick={exportToExcel}
                  className="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors duration-200"
                >
                  📊 Export to Excel
                </button>
                <button
                  onClick={exportToPDF}
                  className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors duration-200"
                >
                  📑 Export to PDF
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Enhanced Applications Table */}
        <ApplicationsTable
          loading={loading}
          filteredApplications={currentApplications} // Paginated
          selectedApplications={selectedApplications}
          setSelectedApplications={setSelectedApplications}
          handleStudentClick={handleStudentClick}
          statusConfig={roundStatusConfig}
          openDropdownId={openDropdownId}
          setOpenDropdownId={setOpenDropdownId}
          dropdownPosition={dropdownPosition}
          setDropdownPosition={setDropdownPosition}
          handleStatusUpdate={handleRoundStatusUpdate}
          visibleColumns={visibleColumns} // Pass visible columns
          currentRound={currentRound} // Pass currentRound
          screeningQuestions={job?.screeningQuestions || []}
          serialOffset={indexOfFirstApp}
        />
        {/* Job Activity Logs */}
        <JobLogs jobId={jobId} />
        {/* Pagination Controls */}
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-4 py-2 rounded-lg ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        {/* Job Details Edit Modal */}
        {editMode && (
          <JobDetailsEdit
            job={editedJob}
            setEditedJob={setEditedJob} // Corrected prop name
            editMode={editMode} // Pass editMode state
            setEditMode={setEditMode} // Pass setEditMode function
            onClose={() => setEditMode(false)} // Keep onClose for clarity if needed, but setEditMode prop is primary
            onSaveSuccess={fetchJobAndApplications} // Re-fetch data after save
          />
        )}
        {/* Student Details Modal */}
        {selectedStudent && (
          <StudentDetailsModal
            student={selectedStudent}
            onClose={() => setSelectedStudent(null)}
            statusConfig={roundStatusConfig}
          />
        )}
        {/* Customize Columns Modal with Applications per page */}
        {showColumnModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Customize Table Columns</h3>
                <button
                  onClick={() => setShowColumnModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              <div className="space-y-5">
                {/* Applications per page */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Applications per page
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={pageSizeInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') { setPageSizeInput(''); return; }
                      const n = parseInt(val, 10);
                      if (!isNaN(n)) setPageSizeInput(n);
                    }}
                    onBlur={() => {
                      let n = parseInt(pageSizeInput, 10);
                      if (isNaN(n) || n < 1) n = 1;
                      if (n > 500) n = 500;
                      setPageSizeInput(n);
                    }}
                    className="w-32 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Default is 25. Range 1–500.</p>
                </div>

                {/* Column checkboxes */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Columns</div>
                  <div className="flex flex-wrap gap-3 max-h-64 overflow-auto pr-1">
                    {orderedModalColumns.map(col => {
                      let label = col.charAt(0).toUpperCase() + col.slice(1).replace(/([A-Z])/g, ' $1');
                      if ((/^q\d+$/i.test(col) || /^question\d+$/i.test(col)) && job?.screeningQuestions) {
                        const idx = parseInt(col.replace(/^[a-zA-Z]+/, ''), 10) - 1;
                        const q = job.screeningQuestions[idx];
                        if (q) label = q.question ? `Q${idx + 1}: ${q.question}` : `Q${idx + 1}`;
                      }
                      return (
                        <label key={col} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={visibleColumns.includes(col)}
                            onChange={() => {
                              setVisibleColumns(prev =>
                                prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
                              );
                            }}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowColumnModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      let n = parseInt(pageSizeInput, 10);
                      if (isNaN(n) || n < 1) n = 1;
                      if (n > 500) n = 500;
                      setApplicationsPerPage(n);
                      setCurrentPage(1);
                      setShowColumnModal(false);
                    }}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default JobApplications;