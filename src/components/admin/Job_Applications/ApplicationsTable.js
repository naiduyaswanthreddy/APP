import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { doc, updateDoc, collection, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'react-toastify';
import { createStatusUpdateNotification, createSystemAlertNotification } from '../../../utils/notificationHelpers';
import { FileX } from 'lucide-react';
import LoadingSpinner from '../../ui/LoadingSpinner';
import NoData from '../../ui/NoData';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

// Add this new component for truncated feedback display
const TruncatedFeedback = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 150, height: 50 });
  const contentRef = useRef(null);

  const shouldTruncate = text && text.length > 12;
  const collapsedText = `${text.substring(0, 12)}...`;

  useEffect(() => {
    if (contentRef.current && isExpanded) {
      const { scrollHeight } = contentRef.current;
      setDimensions({
        width: 250, // Match `TruncatedAnswer` fixed expanded width
        height: scrollHeight + 2, // Height grows with content
      });
    } else {
      setDimensions({ width: 150, height: 50 });
    }
  }, [isExpanded, text]);

  if (!shouldTruncate) return <span>{text}</span>;

  return (
    <div className="relative">
      <div
        className="transition-all duration-300 ease-in-out rounded p-2 bg-gray-50 border overflow-hidden"
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
        }}
      >
        <div ref={contentRef}>
          <span>{isExpanded ? text : collapsedText}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="ml-1 text-blue-500 text-xs hover:underline block mt-1"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Add this new component for truncated answer display
