import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, writeBatch, serverTimestamp, deleteDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { createStatusUpdateNotification, createNotification, createSystemAlertNotification } from '../../utils/notificationHelpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import Loader from '../../loading';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  under_review: 'bg-blue-100 text-blue-800',
  shortlisted: 'bg-green-100 text-green-800',
  not_shortlisted: 'bg-red-100 text-red-800',
  waitlisted: 'bg-orange-100 text-orange-800',
  interview_scheduled: 'bg-purple-100 text-purple-800',
  selected: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-red-100 text-red-800',
  offer_accepted: 'bg-green-100 text-green-800',
  offer_rejected: 'bg-red-100 text-red-800',
  placed: 'bg-emerald-100 text-emerald-800'
};

const STATUS_LABELS = {
  pending: '⏳ Pending',
  under_review: '⏳ Under Review',
  shortlisted: '✅ Shortlisted',
  not_shortlisted: '❌ Not Shortlisted',
  waitlisted: '🟡 Waitlisted',
  interview_scheduled: '📅 Interview Scheduled',
  selected: '🎉 Selected',
  rejected: '⚠️ Rejected',
  withdrawn: '🚫 Withdrawn',
  offer_accepted: '✅ Offer Accepted',
  offer_rejected: '❌ Offer Rejected',
  placed: '🎉 Placed'
};

