import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc, writeBatch, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from 'xlsx';
import ApplicationsTable from './ApplicationsTable';
import JobDetailsEdit from './JobDetailsEdit';
import StudentDetailsModal from './StudentDetailsModal';
import JobLogs from './JobLogs';
import PageLoader from '../../ui/PageLoader';
import { createStatusUpdateNotification, createInterviewNotification, createSystemAlertNotification } from '../../../utils/notificationHelpers';

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
    cgpa: '',
    searchTerm: '',
    roundStatus: 'all',
  });
  const roundStatusConfig = {
    pending: { label: '⏳ Pending', class: 'bg-gray-100 text-gray-800', icon: '⏳' },
    shortlisted: { label: '✅ Shortlisted', class: 'bg-green-100 text-green-800', icon: '✅' },
    rejected: { label: '⚠️ Rejected', class: 'bg-red-100 text-red-800', icon: '⚠️' }
  };
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const applicationsPerPage = 20;
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
    'name', 'rollNumber', 'department', 'cgpa', 'match', 'roundStatus', 'resume', 'predict',
    'question1', 'question2', 'feedback', 'rounds'
  ]);
  const allPossibleColumns = [
    'name', 'rollNumber', 'department', 'cgpa', 'email', 'phone', 'currentArrears', 'historyArrears',
    'skills', 'match', 'roundStatus', 'resume', 'predict', 'question1', 'question2', 'feedback',
    'tenthPercentage', 'twelfthPercentage', 'diplomaPercentage', 'gender', 'rounds' // Add more from student data
  ];
  // Column selector modal state
  const [showColumnModal, setShowColumnModal] = useState(false);
  // Add state for dynamic question filters
  const [questionFilters, setQuestionFilters] = useState({});
  // Define fetchJobAndApplications before using it in useEffect
  const fetchJobAndApplications = useCallback(async () => {
    setLoading(true);
    try {
      const jobRef = doc(db, "jobs", jobId);
      const jobSnap = await getDoc(jobRef);
   
      if (jobSnap.exists()) {
        // Add date validation helper function
        const validateDate = (dateValue) => {
          if (!dateValue) return null;
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
          salary: jobSnap.data().salary || jobSnap.data().salaryStipend || '',
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
          currentRoundIndex: jobSnap.data().currentRoundIndex || 0 // Add current round index
        };
        setJob(jobData);
        setEditedJob(jobData); // This will ensure all fields are available in the edit modal
        setCurrentRoundIndex(jobData.currentRoundIndex);
        // Fetch applications for this job
        const applicationsRef = collection(db, "applications");
        // Try both field names to ensure we find applications
        const q1 = query(applicationsRef, where("jobId", "==", jobId));
        const q2 = query(applicationsRef, where("job_id", "==", jobId));
     
        const querySnapshot1 = await getDocs(q1);
        const querySnapshot2 = await getDocs(q2);
     
        // Combine results from both queries
        const combinedDocs = [...querySnapshot1.docs, ...querySnapshot2.docs];
        // Remove duplicates if any (in case an application has both fields)
        const uniqueDocs = combinedDocs.filter((doc, index, self) =>
          index === self.findIndex((d) => d.id === doc.id)
        );
     
        // Fetch all applications and their corresponding student data
        const applicationsData = await Promise.all(
          uniqueDocs.map(async (appDoc) => {
            const appData = { id: appDoc.id, ...appDoc.data() };
            // Fetch student data from students collection
            const studentRef = doc(db, "students", appData.student_id);
            const studentSnap = await getDoc(studentRef);
         
            // In the fetchJobAndApplications function, update the student data handling
            // Around line 57-80
            if (studentSnap.exists()) {
              const studentData = studentSnap.data();
              appData.student = {
                id: studentSnap.id,
                ...studentData,
                // Ensure all required fields have default values
                name: studentData.name || 'N/A',
                rollNumber: studentData.rollNumber || 'N/A',
                department: studentData.department || 'N/A',
                cgpa: studentData.cgpa || '0',
                email: studentData.email || 'N/A',
                phone: studentData.phone || 'N/A',
                currentArrears: studentData.currentArrears || '0',
                historyArrears: studentData.historyArrears || '0',
                skills: Array.isArray(studentData.skills) ? studentData.skills : [], // Ensure skills is always an array
                tenthPercentage: studentData.tenthPercentage || 'N/A',
                twelfthPercentage: studentData.twelfthPercentage || 'N/A',
                diplomaPercentage: studentData.diplomaPercentage || 'N/A',
                gender: studentData.gender || 'N/A'
              };
            } else {
              console.warn(`Student data not found for ID: ${appData.student_id}`);
              appData.student = {
                id: appData.student_id,
                name: 'N/A',
                rollNumber: 'N/A',
                department: 'N/A',
                cgpa: '0',
                email: 'N/A',
                phone: 'N/A',
                currentArrears: '0',
                historyArrears: '0',
                skills: [], // Ensure skills is always an array
                tenthPercentage: 'N/A',
                twelfthPercentage: 'N/A',
                diplomaPercentage: 'N/A',
                gender: 'N/A'
              };
            }
            // Add round data to application (assuming stored in appData.reachedRound or default 0)
            appData.reachedRound = appData.reachedRound || 0;
            return appData;
          })
        );
     
        setApplications(applicationsData);
        setFilteredApplications(applicationsData);
        // Initialize round shortlists
        const shortlists = {};
        jobData.rounds.forEach((_, index) => {
          shortlists[index] = applicationsData
            .filter(app => app.reachedRound >= index)
            .map(app => app.id);
        });
        setRoundShortlists(shortlists);
      } else {
        toast.error("Job not found!");
        navigate('/admin/manage-applications');
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Error loading job data");
    } finally {
      setLoading(false);
    }
  }, [jobId, navigate]);
  // Fetch data on mount
  useEffect(() => {
    fetchJobAndApplications();
  }, [fetchJobAndApplications]);
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
        const student = app.student;
        const meetsGPA = !job.minCGPA || parseFloat(student.cgpa) >= parseFloat(job.minCGPA);
        const meetsCurrentArrears = !job.maxCurrentArrears || parseInt(student.currentArrears) <= parseInt(job.maxCurrentArrears);
        const meetsHistoryArrears = !job.maxHistoryArrears || parseInt(student.historyArrears) <= parseInt(job.maxHistoryArrears);
        return isEligible ? (meetsGPA && meetsCurrentArrears && meetsHistoryArrears) : !(meetsGPA && meetsCurrentArrears && meetsHistoryArrears);
      });
    }
    // Department filter
    if (filters.department !== 'all') {
      filtered = filtered.filter(app => app.student.department === filters.department);
    }
    // CGPA filter
    if (filters.cgpa) {
      filtered = filtered.filter(app => parseFloat(app.student.cgpa) >= parseFloat(filters.cgpa));
    }
    // Search filter (space-separated multi-term)
    if (filters.searchTerm) {
      const terms = filters.searchTerm.trim().split(/\s+/);
      filtered = filtered.filter(app => {
        const name = app.student.name.toLowerCase();
        const roll = app.student.rollNumber.toLowerCase();
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
    setFilteredApplications(filtered);
  }, [applications, filters, job, selectedRoundTransition, currentRound, visibleColumns, questionFilters]);
  // Pagination logic
  const indexOfLastApp = currentPage * applicationsPerPage;
  const indexOfFirstApp = indexOfLastApp - applicationsPerPage;
  const currentApplications = filteredApplications.slice(indexOfFirstApp, indexOfLastApp);
  const totalPages = Math.ceil(filteredApplications.length / applicationsPerPage);
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
        const status = app.student.rounds?.[currentRound] || 'pending';
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
      await updateDoc(applicationRef, {
        [`student.rounds.${currentRound}`]: newStatus,
        updatedAt: new Date(),
        lastModifiedBy: 'admin', // Track who made the change
        companyName: job?.company // Use the company name from the job details
      });
      // Update company stats after status change
      await updateCompanyStats(job?.company);
      // Update local state
      const updatedApplications = applications.map(app =>
        app.id === applicationId ? {
          ...app,
          student: {
            ...app.student,
            rounds: {
              ...app.student.rounds,
              [currentRound]: newStatus
            }
          },
          updatedAt: new Date(),
          lastModifiedBy: 'admin',
          companyName: job?.company
        } : app
      );
      setApplications(updatedApplications);
      setFilteredApplications(updatedApplications);
      setOpenDropdownId(null); // Close dropdown
      toast.success(`Round status updated to ${newStatus}`);

      // Send student notification and optionally email
      try {
        const recipientId = applicationToUpdate.student?.id || applicationToUpdate.studentId || applicationToUpdate.student_id;
        if (recipientId) {
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
  // Function to handle bulk actions with validation
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
      selectedApps.forEach(app => {
        const appRef = doc(db, "applications", app.id);
        batch.update(appRef, {
          [`student.rounds.${currentRound}`]: newStatus,
          updatedAt: timestamp,
          lastModifiedBy: 'admin',
          bulkUpdateId: timestamp.getTime(), // To track which updates were part of the same bulk action
          companyName: job?.company // Use the company name from the job details
        });
      });
      await batch.commit();
      // Update local state with full change tracking
      const updatedApplications = applications.map(app =>
        selectedApplications.includes(app.id) ? {
          ...app,
          student: {
            ...app.student,
            rounds: {
              ...app.student.rounds,
              [currentRound]: newStatus
            }
          },
          updatedAt: timestamp,
          lastModifiedBy: 'admin',
          bulkUpdateId: timestamp.getTime(),
          companyName: job?.company
        } : app
      );
      setApplications(updatedApplications);
      setFilteredApplications(updatedApplications);
      const statusChanges = selectedApps.map(app => `${app.student.name} → ${newStatus}`).join('\n');
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
    } catch (error) {
      toast.error("Failed to update rounds");
    }
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
    const excelData = selectedData.map(app => ({
      'Name': app.student.name,
      'Roll Number': app.student.rollNumber,
      'Department': app.student.department,
      'CGPA': app.student.cgpa,
      'Email': app.student.email,
      'Phone': app.student.phone,
      'Current Arrears': app.student.currentArrears,
      'History Arrears': app.student.historyArrears,
      'Skills': app.student.skills.join(', '),
      '10th Percentage': app.student.tenthPercentage,
      '12th Percentage': app.student.twelfthPercentage,
      'Diploma Percentage': app.student.diplomaPercentage,
      'Gender': app.student.gender,
      'Round Status': roundStatusConfig[app.student.rounds?.[currentRound]]?.label || 'Pending',
      // Add more fields like questions, feedback, resume link, etc.
      'Question 1': app.answers?.[0] || '', // Assuming answers array
      'Question 2': app.answers?.[1] || '',
      'Feedback': app.feedback || '',
      'Resume': app.resume || '',
      'Predict': app.predict || '' // Assuming some predict field
    }));
 
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
  const legacyCurrentRound = job?.rounds[currentRoundIndex]?.name || 'N/A';
  const legacyNextRound = job?.rounds[currentRoundIndex + 1]?.name || 'N/A';
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
       
          const updatedRounds = {
            ...currentRounds,
            [currentRound]: 'shortlisted',
          };
          if (nextRound) {
            updatedRounds[nextRound] = 'pending';
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
              job: { position: application.job?.position || 'Unknown Position' },
              status: 'shortlisted'
            });
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
   
      // Update current round to next round if exists
      if (nextRound) {
        await updateDoc(doc(db, "jobs", jobId), {
          currentRound: nextRound
        });
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
      fetchApplications();
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
      fetchApplications();
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
          `Interview scheduled for ${application.student?.name || 'Student'} on ${new Date(interviewDateTime).toLocaleString()}`,
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
      const transitions = generateRoundTransitions(job.rounds || job.hiringWorkflow);
      setAvailableRounds(transitions);
      if (transitions.length > 0 && !selectedRoundTransition) {
        setSelectedRoundTransition(transitions[0]);
        const currentRoundName = getCurrentRoundFromTransition(transitions[0]);
        setCurrentRound(currentRoundName);
      }
    }
  }, [job]);
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
         <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-lg border border-blue-100 overflow-hidden">
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
                     <span>Deadline: {job?.deadline && new Date(job.deadline).toLocaleDateString()}</span>
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
            
               {/* Salary Range */}
               <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex items-center gap-2 mb-1">
                   <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                     <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                       <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                     </svg>
                   </div>
                   <span className="text-xs font-medium text-gray-500">Salary Range</span>
                 </div>
                 <p className="text-sm text-gray-900 font-semibold">
                   {job?.minSalary && job?.maxSalary ? `${job.minSalary} - ${job.maxSalary} ${job.salaryUnit || ''}` : job?.salary || 'N/A'}
                 </p>
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
                   {job?.dateOfVisit ? new Date(job.dateOfVisit).toLocaleDateString() : 'N/A'}
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
                                          <p className="text-sl text-gray-900 font-semibold">
                   {job?.minSalary && job?.maxSalary ? `${job.minSalary} - ${job.maxSalary} ${job.salaryUnit || ''}` : job?.salary || 'N/A'}
                 </p>
                    
                       </div>
                       <div className="flex justify-between items-center py-2 border-b border-gray-100">
                         <span className="text-gray-600 font-medium">Application Deadline</span>
                         <span className="text-gray-900 font-semibold">
                           {job?.deadline
                             ? new Date(job.deadline).toLocaleString()
                             : job?.applicationDeadline
                               ? new Date(job.applicationDeadline).toLocaleString()
                               : 'N/A'}
                         </span>
                       </div>
                       <div className="flex justify-between items-center py-2 border-b border-gray-100">
                         <span className="text-gray-600 font-medium">Interview Date & Time</span>
                         <span className="text-gray-900 font-semibold">
                           {job?.interviewDateTime
                             ? new Date(job.interviewDateTime).toLocaleString()
                             : job?.interviewDate
                               ? new Date(job.interviewDate).toLocaleString()
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
       {/* Round Information Module */}
<div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
  {/* Header */}
  <div className="bg-gray-50 text-gray-900 p-6 border-b border-gray-200">
    <div className="mb-4">
      <h2 className="text-2xl font-semibold tracking-tight">Round Information</h2>
      <p className="text-sm text-gray-500 mt-1">Manage and transition students between rounds efficiently.</p>
    </div>
    {/* Round Selection and Current Round Display */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Round Transition
        </label>
        <select
          value={selectedRoundTransition}
          onChange={(e) => handleRoundTransitionChange(e.target.value)}
          className="w-full p-3 bg-white border-2 border-emerald-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
        >
          <option value="">Select a round transition</option>
          {availableRounds.map((transition, index) => (
            <option key={index} value={transition}>
              {transition}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Current Round
        </label>
        <div className="p-3 bg-gray-100 border border-gray-200 rounded-md">
          <span className="text-base font-semibold text-gray-900">{currentRound}</span>
          <p className="text-sm text-gray-600 mt-1">
            {filteredApplications.length} Students eligible
          </p>
        </div>
      </div>
    </div>
  </div>
  {/* Round Management Controls */}
  <div className="p-6 border-b border-gray-200">
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap gap-3">
            <button
              onClick={handleShortlistStudents}
              disabled={selectedApplications.length === 0 || roundLoading || !selectedRoundTransition}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {selectedRoundTransition
                ? `${getNextRoundFromTransition(selectedRoundTransition) ? 'Shortlist to ' + getNextRoundFromTransition(selectedRoundTransition) : 'Finalize Shortlist'} (${selectedApplications.length})`
                : `Select a Round to Shortlist`}
            </button>
            <button
              onClick={handleRejectStudents}
              disabled={selectedApplications.length === 0 || roundLoading || !selectedRoundTransition}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {selectedRoundTransition
                ? `Reject for ${currentRound} (${selectedApplications.length})`
                : `Select a Round to Reject`}
            </button>
      </div>
      {roundLoading && (
        <div className="flex items-center gap-2 text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
          <span className="text-sm">Processing...</span>
        </div>
      )}
    </div>
  </div>
  {/* Round Information Note */}
  <div className="p-6 bg-gray-50">
    <div className="flex items-start gap-3">
      <svg className="w-5 h-5 text-emerald-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
      <div>
        <p className="text-sm font-medium text-gray-900">
          Active Round: <span className="text-emerald-600">{currentRound}</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Students shown in the table below are eligible for this round. Use the bulk actions above to promote or reject.
        </p>
      </div>
    </div>
  </div>
</div>
        {/* Button to open Customize Table Columns modal */}
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setShowColumnModal(true)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200"
          >
            Customize Table Columns
          </button>
        </div>
        {/* Enhanced Filters Section */}
        <div className="p-0 -mb-8">
          {/* Filter controls and bulk action buttons */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <select
              value={filters.eligibility}
              onChange={(e) => setFilters({...filters, eligibility: e.target.value})}
              className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Candidates</option>
              <option value="eligible">Eligible</option>
              <option value="not_eligible">Not Eligible</option>
            </select>
            <select
              value={filters.department}
              onChange={(e) => setFilters({...filters, department: e.target.value})}
              className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Departments</option>
              <option value="CSE">CSE</option>
              <option value="IT">IT</option>
              <option value="ECE">ECE</option>
            </select>
            <input
              type="number"
              placeholder="Min CGPA"
              value={filters.cgpa}
              onChange={(e) => setFilters({...filters, cgpa: e.target.value})}
              className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="🔍 Search by name/roll number"
              value={filters.searchTerm}
              onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
              className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={filters.roundStatus}
              onChange={e => setFilters({ ...filters, roundStatus: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="rejected">Rejected</option>
              <option value="pending">Pending</option>
            </select>
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
        {/* Column Selector Modal */}
        {showColumnModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Customize Table Columns</h3>
                <button onClick={() => setShowColumnModal(false)} className="text-gray-500 hover:text-gray-700">
                  ×
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {allPossibleColumns.map(col => {
                  let label = col.charAt(0).toUpperCase() + col.slice(1).replace(/([A-Z])/g, ' $1');
                  if (col.startsWith('q') && job?.screeningQuestions) {
                    const idx = parseInt(col.replace('q', '')) - 1;
                    const q = job.screeningQuestions[idx];
                    if (q) label = q.question ? `Q${idx + 1}: ${q.question}` : `Q${idx + 1}`;
                  }
                  return (
                    <label key={col} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(col)}
                        onChange={() => {
                          setVisibleColumns(prev =>
                            prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
                          );
                        }}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default JobApplications;