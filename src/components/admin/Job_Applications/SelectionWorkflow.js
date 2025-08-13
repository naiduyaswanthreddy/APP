import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, addDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { createSystemAlertNotification, createStatusUpdateNotification } from '../../../utils/notificationHelpers';

const EnhancedSelectionWorkflow = ({ application, job, onStatusUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [offerDetails, setOfferDetails] = useState({
    offerLetter: '',
    joiningDate: '',
    package: '',
    location: '',
    terms: ''
  });

  useEffect(() => {
    if (application?.student_id) {
      fetchStudentDetails();
    }
  }, [application?.student_id]);

  const fetchStudentDetails = async () => {
    try {
      const studentRef = doc(db, "students", application.student_id);
      const studentDoc = await getDoc(studentRef);
      if (studentDoc.exists()) {
        setStudentDetails(studentDoc.data());
      }
    } catch (error) {
      console.error("Error fetching student details:", error);
    }
  };

  // Validation functions
  const validateSelection = () => {
    if (!application || !job) return false;
    if (application.status !== 'shortlisted') return false;
    return true;
  };

  const validateAcceptance = () => {
    if (!application || application.status !== 'selected') return false;
    return true;
  };

  // Database operations
  const updateApplicationStatus = async (status, data = {}) => {
    const applicationRef = doc(db, "applications", application.id);
    await updateDoc(applicationRef, {
      status,
      ...data,
      updatedAt: new Date(),
      lastModifiedBy: 'admin',
      statusHistory: [...(application.statusHistory || []), {
        status,
        timestamp: new Date(),
        by: 'admin'
      }]
    });
  };

  const createOffer = async (selectionData) => {
    const offerRef = collection(db, "offers");
    const offerDoc = await addDoc(offerRef, {
      applicationId: application.id,
      studentId: application.student_id,
      jobId: job.id,
      companyName: job.company,
      position: job.position,
      offerDetails: {
        package: selectionData.package || job.salary,
        joiningDate: selectionData.joiningDate,
        location: selectionData.location || job.location,
        offerLetter: selectionData.offerLetter,
        terms: selectionData.terms
      },
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
    return offerDoc.id;
  };

  const updateStudentPlacementStatus = async (acceptanceData) => {
    const studentRef = doc(db, "students", application.student_id);
    await updateDoc(studentRef, {
      placementStatus: "placed",
      placedCompany: job.company,
      placedPackage: acceptanceData.package || job.salary,
      placedJobTitle: job.position,
      placedLocation: acceptanceData.location || job.location,
      placedAt: new Date(),
      joiningDate: acceptanceData.joiningDate,
      updatedAt: new Date()
    });
  };

  const updateCompanyStats = async (action) => {
    const companyRef = doc(db, "companies", job.company_id);
    const companyDoc = await getDoc(companyRef);
    const companyData = companyDoc.data();
    
    const stats = {
      selected: (companyData.selectedStudents || 0) + (action === 'selected' ? 1 : 0),
      rejected: (companyData.rejectedOffers || 0) + (action === 'rejected' ? 1 : 0),
      placed: (companyData.placedStudents || 0) + (action === 'accepted' ? 1 : 0)
    };

    await updateDoc(companyRef, {
      ...stats,
      updatedAt: new Date()
    });
  };

  const updatePlacementStats = async (acceptanceData) => {
    const statsRef = collection(db, "placement_statistics");
    const currentYear = new Date().getFullYear();
    
    const statsQuery = query(statsRef, where("year", "==", currentYear));
    const statsSnapshot = await getDocs(statsQuery);
    
    if (!statsSnapshot.empty) {
      const statsDoc = statsSnapshot.docs[0];
      await updateDoc(statsDoc.ref, {
        totalPlaced: (statsDoc.data().totalPlaced || 0) + 1,
        totalOffers: (statsDoc.data().totalOffers || 0) + 1,
        averagePackage: calculateAveragePackage(statsDoc.data(), acceptanceData.package || job.salary),
        updatedAt: new Date()
      });
    } else {
      await addDoc(statsRef, {
        year: currentYear,
        totalPlaced: 1,
        totalOffers: 1,
        averagePackage: acceptanceData.package || job.salary,
        createdAt: new Date()
      });
    }
  };

  const calculateAveragePackage = (stats, newPackage) => {
    const currentTotal = (stats.averagePackage || 0) * (stats.totalOffers || 0);
    const newTotal = currentTotal + parseFloat(newPackage || 0);
    return newTotal / ((stats.totalOffers || 0) + 1);
  };

  const updateStudentRejectionCount = async () => {
    const studentRef = doc(db, "students", application.student_id);
    const studentDoc = await getDoc(studentRef);
    const currentRejections = studentDoc.data().rejectionCount || 0;
    
    await updateDoc(studentRef, {
      rejectionCount: currentRejections + 1,
      updatedAt: new Date()
    });
  };

  const sendRejectionNotification = async (rejectionData) => {
    const notificationRef = collection(db, "notifications");
    await addDoc(notificationRef, {
      studentId: application.student_id,
      type: 'offer_rejected',
      title: 'Offer Rejected',
      message: `You have rejected the offer from ${job.company} for the position of ${job.position}. You may continue applying for other opportunities.`,
      jobId: job.id,
      createdAt: new Date(),
      read: false
    });
  };

  const addToPlacedStudents = async (acceptanceData) => {
    try {
      const placedRef = collection(db, 'placed_students');
      await addDoc(placedRef, {
        studentId: application.student_id,
        jobId: job.id,
        companyName: job.company,
        package: acceptanceData.package || job.salary,
        position: job.position,
        location: acceptanceData.location || job.location,
        joiningDate: acceptanceData.joiningDate,
        placedAt: new Date(),
        status: 'placed'
      });
    } catch (error) {
      console.error("Error adding to placed students:", error);
    }
  };

  // Main workflow handlers
  const handleFinalRoundSelection = async () => {
    setLoading(true);
    try {
      if (!validateSelection()) {
        toast.error("Selection validation failed");
        return;
      }

      await updateApplicationStatus("selected");
      await updateStudentPlacementStatus({});
      await addToPlacedStudents({});
      await updatePlacementStats({});
      await updateCompanyStats('selected');
      await sendSelectionNotification({});

      // Send admin notification
      try {
        await createSystemAlertNotification(
          'Student Selected',
          `${studentDetails?.name || 'Student'} has been selected for ${job?.position || 'position'} at ${job?.company || 'company'}`,
          `/admin/job-applications/${job?.id || 'unknown'}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success("Student marked as selected!");
      onStatusUpdate();
    } catch (error) {
      console.error("Error in final round selection:", error);
      toast.error("Failed to mark student as selected");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async () => {
    setLoading(true);
    try {
      if (!validateAcceptance()) {
        toast.error("Acceptance validation failed");
        return;
      }

      await updateApplicationStatus("Accepted");
      await updateStudentPlacementStatus({});
      await addToPlacedStudents({});
      await updatePlacementStats({});
      await updateCompanyStats('accepted');
      await sendAcceptanceNotification({});

      // Send admin notification
      try {
        await createSystemAlertNotification(
          'Offer Accepted',
          `${studentDetails?.name || 'Student'} has accepted the offer for ${job?.position || 'position'} at ${job?.company || 'company'}`,
          `/admin/job-applications/${job?.id || 'unknown'}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success("Offer accepted! Student marked as placed.");
      onStatusUpdate();
    } catch (error) {
      console.error("Error in offer acceptance:", error);
      toast.error("Failed to process offer acceptance");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectOffer = async () => {
    setLoading(true);
    try {
      await updateApplicationStatus("Rejected Offer");
      await updateStudentRejectionCount();
      await updateCompanyStats('rejected');
      await sendRejectionNotification({});

      // Send admin notification
      try {
        await createSystemAlertNotification(
          'Offer Rejected',
          `${studentDetails?.name || 'Student'} has rejected the offer for ${job?.position || 'position'} at ${job?.company || 'company'}`,
          `/admin/job-applications/${job?.id || 'unknown'}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success("Offer rejected successfully");
      onStatusUpdate();
    } catch (error) {
      console.error("Error in offer rejection:", error);
      toast.error("Failed to process offer rejection");
    } finally {
      setLoading(false);
    }
  };

  // Notification functions
  const sendSelectionNotification = async (offerId) => {
    try {
      // Import the notification helper function
      const { sendSelectionNotification: sendNotification } = await import('../../../utils/notificationHelpers');
      await sendNotification(application.student_id, job.id, job.position, job.company);
    } catch (error) {
      // Fallback to direct notification creation
      const notificationRef = collection(db, "notifications");
      await addDoc(notificationRef, {
        studentId: application.student_id,
        type: 'job_selection',
        title: 'Congratulations! You have been selected!',
        message: `You have been selected for ${job.position} at ${job.company}. Please accept or reject your offer.`,
        jobId: job.id,
        createdAt: new Date(),
        read: false,
        recipientType: 'student'
      });
    }
  };

  const sendAcceptanceNotification = async (acceptanceData) => {
    const notificationRef = collection(db, "notifications");
    await addDoc(notificationRef, {
      studentId: application.student_id,
      type: 'offer_accepted',
      title: 'Offer Accepted Successfully',
      message: `You have successfully accepted the offer from ${job.company} for the position of ${job.position}. Your joining date is ${acceptanceData.joiningDate || 'TBD'}. Congratulations on your placement!`,
      jobId: job.id,
      createdAt: new Date(),
      read: false
    });
  };

  const logAuditEvent = async (eventType, data) => {
    try {
      const auditRef = collection(db, 'audit_logs');
      await addDoc(auditRef, {
        applicationId: application.id,
        eventType,
        timestamp: new Date(),
        createdBy: 'admin',
        jobId: job?.id,
        companyName: job?.company,
        ...data
      });
    } catch (error) {
      console.error("Error logging audit event:", error);
    }
  };

  // Render offer decision panel
  const renderOfferDecisionPanel = () => {
    if (application.status === 'selected') {
      return (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Congratulations! You have been selected!</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Please confirm your decision:</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      setConfirmAction('accept');
                      setShowConfirmDialog(true);
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    Accept Offer
                  </button>
                  <button
                    onClick={() => {
                      setConfirmAction('reject');
                      setShowConfirmDialog(true);
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject Offer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Render confirmation dialog
  const renderConfirmDialog = () => {
    if (!showConfirmDialog) return null;

    const message = confirmAction === 'accept' 
      ? "Are you sure you want to accept this offer? You will be marked as placed."
      : "Are you sure you want to reject this offer? This will count towards your rejection limit.";

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div className="mt-3 text-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Confirm Decision
            </h3>
            <div className="mt-2 px-7 py-3">
              <p className="text-sm text-gray-500">
                {message}
              </p>
            </div>
            <div className="items-center px-4 py-3">
              <button
                onClick={() => {
                  if (confirmAction === 'accept') {
                    handleAcceptOffer();
                  } else {
                    handleRejectOffer();
                  }
                  setShowConfirmDialog(false);
                }}
                className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-20 mr-2 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md w-20 hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {application.status === 'shortlisted' && job?.rounds?.length === application.reachedRound && (
        <button
          onClick={handleFinalRoundSelection}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Mark as Selected
        </button>
      )}
      
      {renderOfferDecisionPanel()}
      {renderConfirmDialog()}
    </div>
  );
};

export default EnhancedSelectionWorkflow;
