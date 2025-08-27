import React, { useState, useEffect, useRef } from 'react';
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc, Timestamp, writeBatch, runTransaction } from 'firebase/firestore';
import { logJobActivity } from '../../utils/activityLogger';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { createJobEventNotification, createSystemAlertNotification } from '../../utils/notificationHelpers';
import { notifyJobPosted } from '../../utils/adminNotificationHelpers';

const SKILL_SUGGESTIONS = [
  // Programming Languages
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C", "C#", "Go", "Rust", "Kotlin", "Swift", "PHP", "Ruby", "Dart", "Scala", "R",
  // Frontend Technologies
  "HTML", "CSS", "React", "Angular", "Vue.js", "Svelte", "Next.js", "Bootstrap", "Tailwind",
  // Backend Technologies
  "Node.js", "Express", "Django", "Flask", "Spring", "Laravel", "ASP.NET",
  // Databases
  "MongoDB", "MySQL", "PostgreSQL", "SQLite", "Redis", "Oracle", "Firebase",
  // Other Skills
  "Git", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Linux", "DevOps"
];

const LOCATION_SUGGESTIONS = [
  "Remote", "Hybrid", "Multiple Locations",
  // Major Indian Cities
  "Bangalore", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata",
  "Ahmedabad", "Gurgaon", "Noida", "Coimbatore", "Kochi", "Trivandrum"
];

const DEPARTMENT_SUGGESTIONS = [
  "CSE", "IT", "ECE", "EEE", "ME", "CE", "CHE", "AIE", "CCE", "MBA"
];

const JOB_CATEGORIES = [
  "Tech", "Non-Tech", "Management", "Core", "Finance", "Marketing", "HR", "Operations", "Research", "Design", "Other"
];

const JOB_TAG_SUGGESTIONS = JOB_CATEGORIES;

const DURATION_UNITS = ["Weeks", "Months", "Years"];

const JOB_STATUS_OPTIONS = [
  "Yet to Open", "Open for Applications", "Closed", "In Progress", "Hold", "Cancelled", "Offer Results Pending", "Completed"
];

const COMPENSATION_TYPES = [
  "Fixed Amount", "Range", "Performance Based", "Unpaid", "Not Specified"
];

const COMPENSATION_UNITS = ["Weekly", "Monthly", "Yearly"];

const PREDEFINED_ROUNDS = [
  "Application Screening", "Online Test", "Resume Shortlisting", "Pre-Placement Talk",
  "Group Discussion", "Technical Interview", "HR Interview", "Manager Interview",
  "Behavioral Interview", "Thesis/Project Interview", "Others"
];