const TruncatedAnswer = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 150, height: 50 });
  const contentRef = useRef(null);

  // Convert text to string and check if it exists
  const textStr = String(text || '');
  const shouldTruncate = textStr.length > 10;
  const collapsedText = shouldTruncate ? `${textStr.substring(0, 10)}...` : textStr;

  useEffect(() => {
    if (contentRef.current && isExpanded) {
      const { scrollWidth, scrollHeight } = contentRef.current;
      setDimensions({
        width: scrollWidth + 20, // +padding or safe space
        height: scrollHeight + 20, // +padding or safe space
      });
    } else if (!isExpanded) {
      setDimensions({ width: 150, height: 50 });
    }
  }, [isExpanded, text]);

  if (!shouldTruncate) return <span>{text}</span>;

  return (
    <div className="relative">
      <div
        className="transition-all duration-300 ease-in-out rounded p-2 bg-gray-50 border overflow-hidden"
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
        }}
      >
        <div ref={contentRef}>
          <span>{isExpanded ? text : collapsedText}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="ml-1 text-blue-500 text-xs hover:underline block mt-1"
          >
            {isExpanded ? 'Read less' : 'Read more'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ApplicationsTable = ({
  loading,
  filteredApplications,
  applications,
  setApplications,
  visibleColumns,
  openDropdownId,
  setOpenDropdownId,
  dropdownPosition,
  setDropdownPosition,
  handleStatusUpdate,
  handleSaveFeedback,
  handleViewAnswers,
  handleViewProfile,
  handleViewResume,
  statusConfig,
  currentRound,
  screeningQuestions = []
}) => {
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectedApplications, setSelectedApplications] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [showUndoSnackbar, setShowUndoSnackbar] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [editingFeedbackId, setEditingFeedbackId] = useState(null);
  const [editingFeedbackValue, setEditingFeedbackValue] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const listRef = useRef();

  // Calculate skill match percentage
  const calculateSkillMatch = (studentSkills = [], jobSkills = []) => {
    if (!jobSkills.length) return 0;
    const studentSkillSet = new Set(studentSkills.map(skill => skill.toLowerCase()));
    const jobSkillSet = new Set(jobSkills.map(skill => skill.toLowerCase()));
    const matches = [...jobSkillSet].filter(skill => studentSkillSet.has(skill));
    return Math.round((matches.length / jobSkillSet.size) * 100);
  };

  // Handle student click
  const handleStudentClick = (student) => {
    if (handleViewProfile) {
      handleViewProfile(student);
    }
  };

  // Memoize filtered applications to prevent unnecessary re-renders
  const memoizedApplications = useMemo(() => {
    return filteredApplications.map((app, index) => ({
      ...app,
      virtualIndex: index
    }));
  }, [filteredApplications]);

  // Memoize row renderer to prevent recreation on every render
  const RowRenderer = useCallback(({ index, style }) => {
    const application = memoizedApplications[index];
    if (!application) return null;

    return (
      <div style={style} className="flex items-center border-b border-gray-200 hover:bg-gray-50">
        {/* Checkbox cell */}
        <div className="w-12 p-3">
          <input
            type="checkbox"
            checked={selectedRows.has(application.id)}
            onChange={(e) => handleRowSelection(application.id, e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>

        {/* Dynamic cells based on visible columns */}
        {visibleColumns.map((column) => {
          switch (column) {
            case 'name':
              return (
                <div key={column} className="flex-1 p-3">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <img
                        className="h-10 w-10 rounded-full"
                        src={application.student?.profilePicture || '/default-avatar.png'}
                        alt="Profile"
                        onError={(e) => {
                          e.target.src = '/default-avatar.png';
                        }}
                      />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {application.student?.name || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {application.student?.rollNumber || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              );

            case 'department':
              return (
                <div key={column} className="w-32 p-3">
                  <span className="text-sm text-gray-900">
                    {application.student?.department || 'N/A'}
                  </span>
                </div>
              );

            case 'batch':
              return (
                <div key={column} className="w-24 p-3">
                  <span className="text-sm text-gray-900">
                    {application.student?.batch || 'N/A'}
                  </span>
                </div>
              );

            case 'cgpa':
              return (
                <div key={column} className="w-20 p-3">
                  <span className="text-sm text-gray-900">
                    {application.student?.cgpa || 'N/A'}
                  </span>
                </div>
              );

            case 'status':
              return (
                <div key={column} className="w-32 p-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusConfig[application.status]?.class || statusConfig.pending.class}`}>
                    {statusConfig[application.status]?.label || 'Pending'}
                  </span>
                </div>
              );

            case 'actions':
              return (
                <div key={column} className="w-48 p-3">
                  <div className="relative">
                    <button
                      onClick={(e) => handleActionsClick(e, application.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>

                    {openDropdownId === application.id && (
                      <div
                        className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 focus:outline-none z-50"
                        style={{
                          position: 'fixed',
                          top: `${dropdownPosition.top}px`,
                          left: `${dropdownPosition.left}px`
                        }}
                      >
                        <div className="py-1">
                          {Object.entries(statusConfig).map(([status, config]) => (
                            <button
                              key={status}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusUpdateWithUndo(application.id, status);
                                setOpenDropdownId(null);
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <span className="mr-2">
                                {status === 'underReview' && '⏳'}
                                {status === 'shortlisted' && '✅'}
                                {status === 'onHold' && '🟡'}
                                {status === 'interview' && '📅'}
                                {status === 'selected' && '🎉'}
                                {status === 'rejected' && '❌'}
                              </span> {config.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );

            default:
              return (
                <div key={column} className="flex-1 p-3">
                  <span className="text-sm text-gray-900">
                    {application[column] || 'N/A'}
                  </span>
                </div>
              );
          }
        })}
      </div>
    );
  }, [memoizedApplications, selectedRows, openDropdownId, dropdownPosition, visibleColumns, statusConfig]);

  // Enhanced status update with undo functionality
  const handleStatusUpdateWithUndo = async (applicationId, newStatus) => {
    try {
      const application = applications.find(app => app.id === applicationId);
      if (!application) {
        toast.error('Application not found');
        return;
      }

      const oldStatus = application.status;
      
      // Store the action for potential undo
      const undoAction = {
        applicationId,
        oldStatus,
        newStatus,
        timestamp: Date.now()
      };

      setUndoStack(prev => [...prev, undoAction]);
      setLastAction(undoAction);
      setShowUndoSnackbar(true);

      // Auto-hide undo snackbar after 5 seconds
      setTimeout(() => {
        setShowUndoSnackbar(false);
        setUndoStack(prev => prev.filter(action => action.timestamp !== undoAction.timestamp));
      }, 5000);

      // Perform the status update
      await handleStatusUpdate(applicationId, newStatus);

    } catch (error) {
      console.error('Error updating application status:', error);
      toast.error('Failed to update status');
    }
  };

  // Undo last action
  const handleUndo = async () => {
    if (undoStack.length === 0 || !lastAction) return;

    try {
      const application = applications.find(app => app.id === lastAction.applicationId);
      if (!application) return;

      // Revert the status
      await handleStatusUpdate(lastAction.applicationId, lastAction.oldStatus);

      // Remove from undo stack
      setUndoStack(prev => prev.filter(action => action.timestamp !== lastAction.timestamp));
      setLastAction(null);
      setShowUndoSnackbar(false);

      toast.success('Action undone successfully');
    } catch (error) {
      console.error('Error undoing action:', error);
      toast.error('Failed to undo action');
    }
  };

  // Handle row selection
  const handleRowSelection = (applicationId, isSelected) => {
    const newSelectedRows = new Set(selectedRows);
    if (isSelected) {
      newSelectedRows.add(applicationId);
    } else {
      newSelectedRows.delete(applicationId);
    }
    setSelectedRows(newSelectedRows);
  };

  // Handle select all
  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      setSelectedRows(new Set(memoizedApplications.map(app => app.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  // Handle actions click (for bulk actions)
  const handleActionsClick = (e, applicationId) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX
    });
    setOpenDropdownId(openDropdownId === applicationId ? null : applicationId);
  };

  // Handle bulk status updates
  const handleBulkStatusUpdate = async (status) => {
    const confirmed = window.confirm(`Are you sure you want to update all selected applications to "${statusConfig[status]?.label || status}"?`);
    if (!confirmed) return;

    try {
      for (const applicationId of selectedRows) {
        await handleStatusUpdateWithUndo(applicationId, status);
      }
      setSelectedRows(new Set()); // Clear selected rows after bulk update
      toast.success(`All selected applications updated to ${statusConfig[status]?.label || status}`);
    } catch (error) {
      console.error('Error updating bulk status:', error);
      toast.error('Failed to update bulk status');
    }
  };

  // Get screening questions from the first application's job data
  // Assuming all applications in filteredApplications are for the same job
  // Replace the current screeningQuestions code with this improved version
  // that handles the case when job data might not be available
  // Add this useEffect to fetch and set screening questions
  useEffect(() => {
    const fetchScreeningQuestions = async () => {
      if (filteredApplications.length > 0) {
        const firstApp = filteredApplications[0];
        
        // If the job data is already available, use it
        if (firstApp.job?.screeningQuestions) {
          // setScreeningQuestions(firstApp.job.screeningQuestions); // This line is removed
          return;
        }
        
        // If not, try to fetch the job data
        if (firstApp.job_id) {
          try {
            const jobRef = doc(db, 'jobs', firstApp.job_id);
            const jobSnap = await getDoc(jobRef);
            
            if (jobSnap.exists()) {
              const jobData = jobSnap.data();
              if (jobData.screeningQuestions && jobData.screeningQuestions.length > 0) {
                console.log("Fetched screening questions:", jobData.screeningQuestions);
                // setScreeningQuestions(jobData.screeningQuestions); // This line is removed
              }
            }
          } catch (error) {
            console.error("Error fetching job data:", error);
          }
        }
      }
    };
    
    fetchScreeningQuestions();
  }, [filteredApplications]);
  // Add console logs to debug screening questions
  useEffect(() => {
    console.log("Screening Questions:", screeningQuestions);
    console.log("First application:", filteredApplications[0]);
    console.log("First application job:", filteredApplications[0]?.job);
    if (filteredApplications.length > 0) {
      console.log("First application screening_answers:", filteredApplications[0].screening_answers);
    }
  }, [screeningQuestions, filteredApplications]);

  // Handler to start editing feedback
  const handleEditFeedback = (application) => {
    console.log("Starting to edit feedback for:", application.id);
    setEditingFeedbackId(application.id);
    setEditingFeedbackValue(application.feedback || ''); // Initialize with current feedback or empty string
  };

  // Handler to save feedback on blur (keeping for now, but consider removing if not needed)
  const handleBlurSaveFeedback = async (applicationId) => {
    if (editingFeedbackId === applicationId) {
      console.log("Saving feedback on blur:", applicationId, editingFeedbackValue);
      // We'll rely on the button click or Enter key for saving
      // If you need blur save, uncomment and adjust the logic below
      /*
      try {
        if (typeof handleSaveFeedback === 'function') {
          const success = await handleSaveFeedback(applicationId, editingFeedbackValue);
          if (success) {
            console.log("Feedback saved successfully to database on blur");
          } else {
            console.error("Failed to save feedback to database on blur");
          }
        } else {
          console.error("handleSaveFeedback is not a function on blur", handleSaveFeedback);
        }
        setEditingFeedbackId(null);
      } catch (error) {
        console.error("Error saving feedback on blur:", error);
        setEditingFeedbackId(null);
      }
      */
       setEditingFeedbackId(null); // Always reset editing state on blur
    }
  };

  // Handler to save feedback on button click
  // Handler to save feedback on button click
  const handleSaveButtonClick = async (applicationId) => {
    console.log("Save button clicked - ID:", applicationId, "Value:", editingFeedbackValue);
    console.log("Application object:", filteredApplications.find(app => app.id === applicationId));
    
    if (!editingFeedbackValue.trim()) {
      alert("Please enter feedback before saving.");
      return;
    }

    try {
      setSavingFeedback(true); // Set loading state
      
      // Implement direct saving functionality here
      // instead of relying on the passed handleSaveFeedback prop
      const applicationRef = doc(db, 'applications', applicationId);
      
      // Verify the document exists before updating
      const docSnap = await getDoc(applicationRef);
      
      if (!docSnap.exists()) {
        throw new Error(`Application document ${applicationId} does not exist`);
      }
      
      // Perform the update
      await updateDoc(applicationRef, {
        feedback: editingFeedbackValue
      });
      
      // Update the application in the local state
      const updatedApplications = filteredApplications.map(app => 
        app.id === applicationId ? { ...app, feedback: editingFeedbackValue } : app
      );
      
      // If there's a way to update the parent component's state, do it here
      // For now, we'll just update the local UI
      
      setEditingFeedbackId(null);
      setSavingFeedback(false); // Reset loading state
      alert("Feedback saved successfully!"); // Add confirmation for user
      
    } catch (error) {
      console.error("Error in handleSaveButtonClick:", error);
      setSavingFeedback(false); // Reset loading state
      alert(`Failed to save feedback: ${error.message}`);
    }
  };

  // Handler to save feedback on Enter key press
  const handleKeyPressSaveFeedback = async (e, applicationId) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent new line in input/textarea
      console.log("Enter key pressed, calling handleSaveButtonClick");
      await handleSaveButtonClick(applicationId); // Call the main save function
    }
  };

  // Function to render table headers dynamically
  const renderTableHeaders = () => {
    const headers = [];
    
    // Always include checkbox column
    headers.push(
      <th key="checkbox" scope="col" className="w-8 px-4 py-3 bg-teal-100">
        <input
          type="checkbox"
          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          onChange={(e) => {
            const allIds = filteredApplications.map(app => app.id);
            setSelectedApplications(e.target.checked ? allIds : []);
          }}
          checked={selectedApplications.length === filteredApplications.length}
        />
      </th>
    );

    // Add dynamic headers based on visibleColumns
    visibleColumns.forEach(column => {
      if (column.startsWith('q')) {
        const idx = parseInt(column.replace('q', '')) - 1;
        const q = screeningQuestions[idx];
        headers.push(
          <th key={column} scope="col" className="w-48 px-4 py-3 text-left text-xs font-medium bg-teal-100 uppercase tracking-wider">
            {q ? q.question || `Q${idx + 1}` : `Q${idx + 1}`}
          </th>
        );
        return;
      }
      switch (column) {
        case 'name':
          headers.push(
            <th key="name" scope="col" className="w-40 px-4 py-3 text-left text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Name
            </th>
          );
          break;
        case 'rollNumber':
          headers.push(
            <th key="rollNumber" scope="col" className="w-32 px-4 py-3 text-left text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Roll No
            </th>
          );
          break;
        case 'department':
          headers.push(
            <th key="department" scope="col" className="w-20 px-4 py-3 text-center text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Dept
            </th>
          );
          break;
        case 'cgpa':
          headers.push(
            <th key="cgpa" scope="col" className="w-16 px-4 py-3 text-center text-xs font-medium bg-teal-100 uppercase tracking-wider">
              CGPA
            </th>
          );
          break;
        case 'email':
          headers.push(
            <th key="email" scope="col" className="w-48 px-4 py-3 text-left text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Email
            </th>
          );
          break;
        case 'phone':
          headers.push(
            <th key="phone" scope="col" className="w-32 px-4 py-3 text-left text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Phone
            </th>
          );
          break;
        case 'currentArrears':
          headers.push(
            <th key="currentArrears" scope="col" className="w-24 px-4 py-3 text-center text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Current Arrears
            </th>
          );
          break;
        case 'historyArrears':
          headers.push(
            <th key="historyArrears" scope="col" className="w-24 px-4 py-3 text-center text-xs font-medium bg-teal-100 uppercase tracking-wider">
              History Arrears
            </th>
          );
          break;
        case 'skills':
          headers.push(
            <th key="skills" scope="col" className="w-48 px-4 py-3 text-left text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Skills
            </th>
          );
          break;
        case 'tenthPercentage':
          headers.push(
            <th key="tenthPercentage" scope="col" className="w-24 px-4 py-3 text-center text-xs font-medium bg-teal-100 uppercase tracking-wider">
              10th %
            </th>
          );
          break;
        case 'twelfthPercentage':
          headers.push(
            <th key="twelfthPercentage" scope="col" className="w-24 px-4 py-3 text-center text-xs font-medium bg-teal-100 uppercase tracking-wider">
              12th %
            </th>
          );
          break;
        case 'diplomaPercentage':
          headers.push(
            <th key="diplomaPercentage" scope="col" className="w-24 px-4 py-3 text-center text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Diploma %
            </th>
          );
          break;
        case 'gender':
          headers.push(
            <th key="gender" scope="col" className="w-20 px-4 py-3 text-center text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Gender
            </th>
          );
          break;
        case 'match':
          headers.push(
            <th key="match" scope="col" className="w-24 px-4 py-3 text-center text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Match
            </th>
          );
          break;
        case 'status':
          headers.push(
            <th key="status" scope="col" className="w-24 px-4 py-3 text-center text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Status
            </th>
          );
          break;
        case 'actions':
          headers.push(
            <th key="actions" scope="col" className="w-20 px-4 py-3 text-center text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Actions
            </th>
          );
          break;
        case 'resume':
          headers.push(
            <th key="resume" scope="col" className="w-20 px-4 py-3 text-center text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Resume
            </th>
          );
          break;
        case 'predict':
          headers.push(
            <th key="predict" scope="col" className="w-24 px-4 py-3 text-center text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Predict
            </th>
          );
          break;
        case 'question1':
          headers.push(
            <th key="question1" scope="col" className="w-48 px-4 py-3 text-left text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Question 1
            </th>
          );
          break;
        case 'question2':
          headers.push(
            <th key="question2" scope="col" className="w-48 px-4 py-3 text-left text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Question 2
            </th>
          );
          break;
        case 'feedback':
          headers.push(
            <th key="feedback" scope="col" className="w-32 px-4 py-3 text-left text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Feedback
            </th>
          );
          break;
        case 'rounds':
          headers.push(
            <th key="rounds" scope="col" className="w-48 px-4 py-3 text-left text-xs font-medium bg-teal-100 uppercase tracking-wider">
              Round Status 
            </th>
          );
          break;
        default:
          break;
      }
    });

    return headers;
  };

  // Function to render table cells dynamically
  const renderTableCells = (application) => {
    const cells = [];
    
    // Always include checkbox cell
    cells.push(
      <td key="checkbox" className="px-4 py-4">
        <input
          type="checkbox"
          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          checked={selectedApplications.includes(application.id)}
          onChange={(e) => {
            e.stopPropagation();
            setSelectedApplications(
              e.target.checked
                ? [...selectedApplications, application.id]
                : selectedApplications.filter(id => id !== application.id)
            );
          }}
        />
      </td>
    );

    // Add dynamic cells based on visibleColumns
    visibleColumns.forEach(column => {
      if (column.startsWith('q')) {
        const idx = parseInt(column.replace('q', '')) - 1;
        const ans = application.screening_answers && application.screening_answers[idx];
        cells.push(
          <td key={column} className="px-4 py-4 whitespace-nowrap text-center">
            {ans !== undefined && ans !== null && ans !== '' ? ans : <span className="text-gray-400">N/A</span>}
          </td>
        );
        return;
      }
      switch (column) {
        case 'name':
          cells.push(
            <td key="name" className="px-4 py-4 whitespace-nowrap">
              <div className="flex items-center">
                <div className="ml-0">
                  <div className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                    onClick={() => handleStudentClick(application.student)}>
                    {application.student.name}
                  </div>
                </div>
              </div>
            </td>
          );
          break;
        case 'rollNumber':
          cells.push(
            <td key="rollNumber" className="px-4 py-4 whitespace-nowrap">
              <div className="text-xs text-gray-500">{application.student.rollNumber}</div>
            </td>
          );
          break;
        case 'department':
          cells.push(
            <td key="department" className="px-4 py-4 whitespace-nowrap text-center">
              <div className="text-sm text-gray-900">{application.student.department}</div>
            </td>
          );
          break;
        case 'cgpa':
          cells.push(
            <td key="cgpa" className="px-4 py-4 whitespace-nowrap text-center">
              <span className={`inline-flex text-sm font-medium ${
                parseFloat(application.student.cgpa) >= 8.0 ? 'text-green-600' :
                parseFloat(application.student.cgpa) >= 7.0 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {parseFloat(application.student.cgpa).toFixed(1)}
              </span>
            </td>
          );
          break;
        case 'email':
          cells.push(
            <td key="email" className="px-4 py-4 whitespace-nowrap">
              <div className="text-sm text-gray-900">{application.student.email}</div>
            </td>
          );
          break;
        case 'phone':
          cells.push(
            <td key="phone" className="px-4 py-4 whitespace-nowrap">
              <div className="text-sm text-gray-900">{application.student.phone}</div>
            </td>
          );
          break;
        case 'currentArrears':
          cells.push(
            <td key="currentArrears" className="px-4 py-4 whitespace-nowrap text-center">
              <span className={`inline-flex text-sm font-medium ${
                parseInt(application.student.currentArrears) === 0 ? 'text-green-600' :
                parseInt(application.student.currentArrears) <= 2 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {application.student.currentArrears}
              </span>
            </td>
          );
          break;
        case 'historyArrears':
          cells.push(
            <td key="historyArrears" className="px-4 py-4 whitespace-nowrap text-center">
              <span className={`inline-flex text-sm font-medium ${
                parseInt(application.student.historyArrears) === 0 ? 'text-green-600' :
                parseInt(application.student.historyArrears) <= 2 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {application.student.historyArrears}
              </span>
            </td>
          );
          break;
        case 'skills':
          cells.push(
            <td key="skills" className="px-4 py-4 whitespace-normal">
              <div className="text-sm text-gray-900">
                {Array.isArray(application.student.skills) && application.student.skills.length > 0 
                  ? application.student.skills.slice(0, 3).join(', ') + (application.student.skills.length > 3 ? '...' : '')
                  : 'N/A'
                }
              </div>
            </td>
          );
          break;
        case 'tenthPercentage':
          cells.push(
            <td key="tenthPercentage" className="px-4 py-4 whitespace-nowrap text-center">
              <div className="text-sm text-gray-900">{application.student.tenthPercentage}</div>
            </td>
          );
          break;
        case 'twelfthPercentage':
          cells.push(
            <td key="twelfthPercentage" className="px-4 py-4 whitespace-nowrap text-center">
              <div className="text-sm text-gray-900">{application.student.twelfthPercentage}</div>
            </td>
          );
          break;
        case 'diplomaPercentage':
          cells.push(
            <td key="diplomaPercentage" className="px-4 py-4 whitespace-nowrap text-center">
              <div className="text-sm text-gray-900">{application.student.diplomaPercentage}</div>
            </td>
          );
          break;
        case 'gender':
          cells.push(
            <td key="gender" className="px-4 py-4 whitespace-nowrap text-center">
              <div className="text-sm text-gray-900">{application.student.gender}</div>
            </td>
          );
          break;
        case 'match':
          cells.push(
            <td key="match" className="px-4 py-4 whitespace-nowrap text-center">
              {(() => {
                const matchPercentage = calculateSkillMatch(
                  application.student?.skills || [],
                  application.job?.requiredSkills || []
                );
                return (
                  <>
                    <div className="w-full bg-gray-200 rounded-full h-2.5" style={{ position: 'relative', zIndex: 10, overflow: 'visible' }}>
                      <div
                        className={`h-2.5 rounded-full ${
                          matchPercentage >= 70 ? 'bg-green-600' :
                          matchPercentage >= 40 ? 'bg-yellow-600' :
                          'bg-red-600'
                        }`}
                        style={{ width: `${matchPercentage}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 mt-1" style={{ display: 'block', marginTop: '4px' }}>
                      {matchPercentage}%
                    </span>
                  </>
                );
              })()}
            </td>
          );
          break;
        case 'status':
          cells.push(
            <td key="status" className="px-4 py-4 whitespace-nowrap text-center">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig[application.status]?.class || statusConfig.pending.class}`}>
                {statusConfig[application.status]?.label || 'Pending'}
              </span>
            </td>
          );
          break;
        case 'actions':
          cells.push(
            <td key="actions" className="px-4 py-4 whitespace-nowrap text-center relative">
              <div className="relative inline-block text-left dropdown-container">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDropdownPosition({
                      top: rect.bottom + window.scrollY,
                      left: rect.left + window.scrollX
                    });
                    setOpenDropdownId(openDropdownId === application.id ? null : application.id);
                  }}
                  className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-3 py-1 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                >
                  Actions
                </button>

                {openDropdownId === application.id && (
                  <div
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 focus:outline-none z-50"
                    style={{
                      position: 'fixed',
                      top: `${dropdownPosition.top}px`,
                      left: `${dropdownPosition.left}px`
                    }}
                  >
                    <div className="py-1">
                      {Object.entries(statusConfig).map(([status, config]) => (
                        <button
                          key={status}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusUpdate(application.id, status);
                            setOpenDropdownId(null);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <span className="mr-2">
                            {status === 'underReview' && ''}
                            {status === 'shortlisted' && ''}
                            {status === 'onHold' && ''}
                            {status === 'interview' && ''}
                            {status === 'selected' && ''}
                            {status === 'rejected' && ''}
                          </span> {config.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </td>
          );
          break;
        case 'resume':
          cells.push(
            <td key="resume" className="px-4 py-4 whitespace-nowrap text-center">
              {application.student?.resumeUrl ? (
                <a
                  href={application.student.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View
                </a>
              ) : (
                <span className="text-gray-500">N/A</span>
              )}
            </td>
          );
          break;
        case 'predict':
          cells.push(
            <td key="predict" className="px-4 py-4 whitespace-nowrap text-center">
              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">High</span>
            </td>
          );
          break;
        case 'question1':
          cells.push(
            <td key="question1" className="px-4 py-4 whitespace-normal text-sm text-gray-900">
              {application.screening_answers?.[0] ? (
                <TruncatedAnswer text={application.screening_answers[0]} />
              ) : (
                'N/A'
              )}
            </td>
          );
          break;
        case 'question2':
          cells.push(
            <td key="question2" className="px-4 py-4 whitespace-normal text-sm text-gray-900">
              {application.screening_answers?.[1] ? (
                <TruncatedAnswer text={application.screening_answers[1]} />
              ) : (
                'N/A'
              )}
            </td>
          );
          break;
        case 'feedback':
          cells.push(
            <td key="feedback" className="px-4 py-4 whitespace-nowrap">
              {editingFeedbackId === application.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingFeedbackValue}
                    onChange={(e) => setEditingFeedbackValue(e.target.value)}
                    onBlur={() => handleBlurSaveFeedback(application.id)}
                    onKeyPress={(e) => handleKeyPressSaveFeedback(e, application.id)}
                    className="text-sm text-gray-900 border rounded px-2 py-1 flex-1 min-w-[150px]"
                    placeholder="Enter feedback..."
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log("Save button clicked manually");
                      handleSaveButtonClick(application.id);
                    }}
                    className={`px-3 py-1 ${savingFeedback ? 'bg-gray-400' : 'bg-blue-600'} text-white text-xs rounded hover:bg-blue-700`}
                    disabled={savingFeedback}
                  >
                    {savingFeedback ? 'Saving...' : 'Save'}
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => handleEditFeedback(application)}
                  className="text-sm text-gray-500 cursor-pointer hover:text-gray-700"
                >
                  {application.feedback ? (
                    <TruncatedFeedback text={application.feedback} />
                  ) : (
                    'Add feedback...'
                  )}
                </div>
              )}
            </td>
          );
          break;
        case 'rounds':
          cells.push(
            <td key="rounds" className="px-4 py-4 whitespace-nowrap">
              {(() => {
                const studentData = application.studentData || application.student || {};
                const rounds = studentData.rounds || {};
                const status = rounds[currentRound] || 'Pending';
                let colorClass = 'bg-gray-100 text-gray-800';
                if (status === 'Shortlisted') colorClass = 'bg-green-100 text-green-800';
                else if (status === 'Rejected') colorClass = 'bg-red-100 text-red-800';
                else if (status === 'Pending') colorClass = 'bg-yellow-100 text-yellow-800';
                return (
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
                    {status}
                  </span>
                );
              })()}
            </td>
          );
          break;
        default:
          break;
      }
    });

    return cells;
  };

  // Modify the return statement to handle loading and empty states
  return (
    <div className="mt-8 flex flex-col">
      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center min-h-[200px]">
          <LoadingSpinner size="large" text="Loading applications..." />
        </div>
      ) : filteredApplications.length === 0 ? (
        <NoData text="No applications found." />
      ) : (
      <>
        {/* Mobile card view */}
        <div className="md:hidden space-y-3">
          {filteredApplications.map((application) => (
            <div key={application.id} className="bg-white rounded-lg border p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-gray-900 truncate">{application.student?.name || 'N/A'}</div>
                  <div className="text-sm text-gray-500 truncate">{application.student?.rollNumber || '—'}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    {application.student?.department && (
                      <span className="px-2 py-0.5 bg-gray-100 rounded">{application.student.department}</span>
                    )}
                    {application.student?.cgpa !== undefined && (
                      <span className="px-2 py-0.5 bg-gray-100 rounded">CGPA: {application.student.cgpa}</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusConfig[application.status]?.class || statusConfig.pending.class}`}>
                    {statusConfig[application.status]?.label || 'Pending'}
                  </span>
                </div>
              </div>
              {/* Quick actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleStudentClick(application.student)}
                  className="px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50"
                >
                  View Profile
                </button>
                {application.student?.resumeUrl && (
                  <a
                    href={application.student.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50"
                  >
                    Resume
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Table view for md+ */}
        <div className="hidden md:block overflow-x-auto w-full" style={{ maxWidth: '100%', position: 'relative', zIndex: 1 }}>
          <div className="inline-block min-w-full align-middle">
            <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-400">
                <thead className="bg-gray-50">
                  <tr>
                    {renderTableHeaders()}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredApplications.map((application) => {
                    console.log("Rendering application row:", application.id);
                    console.log("Application screening_answers:", application.screening_answers);
                    return (
                      <tr key={application.id} className="hover:bg-gray-50">
                        {renderTableCells(application)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </>
      )}
    </div>
  );
};

export default ApplicationsTable;
