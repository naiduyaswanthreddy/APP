import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import ApplicationsTable from './ApplicationsTable';
import AnswersModal from './AnswersModal';
import PageLoader from '../../ui/PageLoader';

function ApplicationsList() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [selectedApplications, setSelectedApplications] = useState([]);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [selectedAnswers, setSelectedAnswers] = useState(null);
  const [isAnswersModalOpen, setIsAnswersModalOpen] = useState(false);
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const applicationsPerPage = 20;
  
  // Create a stable reference to the db
  const dbRef = useRef(db);
 
  // Initialize stableSaveFeedback ref
  const stableSaveFeedback = useRef((id, value) => {
    console.log("Initial dummy function called - this should not happen");
    return false;
  });

  // Status configuration
  const statusConfig = {
    pending: { label: 'Pending', class: 'bg-gray-100 text-gray-800' },
    underReview: { label: 'Under Review', class: 'bg-blue-100 text-blue-800' },
    shortlisted: { label: 'Shortlisted', class: 'bg-green-100 text-green-800' },
    onHold: { label: 'On Hold', class: 'bg-yellow-100 text-yellow-800' },
    interview: { label: 'Interview', class: 'bg-purple-100 text-purple-800' },
    selected: { label: 'Selected', class: 'bg-emerald-100 text-emerald-800' },
    rejected: { label: 'Rejected', class: 'bg-red-100 text-red-800' },
  };

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const applicationsCollection = collection(db, 'applications');
        const applicationSnapshot = await getDocs(applicationsCollection);
        const rawApplications = applicationSnapshot.docs.map(doc => ({
          id: doc.id,
          feedback: doc.data().feedback || '',
          ...doc.data()
        }));
        
        const transformedApplications = rawApplications.map(app => {
          const answers = app.screening_answers || {};
          const formattedAnswers = [];
          for (const [key, value] of Object.entries(answers)) {
            formattedAnswers.push({
              question: key,
              answer: value
            });
          }
          return {
            ...app,
            feedback: app.feedback || '',
            screening_answers: answers,
            screeningAnswers: formattedAnswers
          };
        });

        setApplications(rawApplications);
        setFilteredApplications(transformedApplications);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching applications:", error);
        setLoading(false);
      }
    };
    fetchApplications();
  }, []);

  // Calculate pagination data
  const indexOfLastApplication = currentPage * applicationsPerPage;
  const indexOfFirstApplication = indexOfLastApplication - applicationsPerPage;
  const currentApplications = filteredApplications.slice(indexOfFirstApplication, indexOfLastApplication);
  const totalPages = Math.ceil(filteredApplications.length / applicationsPerPage);

  // Handler for page changes
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    setOpenDropdownId(null); // Close any open dropdowns when changing pages
  };

  // Handler for student profile click
  const handleStudentClick = (student) => {
    console.log("Student clicked:", student);
  };

  // Handler for status update
  const handleStatusUpdate = async (applicationId, newStatus) => {
    console.log("Status update:", applicationId, newStatus);
  };

  const handleCloseAnswersModal = () => {
    setIsAnswersModalOpen(false);
    setSelectedAnswers(null);
  };

  const handleSaveFeedback = useCallback(async (applicationId, feedbackValue) => {
    console.log("ApplicationsList: handleSaveFeedback called with", applicationId, feedbackValue);
 
    if (!applicationId || typeof feedbackValue !== 'string') {
      console.error('Invalid arguments for handleSaveFeedback');
      return false;
    }
 
    try {
      const currentDb = dbRef.current;
      const applicationRef = doc(currentDb, 'applications', applicationId);
      console.log(`Attempting to update application ${applicationId} with feedback: ${feedbackValue}`);
      
      await updateDoc(applicationRef, {
        feedback: feedbackValue
      });
      
      setApplications(prevApps =>
        prevApps.map(app =>
          app.id === applicationId ? { ...app, feedback: feedbackValue } : app
        )
      );
      
      setFilteredApplications(prevFiltered =>
        prevFiltered.map(app =>
          app.id === applicationId ? { ...app, feedback: feedbackValue } : app
        )
      );
 
      console.log(`Feedback saved successfully for application ${applicationId}`);
      return true;
    } catch (error) {
      console.error(`Error saving feedback for application ${applicationId}:`, error);
      if (error.code) {
        console.error(`Firebase error code: ${error.code}`);
      }
      return false;
    }
  }, []);

  useEffect(() => {
    console.log("Updating stableSaveFeedback ref in useEffect");
    stableSaveFeedback.current = handleSaveFeedback;
  }, [handleSaveFeedback]);

  const saveFeedbackWrapper = async (id, value) => {
    console.log("Wrapper function called with", id, value);
    if (typeof stableSaveFeedback.current !== 'function') {
      console.error("stableSaveFeedback.current is not a function in wrapper", stableSaveFeedback.current);
      return false;
    }
    return await stableSaveFeedback.current(id, value);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Job Applications</h1>
      <ApplicationsTable
        loading={loading}
        filteredApplications={currentApplications} // Use paginated applications
        selectedApplications={selectedApplications}
        setSelectedApplications={setSelectedApplications}
        handleStudentClick={handleStudentClick}
        statusConfig={statusConfig}
        openDropdownId={openDropdownId}
        setOpenDropdownId={setOpenDropdownId}
        dropdownPosition={dropdownPosition}
        setDropdownPosition={setDropdownPosition}
        handleStatusUpdate={handleStatusUpdate}
        handleSaveFeedback={saveFeedbackWrapper}
        setSelectedAnswers={setSelectedAnswers}
        setIsAnswersModalOpen={setIsAnswersModalOpen}
        visibleColumns={[
          'name', 'rollNumber', 'department', 'cgpa', 'match', 'status', 'actions', 'resume', 'predict',
          'question1', 'question2', 'feedback'
        ]}
      />
      {/* Pagination Controls */}
      <div className="mt-4 flex justify-between items-center">
        <div>
          Showing {indexOfFirstApplication + 1} to {Math.min(indexOfLastApplication, filteredApplications.length)} of {filteredApplications.length} applications
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-200 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-4 py-2 rounded ${currentPage === page ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-200 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
      {isAnswersModalOpen && (
        <AnswersModal
          answers={selectedAnswers}
          onClose={handleCloseAnswersModal}
        />
      )}
    </div>
  );
}

export default ApplicationsList;