const Applications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPlaced, setIsPlaced] = useState(false);
  const [showOfferDecision, setShowOfferDecision] = useState({});
  const [offerDecisionLoading, setOfferDecisionLoading] = useState({});

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Fetch student data
      const studentDoc = await getDoc(doc(db, 'students', user.uid));
      const studentData = studentDoc.data();
      const studentSkills = studentData?.skills || [];
      setIsPlaced(studentData?.offerDecision === 'Accepted');

      const applicationsRef = collection(db, 'applications');
      const q = query(applicationsRef, where('student_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      const applicationsData = [];
      for (const docSnapshot of querySnapshot.docs) {
        const applicationData = docSnapshot.data();
        const jobRef = doc(db, 'jobs', applicationData.job_id || applicationData.jobId);
        const jobDoc = await getDoc(jobRef);
        
        if (jobDoc.exists()) {
          const jobData = jobDoc.data();
          // Calculate skill match percentage
          const requiredSkills = jobData.skills || jobData.eligibilityCriteria?.skills || [];
          const matchedSkills = requiredSkills.filter(skill => 
            studentSkills.map(s => s.toLowerCase()).includes(skill.toLowerCase())
          );
          const skillMatch = requiredSkills.length > 0 
            ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
            : 0;

          // Determine current round
          const rounds = Array.isArray(jobData.rounds) ? jobData.rounds : jobData.hiringWorkflow || [];
          const currentRoundIndex = jobData.currentRoundIndex || 0;
          const currentRound = rounds[currentRoundIndex]?.name || rounds[currentRoundIndex]?.roundName || 'N/A';

          applicationsData.push({
            id: docSnapshot.id,
            ...applicationData,
            job: jobData,
            skillMatch: skillMatch,
            currentRound: currentRound,
            rounds: applicationData.student?.rounds || {},
            offerDecision: applicationData.offerDecision || null,
            decisionDate: applicationData.decisionDate || null
          });
        }
      }

      setApplications(applicationsData);
      
      // Check for status updates and selection notifications
      const lastFetchTime = localStorage.getItem('lastApplicationsFetchTime');
      if (lastFetchTime) {
        const lastFetchDate = new Date(parseInt(lastFetchTime, 10));
        applicationsData.forEach(app => {
          if (app.statusUpdatedAt && app.statusUpdatedAt.toDate() > lastFetchDate) {
            createStatusUpdateNotification(user.uid, app);
          }
          if (app.rounds[app.currentRound] === 'selected' && !app.offerDecision) {
            createNotification({
              userId: user.uid,
              type: 'selection',
              message: `Congratulations! You have been selected for ${app.job.position} at ${app.job.company}. Please accept or reject your offer.`,
              action: {
                label: 'View Offer',
                url: `/applications`
              }
            });
          }
        });
      }
      
      localStorage.setItem('lastApplicationsFetchTime', Date.now().toString());
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to fetch applications');
    } finally {
      setLoading(false);
    }
  };

  const getStatusProgressPoints = (rounds, currentRound, jobRounds) => {
    if (!Array.isArray(jobRounds)) return [];

    const currentIndex = jobRounds.findIndex(r => (r.name || r.roundName) === currentRound);

    return jobRounds.map((round, index) => {
      const roundName = round.name || round.roundName || `Round ${index + 1}`;

      return {
        completed: rounds[roundName] === 'shortlisted' || index < currentIndex,
        stageName: roundName,
        roundLabel: `R${index + 1}`
      };
    });
  };

  const getStatusProgress = (rounds, currentRound, jobRounds) => {
    if (!Array.isArray(jobRounds) || jobRounds.length <= 1) {
      return 0;
    }

    let lastShortlistedIndex = -1;
    jobRounds.forEach((round, index) => {
      const roundName = round.name || round.roundName;
      if (rounds[roundName] === 'shortlisted') {
        lastShortlistedIndex = index;
      }
    });

    const currentIndex = jobRounds.findIndex(r => (r.name || r.roundName) === currentRound);
    const effectiveIndex = lastShortlistedIndex >= 0 ? lastShortlistedIndex : (currentIndex >= 0 ? currentIndex : -1);

    if (effectiveIndex < 0) {
      return 0;
    }

    const progress = (effectiveIndex / (jobRounds.length - 1)) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  const handleAcceptOffer = async (applicationId) => {
    if (!window.confirm(
      "Are you sure you want to accept this offer? You will be marked as placed and may not be eligible for other jobs."
    )) {
      return;
    }

    try {
      const response = await fetch(`/api/applications/${applicationId}/accept-offer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to accept offer');
      }

      const batch = writeBatch(db);
      const applicationRef = doc(db, 'applications', applicationId);
      const studentRef = doc(db, 'students', auth.currentUser.uid);

      batch.update(applicationRef, {
        offerDecision: 'Accepted',
        decisionDate: serverTimestamp(),
        lastModifiedBy: 'student'
      });

      batch.update(studentRef, {
        offerDecision: 'Accepted',
        placedJobId: applicationId
      });

      await batch.commit();

      setApplications(applications.map(app =>
        app.id === applicationId ? {
          ...app,
          offerDecision: 'Accepted',
          decisionDate: new Date()
        } : app
      ));

      setIsPlaced(true);

      createNotification({
        userId: auth.currentUser.uid,
        type: 'acceptance',
        message: `You have successfully accepted the offer from ${applications.find(app => app.id === applicationId).job.company}. Congratulations!`
      });

      toast.success("Offer accepted successfully!");
    } catch (error) {
      console.error("Error accepting offer:", error);
      toast.error("Error accepting offer!");
    }
  };

  const handleRejectOffer = async (applicationId) => {
    if (!window.confirm(
      "Are you sure you want to reject this offer? This will be counted towards your rejection limit."
    )) {
      return;
    }

    try {
      const response = await fetch(`/api/applications/${applicationId}/reject-offer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to reject offer');
      }

      const batch = writeBatch(db);
      const applicationRef = doc(db, 'applications', applicationId);

      batch.update(applicationRef, {
        offerDecision: 'Rejected',
        decisionDate: serverTimestamp(),
        lastModifiedBy: 'student'
      });

      await batch.commit();

      setApplications(applications.map(app =>
        app.id === applicationId ? {
          ...app,
          offerDecision: 'Rejected',
          decisionDate: new Date()
        } : app
      ));

      createNotification({
        userId: auth.currentUser.uid,
        type: 'rejection',
        message: `You have rejected the offer from ${applications.find(app => app.id === applicationId).job.company}. You may continue applying for other opportunities.`
      });

      toast.success("Offer rejected successfully!");
    } catch (error) {
      console.error("Error rejecting offer:", error);
      toast.error("Error rejecting offer!");
    }
  };

  const handleWithdraw = async (applicationId) => {
    if (!window.confirm(
      "WARNING: If you withdraw this application, you CANNOT reapply to this job. Are you sure you want to withdraw?"
    )) {
      return;
    }

    try {
      const application = applications.find(app => app.id === applicationId);
      if (!application) {
        toast.error('Application not found');
        return;
      }

      // Update application status
      const applicationRef = doc(db, 'applications', applicationId);
      await updateDoc(applicationRef, {
        status: 'withdrawn',
        withdrawnAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Send notification to student
      try {
        await createStatusUpdateNotification(auth.currentUser.uid, {
          job: { position: application.job?.position || 'Unknown Position' },
          status: 'withdrawn'
        });
      } catch (error) {
        console.error('Error sending withdrawal notification:', error);
      }

      // Send admin notification
      try {
        await createSystemAlertNotification(
          'Application Withdrawn',
          `Student ${auth.currentUser.displayName || 'Unknown'} has withdrawn their application for ${application.job?.position || 'position'} at ${application.job?.company || 'company'}.`,
          `/admin/job-applications/${application.job_id || 'unknown'}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success('Application withdrawn successfully');
      fetchApplications();
    } catch (error) {
      console.error('Error withdrawing application:', error);
      toast.error('Failed to withdraw application');
    }
  };

  const handleOfferDecision = async (applicationId, decision) => {
    try {
      const application = applications.find(app => app.id === applicationId);
      if (!application) {
        toast.error('Application not found');
        return;
      }

      const applicationRef = doc(db, 'applications', applicationId);
      const studentRef = doc(db, 'students', auth.currentUser.uid);
      
      if (decision === 'accept') {
        // Accept offer
        await updateDoc(applicationRef, {
          status: 'offer_accepted',
          offerDecision: 'Accepted',
          decisionDate: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Update student placement status
        await updateDoc(studentRef, {
          placementStatus: 'placed',
          placedCompany: application.job.company,
          placedJobTitle: application.job.position,
          placedPackage: application.job.ctc || application.job.salary,
          placedLocation: application.job.location,
          placedAt: serverTimestamp(),
          offerDecision: 'Accepted',
          decisionDate: serverTimestamp()
        });

        // Add to placed students collection
        await addDoc(collection(db, 'placed_students'), {
          studentId: auth.currentUser.uid,
          jobId: application.job_id,
          applicationId: applicationId,
          companyName: application.job.company,
          jobTitle: application.job.position,
          package: application.job.ctc || application.job.salary,
          location: application.job.location,
          acceptedAt: serverTimestamp(),
          status: 'active'
        });

        // Send notification to student
        try {
          await createStatusUpdateNotification(auth.currentUser.uid, {
            job: { position: application.job.position },
            status: 'offer_accepted'
          });
        } catch (error) {
          console.error('Error sending offer acceptance notification:', error);
        }

        // Send admin notification
        try {
          await createSystemAlertNotification(
            'Offer Accepted',
            `Student ${auth.currentUser.displayName || 'Unknown'} has accepted the offer for ${application.job.position} at ${application.job.company}.`,
            `/admin/job-applications/${application.job_id || 'unknown'}`
          );
        } catch (error) {
          console.error('Error sending admin notification:', error);
        }

        toast.success("Offer accepted successfully! Congratulations on your placement!");
      } else {
        // Reject offer
        await updateDoc(applicationRef, {
          status: 'offer_rejected',
          offerDecision: 'Rejected',
          decisionDate: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Update student rejection count
        await updateDoc(studentRef, {
          rejectedOffersCount: (application.rejectedOffersCount || 0) + 1,
          lastOfferRejection: serverTimestamp()
        });

        // Send notification to student
        try {
          await createStatusUpdateNotification(auth.currentUser.uid, {
            job: { position: application.job.position },
            status: 'offer_rejected'
          });
        } catch (error) {
          console.error('Error sending offer rejection notification:', error);
        }

        // Send admin notification
        try {
          await createSystemAlertNotification(
            'Offer Rejected',
            `Student ${auth.currentUser.displayName || 'Unknown'} has rejected the offer for ${application.job.position} at ${application.job.company}.`,
            `/admin/job-applications/${application.job_id || 'unknown'}`
          );
        } catch (error) {
          console.error('Error sending admin notification:', error);
        }

        toast.success("Offer rejected successfully. You may continue applying for other opportunities.");
      }

      // Update local state
      setApplications(prevApplications =>
        prevApplications.map(app =>
          app.id === applicationId
            ? { ...app, status: decision === 'accept' ? 'offer_accepted' : 'offer_rejected' }
            : app
        )
      );
    } catch (error) {
      console.error('Error processing offer decision:', error);
      toast.error('Failed to process offer decision');
    }
  };

  const filteredApplications = applications
    .filter(app => filter === 'all' ? true : app.rounds[app.currentRound] === filter)
    .sort((a, b) => {
      if (a.rounds[a.currentRound] === 'withdrawn' && b.rounds[b.currentRound] !== 'withdrawn') return 1;
      if (a.rounds[a.currentRound] !== 'withdrawn' && b.rounds[b.currentRound] === 'withdrawn') return -1;
      
      if (sortBy === 'newest') return b.applied_at - a.applied_at;
      if (sortBy === 'oldest') return a.applied_at - b.applied_at;
      if (sortBy === 'company') return a.job.company.localeCompare(b.job.company);
      return 0;
    });

  return (
    <div className="p-6 space-y-6">
      <ToastContainer />
      
      {/* Placement Banner */}
      {isPlaced && (
        <div className="bg-green-100 text-green-800 p-4 rounded-lg mb-6">
          You are placed! You cannot apply to other jobs.
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="all">All Applications</option>
          {Object.keys(STATUS_LABELS).map(status => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <select 
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="company">Company Name</option>
        </select>
      </div>

      {/* Applications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredApplications.map(application => (
          <div 
            key={application.id} 
            className={`relative rounded-lg shadow-sm p-6 transition-all duration-300 
              ${application.rounds[application.currentRound] === 'withdrawn' ? 'bg-red-50 opacity-50' : 'bg-white opacity-100'}`}
          >
            {/* Withdrawn Overlay */}
            {application.rounds[application.currentRound] === 'withdrawn' && (
              <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-lg z-30">
                <span className="text-3xl font-semibold text-red-600">Withdrawn</span>
              </div>
            )}

            {/* Offer Decision Banner */}
            {application.status === 'offer_accepted' && (
              <div className="bg-green-100 text-green-800 p-4 rounded-lg mb-4">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🎉</span>
                  <div>
                    <p className="font-medium">Offer Accepted!</p>
                    <p className="text-sm">You have successfully accepted this offer. Congratulations on your placement!</p>
                  </div>
                </div>
              </div>
            )}
            {application.status === 'offer_rejected' && (
              <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-4">
                <div className="flex items-center">
                  <span className="text-lg mr-2">❌</span>
                  <div>
                    <p className="font-medium">Offer Rejected</p>
                    <p className="text-sm">You have rejected this offer. You may continue applying for other opportunities.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-medium">{application.job.position}</h3>
                <p className="text-gray-600">{application.job.company}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm ${STATUS_COLORS[application.status] || STATUS_COLORS[application.rounds?.[application.currentRound]] || 'bg-gray-100 text-gray-800'}`}>
                {STATUS_LABELS[application.status] || STATUS_LABELS[application.rounds?.[application.currentRound]] || 'Unknown Status'}
              </div>
            </div>

            {/* Offer Decision Panel */}
            {application.status === 'selected' && !application.offerDecision && (
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-blue-800 mb-4">You have been selected for this role. Please confirm your decision.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button 
                    onClick={() => handleOfferDecision(application.id, 'accept')}
                    className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    ✅ Accept Offer
                  </button>
                  <button 
                    onClick={() => handleOfferDecision(application.id, 'reject')}
                    className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    ❌ Reject Offer
                  </button>
                </div>
              </div>
            )}

            {/* Status Progress Bar with Dots */}
            <div className="mb-4 relative h-8">
              <div className="absolute top-1/2 transform -translate-y-1/2 w-full bg-gray-200 rounded-full h-2.5"></div>
              <div
                className="absolute top-1/2 transform -translate-y-1/2 bg-pink-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${getStatusProgress(application.rounds, application.currentRound, application.job.rounds)}%` }}
              ></div>
              <div className="absolute top-1/2 transform -translate-y-1/2 left-0 w-full flex justify-between items-center">
                {getStatusProgressPoints(application.rounds, application.currentRound, application.job.rounds).map((point, index) => (
                  <div
                    key={index}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold z-10
                      ${point.completed ? 'bg-pink-500 text-white' : 'bg-gray-300 text-gray-700'}`}
                    title={point.stageName}
                  >
                    {point.roundLabel}
                  </div>
                ))}
              </div>
            </div>

            {/* Application Details */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Applied on</p>
                <p className="font-medium">
                  {application.applied_at?.toDate().toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Application Deadline</p>
                <p className="font-medium">
                  {new Date(application.job.deadline).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              {application.job.jdFile && (
                <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded">
                  📄 Download JD
                </button>
              )}
              
              {application.rounds[application.currentRound] === 'interview_scheduled' && (
                <button className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded">
                  📅 Add to Calendar
                </button>
              )}

              {['pending', 'under_review'].includes(application.rounds[application.currentRound]) && (
                <button 
                  onClick={() => handleWithdraw(application.id)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded"
                >
                  ❌ Withdraw
                </button>
              )}
            </div>

            {/* Admin Notes */}
            {application.feedback && (
              <div className="mt-4 p-4 bg-blue-50 rounded">
                <p className="text-sm font-medium text-blue-800">Admin Note:</p>
                <p className="text-sm text-blue-700 break-words whitespace-pre-line">
                  {application.feedback}
                </p>
              </div>
            )}
          </div>
        ))}

        {filteredApplications.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg col-span-2">
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <h3 className="mt-4 text-xl font-medium text-gray-700">
              No applications found
            </h3>
            <p className="mt-2 text-gray-500">
              {filter !== 'all' ? 'Try changing your filter settings' : 'You haven\'t applied to any jobs yet'}
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                View All Applications
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="fixed top-0 left-[20%] right-0 bottom-0 bg-gray-200 bg-opacity-10 flex items-center justify-center z-50">
            <Loader />
          </div>
        )}
      </div>
    </div>
  );
};

export default Applications;