// Helper to build a deterministic job ID from key fields
const makeDeterministicJobId = (company, position, deadline) => {
  const norm = (s) => (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const deadlinePart = deadline ? new Date(deadline).toISOString().split('T')[0] : 'no-deadline';
  return `job_${norm(company)}_${norm(position)}_${deadlinePart}`.slice(0, 200);
};

const AnimatedCard = ({ children }) => (
  <div
    className="bg-white/80 rounded-2xl p-8 mb-8 animate-fade-in border border-blue-100"
    style={{
      minHeight: 400,
      boxShadow: '0 0 20px rgba(0, 0, 0, 0.4)',
    }}
  >
    {children}
  </div>
);

const JobPost = () => {
  const locationInputRef = useRef(null);
  const firstErrorRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  // Prevent rapid double submissions/updates
  const submitLockRef = useRef(false);
  const updateLockRef = useRef(false);
  const [editingJobId, setEditingJobId] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [suggestions, setSuggestions] = useState({
    companies: [],
    positions: [],
    rounds: []
  });
  const WORK_MODE_OPTIONS = ["On-site", "Remote", "Hybrid"];
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('create');
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [draftJobs, setDraftJobs] = useState([]);

  const [jobForm, setJobForm] = useState({
    company: '',
    position: '',
    jobRoles: '',
    description: '',
    jobTypes: '',
    jobSource: 'On-Campus',
    modeOfVisit: 'Physical',
    jobCategory: '',
    jobTags: [],
    newTag: '',
    workMode: '',
    location: '',
    deadline: '',
    applyByTime: '',
    dateOfVisit: '',
    hiringStartDate: '',
    internshipStartDate: '',
    internshipDuration: '',
    internshipDurationUnit: 'Months',
    joiningDate: '',
    tenthPercentage: '',
    twelfthPercentage: '',
    diplomaPercentage: '',
    useScoreRange: false,
    minCGPA: 0,
    maxCGPA: 10,
    maxCurrentArrears: 0,
    maxHistoryArrears: 0,
    genderPreference: 'any',
    eligibleBatch: [],
    eligibleDepartments: [],
    ineligibleStudents: '',
    compensationType: 'Fixed Amount',
    ctc: '',
    ctcUnit: 'Yearly',
    minCtc: '',
    maxCtc: '',
    salary: '',
    salaryUnit: 'Monthly',
    minSalary: '',
    maxSalary: '',
    basePay: '',
    variablePay: '',
    bonuses: '',
    ppoPportunity: false,
    bondRequired: false,
    bondDetails: '',
    rounds: [{ name: '' }],
    roundsDescription: '',
    skills: [],
    newSkill: '',
    screeningQuestions: [{ question: '', type: 'text', options: [] }],
    jobPolicy: 'Global',
    whoCanApply: 'Eligible',
    jobStatus: 'Open for Applications',
    publishOption: 'Publish Now',
    scheduledPublishDate: '',
    scheduledCloseDate: '',
    companyPortalLink: '',
    externalRegistrationLink: '',
    attachments: [],
    newAttachmentName: '',
    newAttachmentLink: '',
    companyLogo: '',
    externalLinks: [],
    newExternalLinkLabel: '',
    newExternalLinkUrl: '',
    newExternalLinkMandatory: false
  });

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const jobId = queryParams.get('jobId');
    if (jobId) {
      setEditingJobId(jobId);
      setActiveTab('create');
      fetchJobData(jobId);
    }
  }, [location]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const companiesSnapshot = await getDocs(collection(db, 'companies'));
        const companies = new Set();
        companiesSnapshot.forEach(doc => {
          if (doc.data().companyName) {
            companies.add(doc.data().companyName);
          }
        });

        const jobsSnapshot = await getDocs(collection(db, 'jobs'));
        const positions = new Set();
        const rounds = new Set();
        jobsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.position) positions.add(data.position);
          if (Array.isArray(data.rounds)) {
            data.rounds.forEach(round => {
              if (round.name) rounds.add(round.name);
            });
          }
        });
        setSuggestions({
          companies: Array.from(companies),
          positions: Array.from(positions),
          rounds: Array.from(rounds)
        });
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions({
          companies: [],
          positions: [],
          rounds: []
        });
      }
    };
    fetchSuggestions();
  }, []);

  const fetchJobData = async (jobId) => {
    try {
      const jobRef = doc(db, "jobs", jobId);
      const jobSnap = await getDoc(jobRef);
      if (jobSnap.exists()) {
        const jobData = jobSnap.data() || {};
        console.log('Fetched job data:', jobData); // Debug log
        const processTimestamp = (timestamp) => {
          if (!timestamp) return '';
          try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toISOString().split('T')[0];
          } catch (error) {
            console.error("Error processing timestamp:", error);
            return '';
          }
        };
        const completeForm = {
          company: jobData.company || '',
          position: jobData.position || '',
          jobRoles: jobData.jobRoles || '',
          description: jobData.description || '',
          jobTypes: jobData.jobTypes || '',
          jobSource: jobData.jobSource || 'On-Campus',
          modeOfVisit: jobData.modeOfVisit || 'Physical',
          jobCategory: jobData.jobCategory || '',
          jobTags: Array.isArray(jobData.jobTags) ? jobData.jobTags : [],
          newTag: '',
          workMode: jobData.workMode || '',
          location: jobData.location || '',
          deadline: processTimestamp(jobData.deadline) || '',
          applyByTime: jobData.applyByTime || '',
          dateOfVisit: processTimestamp(jobData.dateOfVisit) || '',
          hiringStartDate: processTimestamp(jobData.hiringStartDate) || '',
          internshipStartDate: processTimestamp(jobData.internshipStartDate) || '',
          internshipDuration: jobData.internshipDuration || '',
          internshipDurationUnit: jobData.internshipDurationUnit || 'Months',
          joiningDate: processTimestamp(jobData.joiningDate) || '',
          tenthPercentage: jobData.tenthPercentage || '',
          twelfthPercentage: jobData.twelfthPercentage || '',
          diplomaPercentage: jobData.diplomaPercentage || '',
          useScoreRange: jobData.useScoreRange || false,
          minCGPA: jobData.minCGPA || 0,
          maxCGPA: jobData.maxCGPA || 10,
          maxCurrentArrears: jobData.maxCurrentArrears || 0,
          maxHistoryArrears: jobData.maxHistoryArrears || 0,
          genderPreference: jobData.genderPreference || 'any',
          eligibleBatch: Array.isArray(jobData.eligibleBatch) ? jobData.eligibleBatch : [],
          eligibleDepartments: Array.isArray(jobData.eligibleDepartments) ? jobData.eligibleDepartments : [],
          ineligibleStudents: Array.isArray(jobData.ineligibleStudents) ? jobData.ineligibleStudents.join(', ') : '',
          compensationType: jobData.compensationType || 'Fixed Amount',
          ctc: jobData.ctc || '',
          ctcUnit: jobData.ctcUnit || 'Yearly',
          minCtc: jobData.minCtc || '',
          maxCtc: jobData.maxCtc || '',
          salary: jobData.salary || '',
          salaryUnit: jobData.salaryUnit || 'Monthly',
          minSalary: jobData.minSalary || '',
          maxSalary: jobData.maxSalary || '',
          basePay: jobData.basePay || '',
          variablePay: jobData.variablePay || '',
          bonuses: jobData.bonuses || '',
          ppoPportunity: jobData.ppoPportunity || false,
          bondRequired: jobData.bondRequired || false,
          bondDetails: jobData.bondDetails || '',
          rounds: Array.isArray(jobData.rounds) ? jobData.rounds : [{ name: '' }],
          roundsDescription: jobData.roundsDescription || '',
          skills: Array.isArray(jobData.skills) ? jobData.skills : [],
          newSkill: '',
          screeningQuestions: Array.isArray(jobData.screeningQuestions) ? jobData.screeningQuestions : [{ question: '', type: 'text', options: [] }],
          jobPolicy: jobData.jobPolicy || 'Global',
          whoCanApply: jobData.whoCanApply || 'Eligible',
          jobStatus: jobData.jobStatus || 'Open for Applications',
          publishOption: jobData.publishOption || 'Publish Now',
          scheduledPublishDate: processTimestamp(jobData.scheduledPublishDate) || '',
          scheduledCloseDate: processTimestamp(jobData.scheduledCloseDate) || '',
          companyPortalLink: jobData.companyPortalLink || '',
          externalRegistrationLink: jobData.externalRegistrationLink || '',
          attachments: Array.isArray(jobData.attachments) ? jobData.attachments : [],
          newAttachmentName: '',
          newAttachmentLink: '',
          companyLogo: jobData.companyLogo || '',
          externalLinks: Array.isArray(jobData.externalLinks) ? jobData.externalLinks : [],
          externalLink: jobData.externalLink || '',
          requireExternalLink: jobData.requireExternalLink || false
        };
        setJobForm(completeForm);
        toast.info("Job loaded for editing");
      } else {
        toast.error("Job not found!");
        setEditingJobId(null);
      }
    } catch (error) {
      console.error("Error fetching job data:", error);
      toast.error("Error loading job data");
      setEditingJobId(null);
    }
  };

  // Auto-save functionality removed

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const scheduledSnapshot = await getDocs(
          query(collection(db, 'jobs'), where('publishOption', '==', 'Schedule'))
        );
        const draftSnapshot = await getDocs(
          query(collection(db, 'jobs'), where('publishOption', '==', 'Draft'))
        );
        const scheduledData = scheduledSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const draftData = draftSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setScheduledJobs(scheduledData);
        setDraftJobs(draftData);
      } catch (error) {
        console.error('Error fetching jobs:', error);
        toast.error('Failed to fetch jobs');
      }
    };
    fetchJobs();
  }, []);

  const checkAndPublishScheduledJobs = async () => {
    try {
      const now = new Date();
      const scheduledJobsToPublish = [];
      for (const job of scheduledJobs) {
        const publishDate = job.scheduledPublishDate ?
          (job.scheduledPublishDate.toDate ? job.scheduledPublishDate.toDate() : new Date(job.scheduledPublishDate)) :
          null;
        if (publishDate && publishDate <= now && job.status === 'Yet to Open') {
          scheduledJobsToPublish.push(job);
        }
      }
      if (scheduledJobsToPublish.length > 0) {
        // Batch update status for all scheduled jobs first
        const batch = writeBatch(db);
        scheduledJobsToPublish.forEach((job) => {
          const jobRef = doc(db, 'jobs', job.id);
          batch.update(jobRef, { status: 'Open for Applications', updatedAt: serverTimestamp() });
        });
        await batch.commit();

        // Then, for each job, create notifications
        for (const job of scheduledJobsToPublish) {
          await createNotificationsForJob(job.id, job);
          console.log(`Published scheduled job: ${job.position} at ${job.company}`);
        }
        const updatedScheduledJobs = scheduledJobs.filter(
          job => !scheduledJobsToPublish.some(publishedJob => publishedJob.id === job.id)
        );
        setScheduledJobs(updatedScheduledJobs);
        if (scheduledJobsToPublish.length === 1) {
          toast.success(`1 scheduled job has been published`);
        } else {
          toast.success(`${scheduledJobsToPublish.length} scheduled jobs have been published`);
        }
      }
    } catch (error) {
      console.error('Error checking scheduled jobs:', error);
    }
  };

  useEffect(() => {
    if (scheduledJobs.length > 0) {
      checkAndPublishScheduledJobs();
    }
  }, [scheduledJobs]);

  useEffect(() => {
    if (window.google && locationInputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(locationInputRef.current);
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        setJobForm(prev => ({
          ...prev,
          location: place.formatted_address
        }));
      });
    }
  }, []);

  useEffect(() => {
    if (isSubmitting && Object.keys(errors).length > 0 && firstErrorRef.current) {
      firstErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstErrorRef.current.classList.add('error-shake');
      setTimeout(() => {
        if (firstErrorRef.current) {
          firstErrorRef.current.classList.remove('error-shake');
        }
      }, 500);
    }
  }, [errors, isSubmitting]);

  const jobTypeOptions = [
    'Full-time', 'Regular Internship', 'Summer Internship', 'Intern + Full-time', 'Intern leads to Full-time'
  ];

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const validateField = (field, value) => {
    let error = '';
    const requiredFields = [
      'company', 'position', 'description', 'workMode', 'deadline', 'minCGPA'
    ];
    if (requiredFields.includes(field) && !value) {
      error = 'This field is required';
    }
    if (field === 'jobTypes' && (!value || value.length === 0)) {
      error = 'Please select at least one job type';
    }
    if (field === 'eligibleBatch' && (!value || value.length === 0)) {
      error = 'Please select at least one eligible batch';
    }
    if (field === 'minCGPA' && (value < 0 || value > 10)) {
      error = 'CGPA must be between 0 and 10';
    }
    if (field === 'deadline' && value) {
      const deadlineDate = new Date(value);
      if (deadlineDate < new Date()) {
        error = 'Deadline cannot be in the past';
      }
    }
    if ((field === 'deadline' || field === 'dateOfVisit' || field === 'internshipStartDate') && value) {
      const applyDate = new Date(jobForm.deadline);
      const visitDate = jobForm.dateOfVisit ? new Date(jobForm.dateOfVisit) : null;
      const startDate = jobForm.internshipStartDate ? new Date(jobForm.internshipStartDate) : null;
      if (field === 'dateOfVisit' && visitDate && applyDate && visitDate < applyDate) {
        error = 'Visit date must be after application deadline';
      }
      if (field === 'internshipStartDate' && startDate && visitDate && startDate < visitDate) {
        error = 'Start date must be after visit date';
      }
    }
    if (field === 'ctc' && value && isNaN(parseFloat(value))) {
      error = 'CTC must be a valid number';
    }
    if (field === 'salary' && value && isNaN(parseFloat(value))) {
      error = 'Stipend must be a valid number';
    }
    if (field === 'minCtc' && value && isNaN(parseFloat(value))) {
      error = 'Minimum CTC must be a valid number';
    }
    if (field === 'maxCtc' && value) {
      if (isNaN(parseFloat(value))) {
        error = 'Maximum CTC must be a valid number';
      } else if (jobForm.minCtc && parseFloat(value) < parseFloat(jobForm.minCtc)) {
        error = 'Maximum CTC must be greater than or equal to Minimum CTC';
      }
    }
    if (field === 'minSalary' && value && isNaN(parseFloat(value))) {
      error = 'Minimum Stipend must be a valid number';
    }
    if (field === 'maxSalary' && value) {
      if (isNaN(parseFloat(value))) {
        error = 'Maximum Stipend must be a valid number';
      } else if (jobForm.minSalary && parseFloat(value) < parseFloat(jobForm.minSalary)) {
        error = 'Maximum Stipend must be greater than or equal to Minimum Stipend';
      }
    }
    if (field === 'bondDetails' && jobForm.bondRequired && !value) {
      error = 'Bond details are required when bond is required';
    }
    if (field === 'externalLinks') {
      const mandatoryLinks = value.filter(link => link.mandatoryBeforeApply);
      if (mandatoryLinks.length > 0) {
        // Validate that mandatory links have proper labels and URLs
        const invalidLinks = mandatoryLinks.filter(link => !link.label || !link.url);
        if (invalidLinks.length > 0) {
          error = 'Mandatory external links must have both label and URL';
        }
      }
    }
    return error;
  };

  const validateForm = () => {
    const newErrors = {};
    let firstErrorField = null;
    Object.entries(jobForm).forEach(([field, value]) => {
      const error = validateField(field, value);
      if (error) {
        newErrors[field] = error;
        if (!firstErrorField) {
          firstErrorField = field;
        }
      }
    });
    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, firstErrorField, errorMap: newErrors };
  };


  const handleJobTypeChange = (e) => {
    const options = Array.from(e.target.options);
    const selected = options.filter(option => option.selected).map(option => option.value);
    setJobForm(prev => ({ ...prev, jobTypes: selected }));
    handleBlur('jobTypes');
  };

  const handleDepartmentChange = (e) => {
    const options = Array.from(e.target.options);
    const selected = options.filter(option => option.selected).map(option => option.value);
    setJobForm(prev => ({ ...prev, eligibleDepartments: selected }));
  };

  const handleCompensationTypeChange = (type) => {
    setJobForm(prev => ({
      ...prev,
      compensationType: type
    }));
    handleBlur('compensationType');
  };

  const addRound = () => {
    setJobForm(prev => ({
      ...prev,
      rounds: [...prev.rounds, { name: '' }]
    }));
  };

  const addPredefinedRound = (roundName) => {
    setJobForm(prev => ({
      ...prev,
      rounds: [...prev.rounds, { name: roundName }]
    }));
  };

  const addQuestion = () => {
    setJobForm(prev => ({
      ...prev,
      screeningQuestions: [...prev.screeningQuestions, { question: '', type: 'text', options: [] }]
    }));
  };

  const addSkill = () => {
    if (jobForm.newSkill.trim()) {
      setJobForm(prev => ({
        ...prev,
        skills: [...prev.skills, prev.newSkill.trim()],
        newSkill: ''
      }));
    }
  };

  const addTag = () => {
    if (jobForm.newTag.trim()) {
      setJobForm(prev => ({
        ...prev,
        jobTags: [...prev.jobTags, prev.newTag.trim()],
        newTag: ''
      }));
    }
  };

  const createNotificationsForJob = async (jobId, jobData) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Check if notifications already exist for this job to prevent duplicates
      const existingNotificationsQuery = query(
        collection(db, 'notifications'), 
        where('jobId', '==', jobId),
        where('type', '==', 'job')
      );
      const existingNotifications = await getDocs(existingNotificationsQuery);
      
      if (!existingNotifications.empty) {
        console.log(`Notifications already exist for job ${jobId}, skipping creation`);
        return [];
      }

      const studentsQuery = query(collection(db, 'students'));
      const studentsSnapshot = await getDocs(studentsQuery);

      // Firestore batch limit is 500 ops; keep a safe margin per batch
      const BATCH_SIZE = 450;
      let opsInBatch = 0;
      let batch = writeBatch(db);
      let createdCount = 0;

      const commitBatch = async () => {
        if (opsInBatch > 0) {
          await batch.commit();
          batch = writeBatch(db);
          opsInBatch = 0;
        }
      };

      for (const studentDoc of studentsSnapshot.docs) {
        const isEligible = true; // TODO: refine eligibility if needed
        if (!isEligible) continue;

        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          type: 'job',
          title: `New Job Opening: ${jobData.position} at ${jobData.company}`,
          message: `A new job opportunity is available for ${jobData.position} at ${jobData.company}.
                    Salary: ${jobData.salary || jobData.ctc || 'Not specified'}
                    Location: ${jobData.location || 'Not specified'}
                    Deadline: ${new Date(jobData.deadline).toLocaleDateString()}`,
          recipientType: 'student',
          isGeneral: true,
          timestamp: serverTimestamp(),
          read: false,
          actionUrl: `/student/jobs/${jobId}`,
          jobId,
          company: jobData.company,
          position: jobData.position,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          recipientId: studentDoc.id
        });
        opsInBatch += 1;
        createdCount += 1;

        if (opsInBatch >= BATCH_SIZE) {
          await commitBatch();
        }
      }

      await commitBatch();
      console.log(`Created ${createdCount} notifications for job ${jobId}`);
      return createdCount;
    } catch (error) {
      console.error('Error in createNotificationsForJob:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    
    const { isValid, firstErrorField, errorMap } = validateForm();
    if (!isValid) {
      // Mark all error fields as touched so they show red and display messages
      setTouched(prev => ({
        ...prev,
        ...Object.keys(errorMap).reduce((acc, key) => {
          acc[key] = true;
          return acc;
        }, {})
      }));
      toast.error('Please fix all validation errors before submitting');
      if (firstErrorField) {
        scrollToField(firstErrorField);
      }
      setIsSubmitting(false);
      submitLockRef.current = false;
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error('Please login to create a job posting');
        submitLockRef.current = false;
        return;
      }

      // Merge any pending new external link into the array and omit transient fields
      const { newExternalLinkLabel, newExternalLinkUrl, newExternalLinkMandatory, ...restJobForm } = jobForm;
      const externalLinksToSave = [
        ...(Array.isArray(restJobForm.externalLinks) ? restJobForm.externalLinks : []),
        ...(newExternalLinkLabel && newExternalLinkUrl
          ? [{ label: newExternalLinkLabel, url: newExternalLinkUrl, mandatoryBeforeApply: !!newExternalLinkMandatory }]
          : [])
      ];

      const jobData = {
        ...restJobForm,
        externalLinks: externalLinksToSave,
        created_by: user.uid,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        status: 'active',
        applicationsCount: 0,
        filledPositions: 0
      };

      // Create job with a deterministic ID and transaction to prevent duplicates
      const deterministicId = makeDeterministicJobId(jobForm.company, jobForm.position, jobForm.deadline);
      const jobRef = doc(db, 'jobs', deterministicId);
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(jobRef);
          if (snap.exists()) {
            throw new Error('already_exists');
          }
          tx.set(jobRef, jobData);
        });
      } catch (err) {
        if (String(err?.message || '').includes('already_exists')) {
          toast.error('This job has already been posted. Duplicate prevented.');
          setIsSubmitting(false);
          submitLockRef.current = false;
          return;
        }
        throw err;
      }

      // Create notifications for all students in chunked batches
      await createNotificationsForJob(jobRef.id, jobData);

      // Send push notifications to eligible students
      try {
        const notificationCount = await notifyJobPosted({ ...jobData, id: jobRef.id });
        console.log(`Push notifications sent to ${notificationCount} eligible students`);
      } catch (error) {
        console.error('Error sending push notifications:', error);
      }

      // Send admin notification about job creation
      try {
        await createJobEventNotification(
          'Job Posting Created',
          `New job posting "${jobForm.position}" at ${jobForm.company} has been created successfully.`,
          `/admin/jobs/${jobRef.id}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success('Job posting created successfully!');
      // Redirect admin back to Manage Applications after successful create
      // Small delay to let toast render/dismiss safely before unmounting via navigation
      setTimeout(() => navigate('/admin/manage-applications'), 600);
      resetForm();
      if (onJobCreated) {
        onJobCreated(jobRef.id);
      }
    } catch (error) {
      console.error('Error creating job posting:', error);
      toast.error('Failed to create job posting');
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const resetForm = () => {
    setJobForm({
      company: '',
      position: '',
      jobRoles: '',
      description: '',
      jobTypes: '',
      jobSource: 'On-Campus',
      modeOfVisit: 'Physical',
      jobCategory: '',
      jobTags: [],
      newTag: '',
      workMode: '',
      location: '',
      deadline: '',
      applyByTime: '',
      dateOfVisit: '',
      hiringStartDate: '',
      internshipStartDate: '',
      internshipDuration: '',
      internshipDurationUnit: 'Months',
      joiningDate: '',
      tenthPercentage: '',
      twelfthPercentage: '',
      diplomaPercentage: '',
      useScoreRange: false,
      minCGPA: 0,
      maxCGPA: 10,
      maxCurrentArrears: 0,
      maxHistoryArrears: 0,
      genderPreference: 'any',
      eligibleBatch: [],
      eligibleDepartments: [],
      ineligibleStudents: '',
      compensationType: 'Fixed Amount',
      ctc: '',
      ctcUnit: 'Yearly',
      minCtc: '',
      maxCtc: '',
      salary: '',
      salaryUnit: 'Monthly',
      minSalary: '',
      maxSalary: '',
      basePay: '',
      variablePay: '',
      bonuses: '',
      ppoPportunity: false,
      bondRequired: false,
      bondDetails: '',
      rounds: [{ name: 'Resume Screening' }],
      roundsDescription: '',
      skills: [],
      newSkill: '',
      screeningQuestions: [{ question: '', type: 'text', options: [] }],
      jobPolicy: 'Global',
      whoCanApply: 'Eligible',
      jobStatus: 'Open for Applications',
      publishOption: 'Publish Now',
      scheduledPublishDate: '',
      scheduledCloseDate: '',
      companyPortalLink: '',
      externalRegistrationLink: '',
      attachments: [],
      newAttachmentName: '',
      newAttachmentLink: '',
      companyLogo: '',
      externalLinks: [],
      newExternalLinkLabel: '',
      newExternalLinkUrl: '',
      newExternalLinkMandatory: false
    });
    setErrors({});
    setTouched({});
    setEditingJobId(null);
    setEditingJob(null);
  };

  const onJobCreated = (jobId) => {
    // Callback function for when a job is created
    console.log('Job created with ID:', jobId);
  };

  const onJobUpdated = (jobId) => {
    // Callback function for when a job is updated
    console.log('Job updated with ID:', jobId);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (updateLockRef.current) return;
    updateLockRef.current = true;
    setIsSubmitting(true);
    
    const { isValid, firstErrorField, errorMap } = validateForm();
    if (!isValid || (!editingJob && !editingJobId)) {
      if (!isValid) {
        // Mark all error fields as touched so they show red and display messages
        setTouched(prev => ({
          ...prev,
          ...Object.keys(errorMap).reduce((acc, key) => {
            acc[key] = true;
            return acc;
          }, {})
        }));
        toast.error('Please fix all validation errors before updating');
        if (firstErrorField) {
          scrollToField(firstErrorField);
        }
      }
      setIsSubmitting(false);
      updateLockRef.current = false;
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error('Please login to update a job posting');
        updateLockRef.current = false;
        return;
      }

      // Merge any pending new external link into the array and omit transient fields
      const { newExternalLinkLabel, newExternalLinkUrl, newExternalLinkMandatory, ...restJobForm } = jobForm;
      const externalLinksToSave = [
        ...(Array.isArray(restJobForm.externalLinks) ? restJobForm.externalLinks : []),
        ...(newExternalLinkLabel && newExternalLinkUrl
          ? [{ label: newExternalLinkLabel, url: newExternalLinkUrl, mandatoryBeforeApply: !!newExternalLinkMandatory }]
          : [])
      ];

      const updateData = {
        ...restJobForm,
        externalLinks: externalLinksToSave,
        updated_by: user.uid,
        updated_at: serverTimestamp()
      };

      // Update job in database
      const jobIdToUpdate = editingJob?.id || editingJobId;
      const jobRef = doc(db, 'jobs', jobIdToUpdate);
      await updateDoc(jobRef, updateData);

      // Send admin notification about job update
      try {
        await createJobEventNotification(
          'Job Posting Updated',
          `Job posting "${jobForm.position}" at ${jobForm.company} has been updated successfully.`,
          `/admin/jobs/${jobIdToUpdate}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success('Job posting updated successfully!');
      // Redirect admin back to Manage Applications after successful update
      // Small delay to allow toast lifecycle to complete before route change
      setTimeout(() => navigate('/admin/manage-applications'), 600);
      resetForm();
      setEditingJob(null);
      if (onJobUpdated) {
        onJobUpdated(jobIdToUpdate);
      }
    } catch (error) {
      console.error('Error updating job posting:', error);
      toast.error('Failed to update job posting');
    } finally {
      setIsSubmitting(false);
      updateLockRef.current = false;
    }
  };

  const renderField = (field, label, type = 'text', placeholder = '', options = null) => {
    const hasError = touched[field] && errors[field];
    const fieldClasses = `w-full p-3 border ${hasError ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`;
    return (
      <div className="mb-4" id={`field-${field}`}>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {type === 'select' ? (
          <select
            className={fieldClasses}
            value={jobForm[field]}
            onChange={e => setJobForm({...jobForm, [field]: e.target.value})}
            onBlur={() => handleBlur(field)}
          >
            <option value="">Select {label}</option>
            {Array.isArray(options) ? options.map((option, index) => (
              <option key={index} value={option}>{option}</option>
            )) : null}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            className={fieldClasses}
            value={jobForm[field]}
            onChange={e => setJobForm({...jobForm, [field]: e.target.value})}
            onBlur={() => handleBlur(field)}
            placeholder={placeholder}
            rows="4"
          />
        ) : type === 'richtext' ? (
          <ReactQuill
            value={jobForm[field]}
            onChange={value => setJobForm({...jobForm, [field]: value})}
            onBlur={() => handleBlur(field)}
            placeholder={placeholder}
          />
        ) : (
          <input
            type={type}
            className={fieldClasses}
            value={jobForm[field]}
            onChange={e => setJobForm({...jobForm, [field]: type === 'number' ? parseFloat(e.target.value) : e.target.value})}
            onBlur={() => handleBlur(field)}
            onWheel={type === 'number' ? (e) => e.target.blur() : undefined}
            placeholder={placeholder}
            min={type === 'number' ? "0" : undefined}
            step={type === 'number' ? "0.01" : undefined}
          />
        )}
        {hasError && <p className="text-red-600 text-sm mt-1">{errors[field]}</p>}
      </div>
    );
  };

  const editJob = async (jobId) => {
    try {
      setEditingJobId(jobId);
      const jobDoc = await getDoc(doc(db, 'jobs', jobId));
      if (jobDoc.exists()) {
        const data = jobDoc.data();
        setJobForm(data);
        setEditingJob({ id: jobId, ...data });
        setActiveTab('create');
        window.scrollTo(0, 0);
      }
    } catch (error) {
      console.error('Error fetching job:', error);
      toast.error('Failed to load job for editing');
    }
  };

  const publishJobNow = async (jobId) => {
    try {
      const jobRef = doc(db, 'jobs', jobId);
      await updateDoc(jobRef, {
        publishOption: 'Publish Now',
        status: 'Open for Applications',
        updatedAt: serverTimestamp()
      });
      const jobSnap = await getDoc(jobRef);
      if (jobSnap.exists()) {
        const jobData = jobSnap.data();
        await createNotificationsForJob(jobId, jobData);
      }
      setScheduledJobs(prev => prev.filter(job => job.id !== jobId));
      toast.success('Job published successfully!');
    } catch (error) {
      console.error('Error publishing job:', error);
      toast.error('Failed to publish job');
    }
  };

  const cancelEditing = () => {
    setEditingJobId(null);
    navigate('/admin/manage-applications');
  };

  const getErrorFields = () => {
    return Object.entries(errors)
      .filter(([_, error]) => !!error)
      .map(([field, error]) => ({
        field,
        error,
        label: field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
      }));
  };

  const scrollToField = (field) => {
    const element = document.getElementById(`field-${field}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('error-highlight');
      setTimeout(() => {
        element.classList.remove('error-highlight');
      }, 1000);
    }
  };

  const submitButtonText = editingJobId ? 'Update Job' : 'Post Job';

  const hasFullTime = ['Full-time', 'Intern + Full-time', 'Intern leads to Full-time'].includes(jobForm.jobTypes);

  const hasInternship = ['Regular Internship', 'Summer Internship', 'Intern + Full-time', 'Intern leads to Full-time'].includes(jobForm.jobTypes);
  

  return (
    <div className="max-w-6.5xl mx-auto p-8 bg-white rounded-lg shadow-lg">
      <button
          className="px-0 py-0 font-medium text-gray-500 hover:text-gray-700 mr-4"
          onClick={() => navigate('/admin/manage-applications')}
        >
          ← Back
        </button>
      <h2 className="text-3xl font-bold text-gray-800 mb-4 border-b pb-4">Job Postings</h2>
      <div className="flex border-b mb-8">
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'create' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('create')}
        >
          {editingJobId ? 'Edit Job' : 'Create New Job'}
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'scheduled' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => {
            if (!editingJobId) setActiveTab('scheduled');
          }}
          disabled={editingJobId}
        >
          Scheduled ({scheduledJobs.length})
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'drafts' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => {
            if (!editingJobId) setActiveTab('drafts');
          }}
          disabled={editingJobId}
        >
          Drafts ({draftJobs.length})
        </button>
        {editingJobId && (
          <button
            className="ml-auto py-2 px-4 text-red-500 hover:text-red-700"
            onClick={cancelEditing}
          >
            Cancel Editing
          </button>
        )}
      </div>
      {activeTab === 'create' && (
        <div className="space-y-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Post New Job Opportunity</h3>
          <style jsx>{`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
              20%, 40%, 60%, 80% { transform: translateX(5px); }
            }
            .error-shake {
              animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
            }
            .error-highlight {
              transition: all 0.3s ease;
              box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.5);
            }
          `}</style>
          {(isSubmitting || Object.keys(touched).length > 0) && Object.keys(errors).length > 0 && (
            <div className="border border-red-300 bg-red-50 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <span className="text-red-600 font-semibold mr-2">Validation errors found:</span>
                <span className="text-red-600">{getErrorFields().length} field(s) need attention</span>
              </div>
              <ul className="list-disc list-inside text-red-700 space-y-1">
                {getErrorFields().map(({ field, label, error }) => (
                  <li key={field}>
                    <button
                      type="button"
                      className="underline hover:no-underline hover:text-red-800"
                      onClick={() => scrollToField(field)}
                    >
                      {label}: {error}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <AnimatedCard>
            <h3 className="text-xl font-semibold text-gray-700 mb-4 pl-4 border-l-4 border-blue-500 flex items-center">
              1. Company Overview
            </h3>
            <div className="space-y-4">
              <div className="relative" id="field-company">
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  placeholder="Company Name"
                  className={`w-full p-3 border ${touched.company && errors.company ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                  value={jobForm.company}
                  onChange={e => setJobForm({...jobForm, company: e.target.value})}
                  onBlur={() => handleBlur('company')}
                  list="company-suggestions"
                />
                {touched.company && errors.company && <p className="text-red-600 text-sm mt-1">{errors.company}</p>}
                <datalist id="company-suggestions">
                  {Array.isArray(suggestions.companies) && suggestions.companies.map((company, index) => (
                    <option key={index} value={company} />
                  ))}
                </datalist>
              </div>
              <div className="relative" id="field-position">
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                <input
                  type="text"
                  placeholder="Job Title"
                  className={`w-full p-3 border ${touched.position && errors.position ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                  value={jobForm.position}
                  onChange={e => setJobForm({...jobForm, position: e.target.value})}
                  onBlur={() => handleBlur('position')}
                  list="position-suggestions"
                />
                {touched.position && errors.position && <p className="text-red-600 text-sm mt-1">{errors.position}</p>}
                <datalist id="position-suggestions">
                  {Array.isArray(suggestions.positions) && suggestions.positions.map((position, index) => (
                    <option key={index} value={position} />
                  ))}
                </datalist>
              </div>
              {renderField('jobRoles', 'Job Roles (comma-separated)', 'text', 'e.g., Frontend Developer, UI Designer')}
              {renderField('jobCategory', 'Job Category', 'select', '', JOB_CATEGORIES)}
              
            



              <div id="field-jobSource">
                <label className="block text-sm font-medium text-gray-700 mb-2">Job Source</label>
                <label htmlFor="ToggleJobSource" className="inline-flex items-center p-1 rounded-md cursor-pointer">
                  <input
                    id="ToggleJobSource"
                    type="checkbox"
                    className="hidden peer"
                    checked={jobForm.jobSource === 'On-Campus'}
                    onChange={() =>
                      setJobForm({
                        ...jobForm,
                        jobSource: jobForm.jobSource === 'On-Campus' ? 'Off-Campus' : 'On-Campus'
                      })
                    }
                  />
                  <span
                    className={`px-4 py-2 rounded-l-md ${
                      jobForm.jobSource === 'On-Campus'
                        ? 'bg-teal-200 text-gray-900'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    On-Campus
                  </span>
                  <span
                    className={`px-4 py-2 rounded-r-md ${
                      jobForm.jobSource === 'Off-Campus'
                        ? 'bg-teal-200 text-gray-900'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    Off-Campus
                  </span>
                </label>
              </div>
              <div id="field-modeOfVisit">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mode of Visit
                </label>
                <div className="flex gap-2 flex-wrap">
                  {['Physical', 'Virtual', 'Physical and Virtual', 'Not Yet Decided'].map((mode) => (
                    <label
                      key={mode}
                      className="relative inline-flex items-center cursor-pointer border border-teal-300 rounded-md overflow-hidden group"
                    >
                      <input
                        type="radio"
                        name="modeOfVisit"
                        className="hidden peer"
                        checked={jobForm.modeOfVisit === mode}
                        onChange={() => setJobForm({ ...jobForm, modeOfVisit: mode })}
                      />
                      <span className="w-full px-4 py-2 text-center text-teal-700 peer-checked:bg-teal-200 peer-checked:text-teal-900 transition-all relative z-10">
                        {mode}
                      </span>
                      <span className="absolute inset-0 bg-teal-400 opacity-20 scale-0 group-hover:scale-110 rounded-md transition-transform duration-500 ease-out"></span>
                    </label>
                  ))}
                </div>
              </div>

            
              <div id="field-description" className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Description</label>
                  <div className="custom-quill" style={{ height: '250px' }}>
                    <ReactQuill
                      value={jobForm.description}
                      onChange={value => setJobForm({ ...jobForm, description: value })}
                      onBlur={() => handleBlur('description')}
                      placeholder="Job Description (Rich text support)"
                      style={{
                        height: '100%', // takes full height of container
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    />
                  </div>
                  {touched.description && errors.description && (
                    <p className="text-red-600 text-sm mt-1">{errors.description}</p>
                  )}
                </div>



                                  <div id="field-jobTypes" className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Job Type
                    </label>

                    <select
                      className={`w-full p-3 border ${
                        touched.jobTypes && errors.jobTypes ? 'border-red-500' : 'border-gray-300'
                      } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                      value={jobForm.jobTypes}
                      onChange={e =>
                        setJobForm({
                          ...jobForm,
                          jobTypes: e.target.value, // only one value
                        })
                      }
                      onBlur={() => handleBlur('jobTypes')}
                    >
                      <option value="">Select Job Type</option>
                      {jobTypeOptions.map(type => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>

                    {touched.jobTypes && errors.jobTypes && (
                      <p className="text-red-600 text-sm mt-1">{errors.jobTypes}</p>
                    )}
                  </div>



              
              <div id="field-workMode">
                <label className="block text-sm font-medium text-gray-700 mb-2">Work Mode</label>
                <select
                  className={`w-full p-3 border ${touched.workMode && errors.workMode ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                  value={jobForm.workMode}
                  onChange={e => setJobForm({...jobForm, workMode: e.target.value})}
                  onBlur={() => handleBlur('workMode')}
                >
                  <option value="">Select Work Mode</option>
                  {WORK_MODE_OPTIONS.map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
                {touched.workMode && errors.workMode && <p className="text-red-600 text-sm mt-1">{errors.workMode}</p>}
              </div>


              
              {jobForm.workMode !== 'Remote' && (
                <div id="field-location">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location(s)</label>
                  <div className="relative">
                    <input
                      type="text"
                      className={`w-full p-3 pl-10 border ${touched.location && errors.location ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                      value={jobForm.location}
                      onChange={e => setJobForm({...jobForm, location: e.target.value})}
                      onBlur={() => handleBlur('location')}
                      placeholder="e.g., Bangalore, India"
                      list="location-suggestions"
                      ref={locationInputRef}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">📍</span>
                    <datalist id="location-suggestions" className="bg-white w-full border rounded-lg shadow-lg">
                      {LOCATION_SUGGESTIONS.map((location, index) => (
                        <option key={index} value={location} className="p-2 hover:bg-gray-100 cursor-pointer" />
                      ))}
                    </datalist>
                    {touched.location && errors.location && <p className="text-red-600 text-sm mt-1">{errors.location}</p>}
                  </div>
                </div>
              )}
            </div>
          </AnimatedCard>
          <AnimatedCard>
            <h3 className="text-xl font-semibold text-gray-700 mb-4 pl-4 border-l-4 border-blue-500 flex items-center">
              2. Important Dates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div id="field-deadline">
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Date to Apply</label>
                <input
                  type="date"
                  className={`w-full p-3 border ${touched.deadline && errors.deadline ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                  value={jobForm.deadline}
                  onChange={e => setJobForm({...jobForm, deadline: e.target.value})}
                  onBlur={() => handleBlur('deadline')}
                />
                {touched.deadline && errors.deadline && <p className="text-red-600 text-sm mt-1">{errors.deadline}</p>}
              </div>
              {renderField('applyByTime', 'Apply By Time', 'time')}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {jobForm.jobSource === 'On-Campus' && (
                renderField('dateOfVisit', 'Date of Visit', 'date')
              )}
              {hasFullTime && (
                renderField('hiringStartDate', 'Hiring Start Date', 'date')
              )}
              {hasInternship && (
                renderField('internshipStartDate', 'Internship Start Date', 'date')
              )}
              {renderField('joiningDate', 'Joining Date', 'date')}
              {hasInternship && (
                <div className="flex gap-2" id="field-internshipDuration">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Internship Duration</label>
                    <input
                      type="number"
                      min="1"
                      className={`w-full p-3 border ${touched.internshipDuration && errors.internshipDuration ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                      value={jobForm.internshipDuration}
                      onWheel={(e) => e.target.blur()}
                      onChange={e => setJobForm({...jobForm, internshipDuration: e.target.value})}
                      onBlur={() => handleBlur('internshipDuration')}
                      placeholder="Duration"
                    />
                  </div>
                  <div className="w-1/3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <select
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      value={jobForm.internshipDurationUnit}
                      onChange={e => setJobForm({...jobForm, internshipDurationUnit: e.target.value})}
                    >
                      {DURATION_UNITS.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </AnimatedCard>
          <AnimatedCard>
            <h3 className="text-xl font-semibold text-gray-700 mb-4 pl-4 border-l-4 border-blue-500 flex items-center">
              3. Academic & Eligibility Criteria
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {renderField('tenthPercentage', '10th Percentage/CGPA', 'text', 'e.g., 85% or 8.5 CGPA')}
              {renderField('twelfthPercentage', '12th Percentage/CGPA', 'text', 'e.g., 85% or 8.5 CGPA')}
              {renderField('diplomaPercentage', 'Diploma Percentage/CGPA (if applicable)', 'text', 'e.g., 85% or 8.5 CGPA')}
            </div>
            <div className="mb-4" id="field-useScoreRange">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={jobForm.useScoreRange}
                  onChange={e => setJobForm({ ...jobForm, useScoreRange: e.target.checked })}
                  className="w-5 h-5 rounded text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Enable CGPA Range</span>
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div id="field-minCGPA">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {jobForm.useScoreRange ? 'Minimum CGPA' : 'CGPA Requirement'}
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  onWheel={(e) => e.target.blur()}
                  className={`w-full p-3 border ${touched.minCGPA && errors.minCGPA ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                  value={jobForm.minCGPA}
                  onChange={e => setJobForm({...jobForm, minCGPA: parseFloat(e.target.value)})}
                  onBlur={() => handleBlur('minCGPA')}
                />
                {touched.minCGPA && errors.minCGPA && <p className="text-red-600 text-sm mt-1">{errors.minCGPA}</p>}
              </div>
              {jobForm.useScoreRange && (
                <div id="field-maxCGPA">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maximum CGPA</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    onWheel={(e) => e.target.blur()}
                    className={`w-full p-3 border ${touched.maxCGPA && errors.maxCGPA ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                    value={jobForm.maxCGPA}
                    onChange={e => setJobForm({...jobForm, maxCGPA: parseFloat(e.target.value)})}
                    onBlur={() => handleBlur('maxCGPA')}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div id="field-maxCurrentArrears">
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Current Arrears</label>
                <input
                  type="number"
                  min="0"
                  className={`w-full p-3 border ${touched.maxCurrentArrears && errors.maxCurrentArrears ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                  value={jobForm.maxCurrentArrears}
                  onWheel={(e) => e.target.blur()}
                  onChange={e => setJobForm({...jobForm, maxCurrentArrears: parseInt(e.target.value)})}
                  onBlur={() => handleBlur('maxCurrentArrears')}
                />
              </div>
              <div id="field-maxHistoryArrears">
                <label className="block text-sm font-medium text-gray-700 mb-1">Max History Arrears</label>
                <input
                  type="number"
                  min="0"
                  className={`w-full p-3 border ${touched.maxHistoryArrears && errors.maxHistoryArrears ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                  value={jobForm.maxHistoryArrears}
                  onWheel={(e) => e.target.blur()}
                  onChange={e => setJobForm({...jobForm, maxHistoryArrears: parseInt(e.target.value)})}
                  onBlur={() => handleBlur('maxHistoryArrears')}
                />
              </div>
            </div>
            <div className="mb-4" id="field-genderPreference">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender Preference
              </label>
              <div className="relative flex w-64 border border-teal-300 rounded-md overflow-hidden">
                <div
                  className={`absolute top-0 bottom-0 w-1/3 bg-teal-200 transition-all duration-300`}
                  style={{
                    left:
                      jobForm.genderPreference === 'any'
                        ? '0%'
                        : jobForm.genderPreference === 'male'
                        ? '33.33%'
                        : '66.66%',
                  }}
                ></div>
                {['Any', 'Male', 'Female'].map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    className={`flex-1 px-1 py-1 text-center z-10 transition-colors ${
                      jobForm.genderPreference === gender.toLowerCase()
                        ? 'text-teal-900 font-semibold'
                        : 'text-teal-700'
                    }`}
                    onClick={() =>
                      setJobForm({ ...jobForm, genderPreference: gender.toLowerCase() })
                    }
                    onBlur={() => handleBlur('genderPreference')}
                  >
                    {gender}
                  </button>
                ))}
              </div>
              {touched.genderPreference && errors.genderPreference && (
                <p className="text-red-500 text-sm mt-1">{errors.genderPreference}</p>
              )}
            </div>
            <div className="mb-4" id="field-eligibleBatch">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Eligible Batches ({new Date().getFullYear() - 3}–{new Date().getFullYear() + 6})
              </label>
              <div className="flex flex-wrap gap-3 max-h-48 overflow-y-auto p-2 border ${touched.eligibleBatch && errors.eligibleBatch ? 'border-red-500' : 'border-gray-0'} rounded-lg">
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 3 + i).map(year => (
                  <label key={year} className="inline-flex items-center px-4 py-2 border rounded-full cursor-pointer transition-colors duration-200 ease-in-out hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={jobForm.eligibleBatch.includes(year)}
                      onChange={() => {
                        const newBatch = jobForm.eligibleBatch.includes(year)
                          ? jobForm.eligibleBatch.filter(y => y !== year)
                          : [...jobForm.eligibleBatch, year];
                        setJobForm({...jobForm, eligibleBatch: newBatch});
                        handleBlur('eligibleBatch');
                      }}
                      className="mr-2 rounded"
                    />
                    <span>{year}</span>
                  </label>
                ))}
              </div>
              {touched.eligibleBatch && errors.eligibleBatch && <p className="text-red-600 text-sm mt-1">{errors.eligibleBatch}</p>}
            </div>



            <div id="field-eligibleDepartments" className="mb-4 relative">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Eligible Departments
  </label>

  {/* Selected Tags */}
  <div className="flex flex-wrap gap-2 mb-2 max-h-20 overflow-y-auto">
    {jobForm.eligibleDepartments.map(dept => (
      <span
        key={dept}
        className="flex items-center bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
      >
        {dept}
        <button
          type="button"
          className="ml-2 text-blue-500 hover:text-blue-700 font-bold"
          onClick={() =>
            setJobForm({
              ...jobForm,
              eligibleDepartments: jobForm.eligibleDepartments.filter(d => d !== dept)
            })
          }
        >
          ×
        </button>
      </span>
    ))}
  </div>

  {/* Scrollable Dropdown Menu */}
  <div className="border rounded-lg p-3 shadow-sm max-h-40 overflow-y-auto space-y-2">
    {DEPARTMENT_SUGGESTIONS.map(department => (
      <label key={department} className="flex items-center space-x-2 text-sm">
        <input
          type="checkbox"
          value={department}
          checked={jobForm.eligibleDepartments.includes(department)}
          onChange={e => {
            const isChecked = e.target.checked;
            if (isChecked) {
              setJobForm({
                ...jobForm,
                eligibleDepartments: [...jobForm.eligibleDepartments, department]
              });
            } else {
              setJobForm({
                ...jobForm,
                eligibleDepartments: jobForm.eligibleDepartments.filter(d => d !== department)
              });
            }
          }}
        />
        <span>{department}</span>
      </label>
    ))}

    {/* Optional: Open to All */}
    <label className="flex items-center space-x-2 text-sm">
      <input
        type="checkbox"
        value=""
        checked={jobForm.eligibleDepartments.length === 0}
        onChange={() =>
          setJobForm({
            ...jobForm,
            eligibleDepartments: []
          })
        }
      />
      <span>Open to All</span>
    </label>
  </div>

  {/* Validation Error */}
  {touched.eligibleDepartments && errors.eligibleDepartments && (
    <p className="text-red-600 text-sm mt-1">{errors.eligibleDepartments}</p>
  )}
</div>





            {renderField('ineligibleStudents', 'Ineligible Student Roll Numbers (comma-separated)', 'text', 'e.g., 12345, 67890')}
            {hasInternship && (
              <>
                <div className="mb-4" id="field-ppoPportunity">
                  <label className="block text-sm font-medium text-gray-700 mb-1">PPO Opportunity?</label>
                  <div className="flex gap-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="ppoPportunity"
                        checked={jobForm.ppoPportunity === true}
                        onChange={() => setJobForm({...jobForm, ppoPportunity: true})}
                        className="mr-2"
                      />
                      <span>Yes</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="ppoPportunity"
                        checked={jobForm.ppoPportunity === false}
                        onChange={() => setJobForm({...jobForm, ppoPportunity: false})}
                        className="mr-2"
                      />
                      <span>No</span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </AnimatedCard>
          <AnimatedCard>
            <h3 className="text-xl font-semibold text-gray-700 mb-4 pl-4 border-l-4 border-blue-500 flex items-center">
              4. Compensation Details
            </h3>
            <div className="mb-4" id="field-compensationType">
              <label className="block text-sm font-medium text-gray-700 mb-2">Compensation Type</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {COMPENSATION_TYPES.map(type => (
                  <label key={type} className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors duration-200 ${jobForm.compensationType === type ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-100'}`}>
                    <input
                      type="radio"
                      checked={jobForm.compensationType === type}
                      onChange={() => handleCompensationTypeChange(type)}
                      className="rounded-full text-blue-600"
                      name="compensationType"
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </div>
            {hasFullTime && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium mb-3">Full-Time CTC</h4>
                {jobForm.compensationType === 'Fixed Amount' && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div id="field-ctc">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enter Amount (e.g., 400000)</label>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        className={`w-full p-3 border ${errors.ctc && touched.ctc ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                        onWheel={(e) => e.target.blur()}
                        value={jobForm.ctc}
                        onChange={e => {
                          const value = e.target.value;
                          setJobForm({...jobForm, ctc: value});
                        }}
                        onBlur={() => handleBlur('ctc')}
                        placeholder="e.g., 400000"
                      />
                      {errors.ctc && touched.ctc && <p className="text-red-500 text-sm mt-1">{errors.ctc}</p>}
                    </div>
                    <div id="field-ctcUnit">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Per</label>
                      <select
                        className={`w-full p-3 border ${errors.ctcUnit && touched.ctcUnit ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                        value={jobForm.ctcUnit}
                        onChange={e => setJobForm({...jobForm, ctcUnit: e.target.value})}
                        onBlur={() => handleBlur('ctcUnit')}
                      >
                        {COMPENSATION_UNITS.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {jobForm.compensationType === 'Range' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div id="field-minCtc">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount (e.g., 300000)</label>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        className={`w-full p-3 border ${errors.minCtc && touched.minCtc ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                        onWheel={(e) => e.target.blur()}
                        value={jobForm.minCtc}
                        onChange={e => {
                          const value = e.target.value;
                          setJobForm({...jobForm, minCtc: value});
                        }}
                        onBlur={() => handleBlur('minCtc')}
                        placeholder="e.g., 300000"
                      />
                      {errors.minCtc && touched.minCtc && <p className="text-red-500 text-sm mt-1">{errors.minCtc}</p>}
                    </div>
                    <div id="field-maxCtc">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount (e.g., 500000)</label>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        className={`w-full p-3 border ${errors.maxCtc && touched.maxCtc ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                        onWheel={(e) => e.target.blur()}
                        value={jobForm.maxCtc}
                        onChange={e => {
                          const value = e.target.value;
                          setJobForm({...jobForm, maxCtc: value});
                        }}
                        onBlur={() => handleBlur('maxCtc')}
                        placeholder="e.g., 500000"
                      />
                      {errors.maxCtc && touched.maxCtc && <p className="text-red-500 text-sm mt-1">{errors.maxCtc}</p>}
                    </div>
                    <div id="field-ctcUnit">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Per</label>
                      <select
                        className={`w-full p-3 border ${errors.ctcUnit && touched.ctcUnit ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                        value={jobForm.ctcUnit}
                        onChange={e => setJobForm({...jobForm, ctcUnit: e.target.value})}
                        onBlur={() => handleBlur('ctcUnit')}
                      >
                        {COMPENSATION_UNITS.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                    {jobForm.minCtc && jobForm.maxCtc && !isNaN(parseFloat(jobForm.minCtc)) && !isNaN(parseFloat(jobForm.maxCtc)) && (
                      <div className="col-span-full text-sm text-gray-600">
                        Average: {((parseFloat(jobForm.minCtc) + parseFloat(jobForm.maxCtc)) / 2).toFixed(0)}
                      </div>
                    )}
                  </div>
                )}
                {(jobForm.compensationType === 'Performance Based' || jobForm.compensationType === 'Unpaid' || jobForm.compensationType === 'Not Specified') && (
                  <div className="text-gray-600 italic">
                    {jobForm.compensationType === 'Performance Based' ? 'Compensation will be based on performance.' :
                     jobForm.compensationType === 'Unpaid' ? 'This is an unpaid position.' :
                     'Compensation details not specified.'}
                  </div>
                )}
              </div>
            )}
            {hasInternship && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium mb-3">Internship Stipend</h4>
                {jobForm.compensationType === 'Fixed Amount' && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div id="field-salary">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enter Amount (e.g., 400000)</label>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        className={`w-full p-3 border ${errors.salary && touched.salary ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                        onWheel={(e) => e.target.blur()}
                        value={jobForm.salary}
                        onChange={e => {
                          const value = e.target.value;
                          setJobForm({...jobForm, salary: value});
                        }}
                        onBlur={() => handleBlur('salary')}
                        placeholder="e.g., 400000"
                      />
                      {errors.salary && touched.salary && <p className="text-red-500 text-sm mt-1">{errors.salary}</p>}
                    </div>
                    <div id="field-salaryUnit">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Per</label>
                      <select
                        className={`w-full p-3 border ${errors.salaryUnit && touched.salaryUnit ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                        value={jobForm.salaryUnit}
                        onChange={e => setJobForm({...jobForm, salaryUnit: e.target.value})}
                        onBlur={() => handleBlur('salaryUnit')}
                      >
                        {COMPENSATION_UNITS.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {jobForm.compensationType === 'Range' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div id="field-minSalary">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount (e.g., 300000)</label>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        className={`w-full p-3 border ${errors.minSalary && touched.minSalary ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                        onWheel={(e) => e.target.blur()}
                        value={jobForm.minSalary}
                        onChange={e => {
                          const value = e.target.value;
                          setJobForm({...jobForm, minSalary: value});
                        }}
                        onBlur={() => handleBlur('minSalary')}
                        placeholder="e.g., 300000"
                      />
                      {errors.minSalary && touched.minSalary && <p className="text-red-500 text-sm mt-1">{errors.minSalary}</p>}
                    </div>
                    <div id="field-maxSalary">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount (e.g., 500000)</label>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        className={`w-full p-3 border ${errors.maxSalary && touched.maxSalary ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                        onWheel={(e) => e.target.blur()}
                        value={jobForm.maxSalary}
                        onChange={e => {
                          const value = e.target.value;
                          setJobForm({...jobForm, maxSalary: value});
                        }}
                        onBlur={() => handleBlur('maxSalary')}
                        placeholder="e.g., 500000"
                      />
                      {errors.maxSalary && touched.maxSalary && <p className="text-red-500 text-sm mt-1">{errors.maxSalary}</p>}
                    </div>
                    <div id="field-salaryUnit">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Per</label>
                      <select
                        className={`w-full p-3 border ${errors.salaryUnit && touched.salaryUnit ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                        value={jobForm.salaryUnit}
                        onChange={e => setJobForm({...jobForm, salaryUnit: e.target.value})}
                        onBlur={() => handleBlur('salaryUnit')}
                      >
                        {COMPENSATION_UNITS.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                    {jobForm.minSalary && jobForm.maxSalary && !isNaN(parseFloat(jobForm.minSalary)) && !isNaN(parseFloat(jobForm.maxSalary)) && (
                      <div className="col-span-full text-sm text-gray-600">
                        Average: {((parseFloat(jobForm.minSalary) + parseFloat(jobForm.maxSalary)) / 2).toFixed(0)}
                      </div>
                    )}
                  </div>
                )}
                {(jobForm.compensationType === 'Performance Based' || jobForm.compensationType === 'Unpaid' || jobForm.compensationType === 'Not Specified') && (
                  <div className="text-gray-600 italic">
                    {jobForm.compensationType === 'Performance Based' ? 'Stipend will be based on performance.' :
                     jobForm.compensationType === 'Unpaid' ? 'This is an unpaid internship.' :
                     'Stipend details not specified.'}
                  </div>
                )}
              </div>
            )}
            {(jobForm.compensationType === 'Fixed Amount' || jobForm.compensationType === 'Range') && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium mb-3">Compensation Breakdown (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {renderField('basePay', 'Base Pay', 'text', 'e.g., 800000')}
                  {renderField('variablePay', 'Variable Pay', 'text', 'e.g., 200000')}
                  {renderField('bonuses', 'Bonuses', 'text', 'e.g., 100000')}
                </div>
              </div>
            )}
            <div className="mb-4" id="field-bondRequired">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={jobForm.bondRequired}
                  onChange={e => {
                    const isChecked = e.target.checked;
                    setJobForm({
                      ...jobForm,
                      bondRequired: isChecked,
                      bondDetails: isChecked ? jobForm.bondDetails : ''
                    });
                    // Clear bond details if bond is not required
                    if (!isChecked) {
                      setJobForm(prev => ({
                        ...prev,
                        bondDetails: ''
                      }));
                    }
                  }}
                  className="w-5 h-5 rounded text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Bond Required?</span>
                {jobForm.bondRequired && (
                  <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
                    ⚠️ Bond Required
                  </span>
                )}
              </label>
            </div>

            {jobForm.bondRequired && (
              <div id="field-bondDetails">
                <label className="block text-sm font-medium text-gray-700 mb-1">Bond Details</label>
                <ReactQuill
                  value={jobForm.bondDetails}
                  onChange={value => setJobForm({...jobForm, bondDetails: value})}
                  onBlur={() => handleBlur('bondDetails')}
                  placeholder="Enter bond details..."
                />
                {touched.bondDetails && errors.bondDetails && <p className="text-red-600 text-sm mt-1">{errors.bondDetails}</p>}
              </div>
            )}
          </AnimatedCard>
          <AnimatedCard>
            <h3 className="text-xl font-semibold text-gray-700 mb-4 pl-4 border-l-4 border-blue-500 flex items-center">
              5. Recruitment Process
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Quick Add Round</label>
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_ROUNDS.map(round => (
                  <button
                    key={round}
                    type="button"
                    onClick={() => addPredefinedRound(round)}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 transition"
                  >
                    + {round}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Hiring Workflow Rounds</label>
              {jobForm.rounds.map((round, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    value={round.name}
                    onChange={e => {
                      const newRounds = [...jobForm.rounds];
                      newRounds[index].name = e.target.value;
                      setJobForm({...jobForm, rounds: newRounds});
                    }}
                    placeholder="Round Name"
                    list="round-suggestions"
                  />
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newRounds = jobForm.rounds.filter((_, i) => i !== index);
                        setJobForm({...jobForm, rounds: newRounds});
                      }}
                      className="p-2 text-red-500 hover:text-red-700 transition"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <datalist id="round-suggestions">
                {suggestions.rounds.map((round, index) => (
                  <option key={index} value={round} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={addRound}
                className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
              >
                <span>+ Add Round</span>
              </button>
              {renderField('roundsDescription', 'Additional Process Details', 'textarea', 'Describe any additional details about the recruitment process...')}
            </div>
          </AnimatedCard>
          <AnimatedCard>
            <h3 className="text-xl font-semibold text-gray-700 mb-4 pl-4 border-l-4 border-blue-500 flex items-center">
              6. Skills & Questions
            </h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Required Skills</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {jobForm.skills.map((skill, index) => (
                  <div key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full flex items-center gap-1">
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newSkills = jobForm.skills.filter((_, i) => i !== index);
                        setJobForm({...jobForm, skills: newSkills});
                      }}
                      className="text-blue-500 hover:text-blue-700 transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  value={jobForm.newSkill}
                  onChange={e => setJobForm({...jobForm, newSkill: e.target.value})}
                  placeholder="Add a skill"
                  list="skill-suggestions"
                  onKeyPress={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Add
                </button>
              </div>
              <datalist id="skill-suggestions">
                {SKILL_SUGGESTIONS.map((skill, index) => (
                  <option key={index} value={skill} />
                ))}
              </datalist>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Screening Questions</label>
              <div className="space-y-4">
                {jobForm.screeningQuestions.map((q, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <h4 className="font-medium">Question {index + 1}</h4>
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newQuestions = jobForm.screeningQuestions.filter((_, i) => i !== index);
                            setJobForm({...jobForm, screeningQuestions: newQuestions});
                          }}
                          className="text-red-500 hover:text-red-700 transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition mb-2"
                      value={q.question}
                      onChange={e => {
                        const newQuestions = [...jobForm.screeningQuestions];
                        newQuestions[index].question = e.target.value;
                        setJobForm({...jobForm, screeningQuestions: newQuestions});
                      }}
                      placeholder="Enter your question"
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Answer Type</label>
                      <select
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        value={q.type}
                        onChange={e => {
                          const newQuestions = [...jobForm.screeningQuestions];
                          newQuestions[index].type = e.target.value;
                          setJobForm({...jobForm, screeningQuestions: newQuestions});
                        }}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="boolean">Yes/No</option>
                        <option value="multiple-choice">Multiple Choice</option>
                      </select>
                    </div>
                    {q.type === 'multiple-choice' && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                        {q.options.map((option, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2 mb-2">
                            <input
                              type="text"
                              className="flex-1 p-2 border border-gray-300 rounded-lg"
                              value={option}
                              onChange={e => {
                                const newQuestions = [...jobForm.screeningQuestions];
                                newQuestions[index].options[optIndex] = e.target.value;
                                setJobForm({...jobForm, screeningQuestions: newQuestions});
                              }}
                              placeholder={`Option ${optIndex + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newQuestions = [...jobForm.screeningQuestions];
                                newQuestions[index].options = newQuestions[index].options.filter((_, i) => i !== optIndex);
                                setJobForm({...jobForm, screeningQuestions: newQuestions});
                              }}
                              className="text-red-500 hover:text-red-700 transition"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newQuestions = [...jobForm.screeningQuestions];
                            newQuestions[index].options = [...(newQuestions[index].options || []), ''];
                            setJobForm({...jobForm, screeningQuestions: newQuestions});
                          }}
                          className="mt-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
                        >
                          + Add Option
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addQuestion}
                className="mt-3 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
              >
                <span>+ Add Question</span>
              </button>
            </div>
          </AnimatedCard>
          <AnimatedCard>
            <h3 className="text-xl font-semibold text-gray-700 mb-4 pl-4 border-l-4 border-blue-500 flex items-center">
              7. Job Visibility & Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div id="field-jobPolicy">
                <label className="block text-sm font-medium text-gray-700 mb-2">Job Policy</label>
                <div className="flex gap-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="jobPolicy"
                      checked={jobForm.jobPolicy === 'Global'}
                      onChange={() => setJobForm({...jobForm, jobPolicy: 'Global'})}
                      className="mr-2"
                    />
                    <span>Global (All Students)</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="jobPolicy"
                      checked={jobForm.jobPolicy === 'Restricted'}
                      onChange={() => setJobForm({...jobForm, jobPolicy: 'Restricted'})}
                      className="mr-2"
                    />
                    <span>Restricted</span>
                  </label>
                </div>
              </div>
              <div id="field-whoCanApply">
                <label className="block text-sm font-medium text-gray-700 mb-2">Who Can Apply</label>
                <div className="flex gap-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="whoCanApply"
                      checked={jobForm.whoCanApply === 'Eligible'}
                      onChange={() => setJobForm({...jobForm, whoCanApply: 'Eligible'})}
                      className="mr-2"
                    />
                    <span>Eligible Students Only</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="whoCanApply"
                      checked={jobForm.whoCanApply === 'All'}
                      onChange={() => setJobForm({
                        ...jobForm,
                        whoCanApply: 'All',
                        eligibleDepartments: [] // Empty array means all departments are eligible
                      })}
                      className="mr-2"
                    />
                    <span>All Students</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="mb-4" id="field-jobStatus">
              <label className="block text-sm font-medium text-gray-700 mb-2">Job Status</label>
              <select
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                value={jobForm.jobStatus}
                onChange={e => setJobForm({...jobForm, jobStatus: e.target.value})}
              >
                {JOB_STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="mb-4" id="field-publishOption">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Publish Options
              </label>
              <div className="inline-flex w-full max-w-md rounded-lg border border-teal-300 overflow-hidden">
                {['Publish Now', 'Schedule', 'Draft'].map((option, idx) => (
                  <label
                    key={option}
                    className={`flex-1 relative cursor-pointer text-center transition-all
                    ${idx !== 0 ? 'border-l border-teal-300' : ''}`} // Divider lines
                  >
                    <input
                      type="radio"
                      name="publishOption"
                      className="hidden peer"
                      checked={jobForm.publishOption === option}
                      onChange={() => setJobForm({ ...jobForm, publishOption: option })}
                    />
                    <span className="block w-full px-4 py-2 text-teal-700 peer-checked:bg-teal-200 peer-checked:text-teal-900 transition-all">
                      {option === 'Draft' ? 'Save as Draft' : option}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {jobForm.publishOption === 'Schedule' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {renderField('scheduledPublishDate', 'Publish Date', 'date')}
                {renderField('scheduledCloseDate', 'Close Date', 'date')}
              </div>
            )}
          </AnimatedCard>
          <AnimatedCard>
            <h3 className="text-xl font-semibold text-gray-700 mb-4 pl-4 border-l-4 border-blue-500 flex items-center">
              8. Links & Attachments
            </h3>
            {renderField('companyPortalLink', 'Company Portal Link', 'url', 'https://company.com/careers')}
            {renderField('externalRegistrationLink', 'External Registration Link (Optional)', 'url', 'https://company.com/apply')}
            {renderField('companyLogo', 'Company Logo URL', 'url', 'https://company.com/logo.png')}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Attachments</label>
              <div className="space-y-3 mb-3">
                {jobForm.attachments.map((attachment, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg">
                    <span className="text-blue-600">📎</span>
                    <div className="flex-1">
                      <div className="font-medium">{attachment.name}</div>
                      <a href={attachment.link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        {attachment.link}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newAttachments = jobForm.attachments.filter((_, i) => i !== index);
                        setJobForm({...jobForm, attachments: newAttachments});
                      }}
                      className="text-red-500 hover:text-red-700 transition"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  value={jobForm.newAttachmentName}
                  onChange={e => setJobForm({...jobForm, newAttachmentName: e.target.value})}
                  placeholder="Attachment Name"
                />
                <input
                  type="url"
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition md:col-span-2"
                  value={jobForm.newAttachmentLink}
                  onChange={e => setJobForm({...jobForm, newAttachmentLink: e.target.value})}
                  placeholder="Attachment URL"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (jobForm.newAttachmentName && jobForm.newAttachmentLink) {
                    setJobForm({
                      ...jobForm,
                      attachments: [...jobForm.attachments, {
                        name: jobForm.newAttachmentName,
                        link: jobForm.newAttachmentLink
                      }],
                      newAttachmentName: '',
                      newAttachmentLink: ''
                    });
                  }
                }}
                className="mt-3 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                disabled={!jobForm.newAttachmentName || !jobForm.newAttachmentLink}
              >
                Add Attachment
              </button>
            </div>
          </AnimatedCard>
          <AnimatedCard>
            <h3 className="text-xl font-semibold text-gray-700 mb-4 pl-4 border-l-4 border-blue-500 flex items-center">
              9. External Links & Resources
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                External Links
                {jobForm.externalLinks.filter(link => link.mandatoryBeforeApply).length > 0 && (
                  <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
                    ⚠️ {jobForm.externalLinks.filter(link => link.mandatoryBeforeApply).length} mandatory link(s)
                  </span>
                )}
              </label>
              <div className="space-y-3 mb-3">
                {jobForm.externalLinks.map((link, index) => (
                  <div key={index} className={`flex items-center gap-2 p-3 border rounded-lg ${
                    link.mandatoryBeforeApply ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                  }`}>
                    <div className="flex-1">
                      <div className="font-medium flex items-center">
                        {link.label}
                        {link.mandatoryBeforeApply && (
                          <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                            Mandatory before apply
                          </span>
                        )}
                      </div>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        {link.url}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newLinks = jobForm.externalLinks.filter((_, i) => i !== index);
                        setJobForm({...jobForm, externalLinks: newLinks});
                      }}
                      className="text-red-500 hover:text-red-700 transition p-1"
                      title="Remove link"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <input
                    type="text"
                    className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition w-full"
                    value={jobForm.newExternalLinkLabel}
                    onChange={e => setJobForm({...jobForm, newExternalLinkLabel: e.target.value})}
                    placeholder="Link Label (e.g., Company Portal)"
                    required
                  />
                </div>
                <div>
                  <input
                    type="url"
                    className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition w-full"
                    value={jobForm.newExternalLinkUrl}
                    onChange={e => setJobForm({...jobForm, newExternalLinkUrl: e.target.value})}
                    placeholder="https://example.com"
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jobForm.newExternalLinkMandatory}
                      onChange={e => setJobForm({...jobForm, newExternalLinkMandatory: e.target.checked})}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Mandatory before apply</span>
                  </label>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (jobForm.newExternalLinkLabel && jobForm.newExternalLinkUrl) {
                    setJobForm({
                      ...jobForm,
                      externalLinks: [...jobForm.externalLinks, {
                        label: jobForm.newExternalLinkLabel,
                        url: jobForm.newExternalLinkUrl,
                        mandatoryBeforeApply: jobForm.newExternalLinkMandatory
                      }],
                      newExternalLinkLabel: '',
                      newExternalLinkUrl: '',
                      newExternalLinkMandatory: false
                    });
                  }
                }}
                className="mt-3 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                disabled={!jobForm.newExternalLinkLabel || !jobForm.newExternalLinkUrl}
              >
                Add External Link
              </button>
            </div>
          </AnimatedCard>
          {isSubmitting && Object.keys(errors).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h3 className="text-red-800 font-medium mb-2">Please fix the following errors:</h3>
              <ul className="list-disc pl-5 space-y-1">
                {getErrorFields().map(({field, error, label}) => (
                  <li key={field}>
                    <button
                      onClick={() => scrollToField(field)}
                      className="text-red-700 hover:underline focus:outline-none"
                    >
                      {label}: {error}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={editingJobId ? handleUpdate : handleSubmit}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing...' : submitButtonText}
            </button>
            {jobForm.company && jobForm.position && (
              <button
                type="button"
                onClick={() => {
                  toast.info("Exporting job as PDF...");
                }}
                className="px-4 py-3 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 transition shadow-md"
              >
                Export as PDF
              </button>
            )}
            {editingJobId && (
              <button
                onClick={cancelEditing}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-red-600 text-white text-lg font-semibold rounded-lg hover:bg-red-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            )}
          </div>

        </div>
      )}
      {activeTab === 'scheduled' && (
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Scheduled Jobs</h3>
          {scheduledJobs.length === 0 ? (
            <p className="text-gray-500 italic">No scheduled jobs found.</p>
          ) : (
            <div className="space-y-4">
              {scheduledJobs.map(job => {
                const publishDate = job.scheduledPublishDate ?
                  (job.scheduledPublishDate.toDate ? job.scheduledPublishDate.toDate() : new Date(job.scheduledPublishDate)) :
                  null;
                const closeDate = job.scheduledCloseDate ?
                  (job.scheduledCloseDate.toDate ? job.scheduledCloseDate.toDate() : new Date(job.scheduledCloseDate)) :
                  null;
                const isPublishDatePassed = publishDate && publishDate <= new Date();
                return (
                  <div key={job.id} className="border rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-semibold">{job.position} at {job.company}</h4>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Publish Date:</span> {publishDate ? publishDate.toLocaleString() : 'Not specified'}
                            {isPublishDatePassed && <span className="ml-2 text-orange-500">(Pending publication)</span>}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Close Date:</span> {closeDate ? closeDate.toLocaleString() : 'Not specified'}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Status:</span> <span className={`${job.status === 'Yet to Open' ? 'text-orange-600' : 'text-green-600'}`}>{job.status}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => publishJobNow(job.id)}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition"
                        >
                          Publish Now
                        </button>
                        <button
                          onClick={() => editJob(job.id)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {activeTab === 'drafts' && (
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Draft Jobs</h3>
          {draftJobs.length === 0 ? (
            <p className="text-gray-500 italic">No draft jobs found.</p>
          ) : (
            <div className="space-y-4">
              {draftJobs.map(job => (
                <div key={job.id} className="border rounded-lg p-4 hover:shadow-md transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-semibold">{job.position} at {job.company}</h4>
                      <p className="text-sm text-gray-600">
                        Created: {job.createdAt ? new Date(job.createdAt.toDate()).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={() => editJob(job.id)}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobPost;