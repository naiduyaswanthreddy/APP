import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, writeBatch, serverTimestamp, deleteDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { getCurrentStudentRollNumber } from '../../utils/studentIdentity';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { createStatusUpdateNotification, createNotification, createSystemAlertNotification } from '../../utils/notificationHelpers';
 import { JobCardsSkeleton, TableSkeleton } from '../ui/SkeletonLoaders';
 
 

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
  const [sortBy, setSortBy] = useState('statusUpdated');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPlaced, setIsPlaced] = useState(false);
  const [showOfferDecision, setShowOfferDecision] = useState({});
  const [offerDecisionLoading, setOfferDecisionLoading] = useState({});
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'rows'
  const [showFilters, setShowFilters] = useState(false); // mobile collapse state
  // Responsive breakpoint (Tailwind md = 768px)
  const [isMdUp, setIsMdUp] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(min-width: 768px)').matches
      : true
  );
  // Stores the selected round label per application id for inline display
  const [selectedRoundLabel, setSelectedRoundLabel] = useState({});
  

  useEffect(() => {
    fetchApplications();
  }, []);

  // Track viewport to control mobile/desktop behavior
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsMdUp(e.matches);
    // Older Safari uses addListener/removeListener
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
    } else if (mq.addListener) {
      mq.addListener(handler);
    }
    setIsMdUp(mq.matches);
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', handler);
      } else if (mq.removeListener) {
        mq.removeListener(handler);
      }
    };
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
      const roll = await getCurrentStudentRollNumber();
      const q1 = roll
        ? query(applicationsRef, where('student_rollNumber', '==', roll))
        : query(applicationsRef, where('student_id', '==', user.uid));
      if (!roll) console.warn('Applications list: rollNumber missing, using uid fallback');
      const querySnapshot = await getDocs(q1);
      
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

          // Determine current round robustly (supports both index and name fields)
          const rounds = Array.isArray(jobData.rounds) ? jobData.rounds : (jobData.hiringWorkflow || []);
          // Prefer stored index; if missing, derive from stored currentRound name
          let currentRoundIndex = typeof jobData.currentRoundIndex === 'number' ? jobData.currentRoundIndex : 0;
          if ((currentRoundIndex == null || Number.isNaN(currentRoundIndex)) && jobData.currentRound) {
            const idxFromName = rounds.findIndex(r => (r.name || r.roundName) === jobData.currentRound);
            currentRoundIndex = idxFromName >= 0 ? idxFromName : 0;
          }
          const currentRound =
            rounds[currentRoundIndex]?.name ||
            rounds[currentRoundIndex]?.roundName ||
            jobData.currentRound || 'N/A';

          // Normalize applied date to a Date object for consistent rendering/sorting
          const appliedAt = applicationData.applied_at?.toDate
            ? applicationData.applied_at.toDate()
            : applicationData.appliedAt?.toDate
            ? applicationData.appliedAt.toDate()
            : (applicationData.applied_at
                ? new Date(applicationData.applied_at)
                : applicationData.appliedAt
                ? new Date(applicationData.appliedAt)
                : null);

          // Derive lastUpdatedAt: prefer statusUpdatedAt, then updatedAt, then appliedAt
          const lastUpdatedAt = applicationData.statusUpdatedAt?.toDate
            ? applicationData.statusUpdatedAt.toDate()
            : applicationData.updatedAt?.toDate
            ? applicationData.updatedAt.toDate()
            : appliedAt;

          applicationsData.push({
            id: docSnapshot.id,
            ...applicationData,
            lastUpdatedAt,
            job: { 
              ...jobData, 
              rounds,
              // Ensure salary data comes from job collection, not application
              ctc: jobData.ctc || '',
              minCtc: jobData.minCtc || '',
              maxCtc: jobData.maxCtc || '',
              salary: jobData.salary || '',
              minSalary: jobData.minSalary || '',
              maxSalary: jobData.maxSalary || '',
              basePay: jobData.basePay || '',
              variablePay: jobData.variablePay || '',
              bonuses: jobData.bonuses || '',
              compensationType: jobData.compensationType || '',
              ctcUnit: jobData.ctcUnit || '',
              salaryUnit: jobData.salaryUnit || ''
            },
            skillMatch: skillMatch,
            currentRound: currentRound,
            rounds: applicationData.student?.rounds || {},
            appliedAt,
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

    // Determine the highest round this student has actually completed (shortlisted/selected)
    let highestCompletedIndex = -1;
    jobRounds.forEach((round, index) => {
      const roundName = round.name || round.roundName || `Round ${index + 1}`;
      const status = rounds?.[roundName];
      if (status === 'shortlisted' || status === 'selected') {
        highestCompletedIndex = index;
      }
    });

    return jobRounds.map((round, index) => {
      const roundName = round.name || round.roundName || `Round ${index + 1}`;
      return {
        completed: index <= highestCompletedIndex,
        stageName: roundName,
        roundLabel: `R${index + 1}`
      };
    });
  };

  const getStatusProgress = (rounds, currentRound, jobRounds) => {
    if (!Array.isArray(jobRounds) || jobRounds.length <= 1) {
      return 0;
    }

    // Progress should reflect the student's own progression, not the job's global round
    // Advance to the furthest evaluated round (shortlisted/selected/rejected/not_shortlisted)
    let highestCompletedIndex = -1; // shortlisted or selected
    let highestEvaluatedIndex = -1; // includes rejected/not_shortlisted
    jobRounds.forEach((round, index) => {
      const roundName = round.name || round.roundName || `Round ${index + 1}`;
      const status = rounds?.[roundName];
      if (status === 'shortlisted' || status === 'selected') {
        highestCompletedIndex = index;
        highestEvaluatedIndex = Math.max(highestEvaluatedIndex, index);
      } else if (status === 'rejected' || status === 'not_shortlisted') {
        highestEvaluatedIndex = Math.max(highestEvaluatedIndex, index);
      }
    });

    const effectiveIndex = Math.max(highestCompletedIndex, highestEvaluatedIndex);
    if (effectiveIndex < 0) {
      return 0;
    }

    const progress = (effectiveIndex / (jobRounds.length - 1)) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  // Decide latest evaluated stage and status based on job's round order
  const DECIDED_STATUSES = new Set([
    'shortlisted', 'selected', 'rejected', 'not_shortlisted',
    'waitlisted', 'interview_scheduled', 'offer_accepted', 'offer_rejected', 'withdrawn'
  ]);

  const getLatestDecidedStage = (rounds, jobRounds) => {
    if (!Array.isArray(jobRounds)) return null;
    let latest = null;
    jobRounds.forEach((round, index) => {
      const roundName = round.name || round.roundName || `Round ${index + 1}`;
      const status = rounds?.[roundName];
      if (DECIDED_STATUSES.has(status)) {
        latest = { roundName, status, index };
      }
    });
    return latest;
  };

  // Check if a given date/timestamp is within the past 24 hours
  const isWithin24Hours = (value) => {
    if (!value) return false;
    let date;
    try {
      if (typeof value?.toDate === 'function') {
        // Firestore Timestamp
        date = value.toDate();
      } else if (typeof value?.seconds === 'number') {
        // Firestore Timestamp-like object
        date = new Date(value.seconds * 1000);
      } else if (value instanceof Date) {
        date = value;
      } else {
        date = new Date(value);
      }
    } catch (_) {
      return false;
    }
    if (!date || isNaN(date.getTime())) return false;
    const diffMs = Date.now() - date.getTime();
    return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000;
  };

  // Determine if withdraw should be visible: hide if any round already shortlisted/selected
  const canWithdraw = (application) => {
    const rounds = application.rounds || {};
    const currStatus = rounds?.[application.currentRound];
    if (application.status === 'withdrawn') return false;

    // Only allow withdraw while strictly at initial state.
    // As soon as application moves to any review/decision stage, disallow.
    const progressedStatuses = new Set([
      'under_review',
      'shortlisted',
      'selected',
      'rejected',
      'not_shortlisted',
      'waitlisted',
      'interview_scheduled',
      'offer_accepted',
      'offer_rejected',
      'placed'
    ]);

    // If any round (including current) shows progressed status OR application.status is progressed, cannot withdraw
    const hasProgressed = Object.values(rounds).some(s => progressedStatuses.has(s)) || progressedStatuses.has(application.status);
    if (hasProgressed) return false;

    // Only when status is strictly 'pending' AND within 24 hours of applying
    const within24h = isWithin24Hours(application.appliedAt);
    if (!within24h) return false;
    return application.status === 'pending' || currStatus === 'pending';
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

      const applicationRef = doc(db, 'applications', applicationId);

      // First mark as withdrawn for audit trails/notifications
      await updateDoc(applicationRef, {
        status: 'withdrawn',
        withdrawnAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Notifications
      try {
        await createStatusUpdateNotification(auth.currentUser.uid, {
          job: { position: application.job?.position || 'Unknown Position' },
          status: 'withdrawn'
        });
      } catch (error) {
        console.error('Error sending withdrawal notification:', error);
      }

      try {
        await createSystemAlertNotification(
          'Application Withdrawn',
          `Student ${auth.currentUser.displayName || 'Unknown'} has withdrawn their application for ${application.job?.position || 'position'} at ${application.job?.company || 'company'}.`,
          `/admin/job-applications/${application.job_id || 'unknown'}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      // Then delete the application document as requested
      try {
        await deleteDoc(applicationRef);
      } catch (error) {
        console.error('Error deleting withdrawn application:', error);
        // Continue; status is already set to withdrawn
      }

      // Update UI: remove from local state
      setApplications(prev => prev.filter(app => app.id !== applicationId));

      toast.success('Application withdrawn and removed successfully');
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
        // Accept offer - update application status to placed
        await updateDoc(applicationRef, {
          status: 'placed',
          offerDecision: 'Accepted',
          decisionDate: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Update student placement status
        await updateDoc(studentRef, {
          placementStatus: 'placed',
          placedCompany: application.job.company,
          placedJobTitle: application.job.position,
          placedPackage: application.job.ctc || application.job.maxCtc || application.job.salary || application.job.maxSalary || '',
          placedLocation: application.job.location,
          placedAt: serverTimestamp(),
          offerDecision: 'Accepted',
          decisionDate: serverTimestamp()
        });

        // Add to placed students collection
        await addDoc(collection(db, 'placed_students'), {
          studentId: auth.currentUser.uid,
          jobId: application.job_id || application.jobId || application.job?.id || null,
          applicationId: applicationId,
          companyName: application.job.company,
          jobTitle: application.job.position,
          package: application.job.ctc || application.job.maxCtc || application.job.salary || application.job.maxSalary || '',
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
    .filter(app => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        app.job?.position?.toLowerCase().includes(q) ||
        app.job?.company?.toLowerCase().includes(q) ||
        app.job?.location?.toLowerCase().includes(q) ||
        app.job?.skills?.join(',').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (a.rounds[a.currentRound] === 'withdrawn' && b.rounds[b.currentRound] !== 'withdrawn') return 1;
      if (a.rounds[a.currentRound] !== 'withdrawn' && b.rounds[b.currentRound] === 'withdrawn') return -1;
      
      const aTime = a.appliedAt?.getTime?.() || 0;
      const bTime = b.appliedAt?.getTime?.() || 0;
      const aUpdated = (a.lastUpdatedAt?.getTime?.()) || aTime;
      const bUpdated = (b.lastUpdatedAt?.getTime?.()) || bTime;
      if (sortBy === 'statusUpdated') return bUpdated - aUpdated;
      if (sortBy === 'newest') return bTime - aTime;
      if (sortBy === 'oldest') return aTime - bTime;
      if (sortBy === 'company') return a.job.company.localeCompare(b.job.company);
      return 0;
    });

  return (
    <div className="px-0 sm:px-0 pt-0">
      <ToastContainer />
      
      

      {/* Search + Filters */}
      <div className="bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border border-gray-200 rounded-xl p-3 md:p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-6">
        {/* Search (always visible) */}
        <div className="relative w-full md:w-96">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e)=>setSearchTerm(e.target.value)}
            placeholder="Search by role, company, location, or skill..."
            aria-label="Search applications"
            className="w-full h-11 pl-10 pr-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        {/* Mobile: Chevron to collapse/expand filters */}
        <div className="flex justify-center mt-0 mb-0 md:hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-0.5 rounded-full border transition ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
            aria-expanded={showFilters}
            aria-label="Toggle filters"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transform transition-transform ${showFilters ? 'rotate-180' : 'rotate-0'}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Collapsible Filters (hidden by default on mobile, always visible on md+) */}
        <div className={`${showFilters ? 'mt-2 flex flex-col gap-3' : 'hidden'} md:flex md:flex-row md:items-center md:gap-4 w-full`}>
          {/* Status Filter */}
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full md:w-56 h-11 px-3 rounded-lg border border-gray-300 bg-white text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Applications</option>
            {Object.keys(STATUS_LABELS).map(status => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full md:w-56 h-11 px-3 rounded-lg border border-gray-300 bg-white text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="company">Company Name</option>
            <option value="statusUpdated">Latest Status Update</option>
          </select>

          {/* View Mode Toggle (hidden on mobile) */}
          <div className="hidden md:inline-flex items-center rounded-lg border border-gray-300 overflow-hidden bg-gray-50 shadow-sm">
            <button
              onClick={() => setViewMode('cards')}
              aria-pressed={viewMode === 'cards'}
              className={`h-11 px-3 text-sm font-medium transition ${
                viewMode === 'cards' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-700 hover:bg-white'
              }`}
              title="Card view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('rows')}
              aria-pressed={viewMode === 'rows'}
              className={`h-11 px-3 text-sm font-medium transition ${
                viewMode === 'rows' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-700 hover:bg-white'
              }`}
              title="Row view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Applications Display */}
      {(() => { const effectiveView = isMdUp ? viewMode : 'cards'; return loading ? (
        effectiveView === 'cards' ? (
          <JobCardsSkeleton count={6} />
        ) : (
          <div className="p-2">
            <TableSkeleton rows={6} columns={5} />
          </div>
        )
      ) : (
      <div className={effectiveView === 'cards' ? "grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6" : "space-y-4"}>
        {filteredApplications.map(application => (
          effectiveView === 'cards' ? (
            // Card View
            <div 
              key={application.id} 
              className={`relative rounded-lg shadow-sm p-6 transition-all duration-300 border-4 border-gray-200
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
                {/* Application Date/Time */}
                <div className="flex items-center mt-2 text-sm text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Applied: {application.appliedAt ? new Intl.DateTimeFormat('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  }).format(application.appliedAt) : 'Date not available'}
                </div>
              </div>


            {/* Latest Decided Status (round name above it) */}
            {(() => {
              const decided = getLatestDecidedStage(application.rounds, application.job.rounds);
              if (decided) {
                return (
                  <div className="mb-3">
                    <div className="text-xs text-gray-600 mb-1">{decided.roundName}</div>
                    <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[decided.status] || 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_LABELS[decided.status] || decided.status}
                    </div>
                  </div>
                );
              }
              // Fallback: show application.status (e.g., pending) if no decided stage yet
              const fallbackStatus = application.status || application.rounds?.[application.currentRound];
              if (!fallbackStatus) return null;
              return (
                <div className="mb-3">
                  {application.currentRound && (
                    <div className="text-xs text-gray-600 mb-1">{application.currentRound}</div>
                  )}
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[fallbackStatus] || 'bg-gray-100 text-gray-800'}`}>
                    {STATUS_LABELS[fallbackStatus] || fallbackStatus}
                  </div>
                </div>
              );
            })()}




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
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold z-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${point.completed ? 'bg-pink-500 text-white' : 'bg-gray-300 text-gray-700'}`}
                    title={point.stageName}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedRoundLabel(prev => ({ ...prev, [application.id]: point.stageName }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedRoundLabel(prev => ({ ...prev, [application.id]: point.stageName })); } }}
                  >
                    {point.roundLabel}
                  </div>
                ))}
              </div>
            </div>

            {selectedRoundLabel?.[application.id] && (
              <div className="-mt-1 mb-3 text-center text-xs text-gray-600">
                {selectedRoundLabel[application.id]}
              </div>
            )}


            {/* Application Details - Removed redundant Applied on section */}

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

          

              {canWithdraw(application) && (
                <button 
                  onClick={() => handleWithdraw(application.id)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded"
                >
                  ❌ Withdraw
                </button>
              )}
              {canWithdraw(application) && (
                <p className="text-[10px] text-gray-500 mt-1">
                  Withdraw available within 24 hours of applying.
                </p>
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
          ) : (
            // Row View
            <div 
              key={application.id} 
              className={`relative rounded-lg shadow-sm p-4 transition-all duration-300 flex items-center gap-4 border border-gray-200
                ${application.rounds[application.currentRound] === 'withdrawn' ? 'bg-red-50 opacity-50' : 'bg-white opacity-100'}`}
            >
              {/* Withdrawn Overlay */}
              {application.rounds[application.currentRound] === 'withdrawn' && (
                <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-lg z-30">
                  <span className="text-2xl font-semibold text-red-600">Withdrawn</span>
                </div>
              )}

              {/* Company Logo Placeholder */}
              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-gray-600 font-semibold text-sm">
                  {application.job.company?.charAt(0) || 'C'}
                </span>
              </div>

              {/* Job Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-medium truncate">{application.job.position}</h3>
                    <p className="text-gray-600 text-sm">{application.job.company}</p>
                  </div>
                  
                  {/* Status Badge */}
                  {(() => {
                    const decided = getLatestDecidedStage(application.rounds, application.job.rounds);
                    if (decided) {
                      return (
                        <div className="text-right">
                          <div className="text-[11px] text-gray-600 mb-0.5">{decided.roundName}</div>
                          <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[decided.status] || 'bg-gray-100 text-gray-800'}`}>
                            {STATUS_LABELS[decided.status] || decided.status}
                          </div>
                        </div>
                      );
                    }
                    const fallbackStatus = application.status || application.rounds?.[application.currentRound];
                    if (!fallbackStatus) return null;
                    return (
                      <div className="text-right">
                        {application.currentRound && (
                          <div className="text-[11px] text-gray-600 mb-0.5">{application.currentRound}</div>
                        )}
                        <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[fallbackStatus] || 'bg-gray-100 text-gray-800'}`}>
                          {STATUS_LABELS[fallbackStatus] || fallbackStatus}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Applied Date */}
                <div className="flex items-center mt-1 text-sm text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Applied: {application.appliedAt ? new Intl.DateTimeFormat('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  }).format(application.appliedAt) : 'Date not available'}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-24 flex-shrink-0">
                <div className="relative h-2 bg-gray-200 rounded-full">
                  <div
                    className="absolute top-0 left-0 bg-pink-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${getStatusProgress(application.rounds, application.currentRound, application.job.rounds)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1 text-center">
                  {getStatusProgress(application.rounds, application.currentRound, application.job.rounds)}%
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-shrink-0">
                {canWithdraw(application) && (
                  <button 
                    onClick={() => handleWithdraw(application.id)}
                    className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                  >
                    Withdraw
                  </button>
                )}
                {canWithdraw(application) && (
                  <span className="text-[10px] text-gray-500 self-center">
                    Within 24 hours of applying
                  </span>
                )}
              </div>
            </div>
          )
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

      </div>
      ) })()}
    </div>
  );
};

export default Applications;