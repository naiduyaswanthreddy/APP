import React, { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";
import { toast } from "react-toastify";
import { useNavigate, Link } from "react-router-dom";
import { 
  User, Edit2, Check, Shield, Target, 
  Briefcase, Calendar, FileText, Award, 
  Book, Code, Clipboard, DollarSign, 
  MessageSquare, Star, Tool, Layers,
  ChevronLeft, ChevronRight, Download, Eye, Upload, Trash2, PlusCircle,
  CreditCard, MessageCircle
} from "lucide-react";

// Charts for Tracker
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const ProfileCareer = () => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("appliedJobs");
  const [userData, setUserData] = useState({
    // Offers
    offers: [],
    
    // Payments
    payments: [],
    
    // Feedbacks
    feedbacks: [],
    
    // Work Experience
    workExperience: [],
    
    // Applied Jobs
    appliedJobs: []
  });

  // Derived tracker state
  const [applicationsRaw, setApplicationsRaw] = useState([]);
  const [jobsMapState, setJobsMapState] = useState({});

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        // Fetch student profile data
        const studentRef = doc(db, "students", user.uid);
        const studentSnap = await getDoc(studentRef);
        
        // Fetch applied jobs data using correct identifiers
        const applicationsRef = collection(db, "applications");
        let rollNumber = null;
        if (studentSnap.exists()) {
          const sdata = studentSnap.data();
          rollNumber = sdata?.rollNumber || sdata?.roll_number || sdata?.student_rollNumber || null;
        }

        // Run queries for both possible identifier fields and merge results
        const appsByUidSnap = await getDocs(query(applicationsRef, where("student_id", "==", user.uid)));
        const appsByRollSnap = rollNumber
          ? await getDocs(query(applicationsRef, where("student_rollNumber", "==", rollNumber)))
          : { forEach: () => {}, empty: true };

        // Build a unique map of applications by doc.id
        const appDocs = new Map();
        appsByUidSnap.forEach(d => appDocs.set(d.id, d));
        appsByRollSnap.forEach(d => appDocs.set(d.id, d));
        
        // Fetch jobs data to get job details
        const jobsRef = collection(db, "jobs");
        const jobsSnap = await getDocs(jobsRef);
        const jobsMap = {};
        jobsSnap.forEach(doc => {
          jobsMap[doc.id] = { id: doc.id, ...doc.data() };
        });
        
        // Process applications with job details
        const appliedJobs = [];
        const rawApps = [];
        const normalizeStatus = (s) => {
          const raw = (s || 'applied').toString().toLowerCase().replace(/\s+/g, '_');
          if (raw === 'pending' || raw === 'applied') return 'applied';
          if (raw.startsWith('shortlist')) return 'shortlisted';
          if (raw.startsWith('interview') || raw.includes('round') || raw.includes('hr') || raw.includes('technical')) return 'selected';
          if (raw.startsWith('offer') || ['hired','placed','offer_accepted'].includes(raw)) return 'offered';
          if (raw.startsWith('reject') || raw.includes('declined') || raw === 'offer_rejected') return 'rejected';
          return raw;
        };

        appDocs.forEach((doc) => {
          const appData = doc.data();
          const normalizedStatus = normalizeStatus(appData.status);
          const jobId = appData.jobId || appData.job_id;
          const updatedAt = appData.updatedAt || appData.updated_at || appData.statusUpdatedAt || appData.appliedAt || appData.appliedDate || appData.applied_at || appData.createdAt;
          rawApps.push({ id: doc.id, ...appData, jobId, status: normalizedStatus, updatedAt });
          const jobData = jobsMap[jobId] || {};
          const jobSnapshot = appData.job || {};
          appliedJobs.push({
            id: doc.id,
            applicationId: doc.id,
            jobId: jobId,
            companyName: jobData.companyName || jobData.company || jobData.company_name || jobSnapshot.company || 'Unknown Company',
            jobTitle: jobData.jobTitle || jobData.position || jobData.title || jobSnapshot.position || 'Unknown Position',
            appliedDate: appData.appliedAt || appData.appliedDate || appData.applied_at || appData.createdAt,
            status: normalizedStatus,
            ctc: jobData.ctc || jobData.salary || jobSnapshot.ctc || jobSnapshot.salary || 'Not specified',
            location: jobData.location || jobData.jobLocation || jobSnapshot.location || jobSnapshot.workMode || 'Not specified',
            jobType: jobData.jobType || jobData.jobTypes || jobSnapshot.jobType || jobSnapshot.jobTypes || 'Full-time'
          });
        });
        
        if (studentSnap.exists()) {
          const data = studentSnap.data();
          
          // Update userData with data from Firestore
          setUserData(prev => ({
            ...prev,
            offers: data.offers || [],
            payments: data.payments || [],
            feedbacks: data.feedbacks || [],
            workExperience: data.workExperience || [],
            appliedJobs: appliedJobs
          }));
          setApplicationsRaw(rawApps);
          setJobsMapState(jobsMap);
        } else {
          setUserData(prev => ({
            ...prev,
            appliedJobs: appliedJobs
          }));
          setApplicationsRaw(rawApps);
          setJobsMapState(jobsMap);
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
        toast.error("Failed to load profile data");
      }
    }
  };

  const handleSaveProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const studentRef = doc(db, "students", user.uid);
        await updateDoc(studentRef, {
          offers: userData.offers,
          payments: userData.payments,
          feedbacks: userData.feedbacks,
          workExperience: userData.workExperience,
          updatedAt: serverTimestamp(),
        });
        toast.success("Career profile updated successfully!");
        setIsEditing(false);
      } catch (error) {
        console.error("Error updating profile:", error);
        toast.error("Failed to update profile. Please try again.");
      }
    } else {
      toast.error("User not authenticated. Please log in.");
    }
  };

  // Add Offer
  const handleAddOffer = () => {
    const newOffer = {
      id: Date.now(),
      companyName: "",
      roleOffered: "",
      ctc: "",
      offerLetterLink: "",
      tpRemarks: ""
    };
    
    setUserData(prevData => ({
      ...prevData,
      offers: [...prevData.offers, newOffer]
    }));
  };

  // Delete Offer
  const handleDeleteOffer = (id) => {
    if (window.confirm("Are you sure you want to delete this offer?")) {
      setUserData(prevData => ({
        ...prevData,
        offers: prevData.offers.filter(offer => offer.id !== id)
      }));
    }
  };

  // Update Offer
  const handleUpdateOffer = (id, field, value) => {
    setUserData(prevData => ({
      ...prevData,
      offers: prevData.offers.map(offer => 
        offer.id === id ? { ...offer, [field]: value } : offer
      )
    }));
  };

  // Add Payment
  const handleAddPayment = () => {
    const newPayment = {
      id: Date.now(),
      type: "",
      amount: "",
      status: "Pending",
      dueDate: "",
      paidDate: "",
      receiptLink: ""
    };
    
    setUserData(prevData => ({
      ...prevData,
      payments: [...prevData.payments, newPayment]
    }));
  };

  // Delete Payment
  const handleDeletePayment = (id) => {
    if (window.confirm("Are you sure you want to delete this payment record?")) {
      setUserData(prevData => ({
        ...prevData,
        payments: prevData.payments.filter(payment => payment.id !== id)
      }));
    }
  };

  // Update Payment
  const handleUpdatePayment = (id, field, value) => {
    setUserData(prevData => ({
      ...prevData,
      payments: prevData.payments.map(payment => 
        payment.id === id ? { ...payment, [field]: value } : payment
      )
    }));
  };

  // Add Work Experience
  const handleAddWorkExperience = () => {
    const newExperience = {
      id: Date.now(),
      company: "",
      role: "",
      type: "Internship",
      startDate: "",
      endDate: "",
      description: "",
      proofLink: ""
    };
    
    setUserData({
      ...userData,
      workExperience: [...userData.workExperience, newExperience]
    });
  };

  // Delete Work Experience
  const handleDeleteWorkExperience = (id) => {
    if (window.confirm("Are you sure you want to delete this work experience?")) {
      setUserData({
        ...userData,
        workExperience: userData.workExperience.filter(exp => exp.id !== id)
      });
    }
  };

  // Update Work Experience
  const handleUpdateWorkExperience = (id, field, value) => {
    setUserData({
      ...userData,
      workExperience: userData.workExperience.map(exp => 
        exp.id === id ? { ...exp, [field]: value } : exp
      )
    });
  };

  // Tabs for the profile page
  const profileTabs = [
    { id: "appliedJobs", label: "Applied Jobs", icon: <FileText size={16} /> },
    { id: "tracker", label: "Tracker", icon: <Target size={16} /> },
    { id: "offers", label: "Offers", icon: <Briefcase size={16} /> },
    { id: "payments", label: "Payments", icon: <CreditCard size={16} /> },
    { id: "feedbacks", label: "Feedbacks", icon: <MessageCircle size={16} /> },
    { id: "workExperience", label: "Work Experience", icon: <Briefcase size={16} /> },
  ];

  // Helpers
  const safeToDate = (d) => {
    try {
      if (!d) return null;
      if (typeof d.toDate === 'function') return d.toDate();
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? null : dt;
    } catch { return null; }
  };

  // Build funnel stats: Applied = total applications; others by current status
  const statusOrder = ["applied", "shortlisted", "selected", "offered", "rejected"];
  const appliedTotal = applicationsRaw.length;
  const shortlistedCount = applicationsRaw.filter(a => (a.status || 'applied') === 'shortlisted').length;
  const selectedCount = applicationsRaw.filter(a => (a.status || 'applied') === 'selected').length;
  const offeredCount = applicationsRaw.filter(a => (a.status || 'applied') === 'offered').length;
  const rejectedCount = applicationsRaw.filter(a => (a.status || 'applied') === 'rejected').length;
  const statusCounts = [appliedTotal, shortlistedCount, selectedCount, offeredCount, rejectedCount];
  const funnelData = {
    labels: ["Applied", "Shortlisted", "Selected", "Offers", "Rejected"],
    datasets: [{
      label: 'Applications',
      data: [statusCounts[0], statusCounts[1], statusCounts[2], statusCounts[3], statusCounts[4]],
      backgroundColor: [
        'rgba(59, 130, 246, 0.6)',
        'rgba(250, 204, 21, 0.6)',
        'rgba(168, 85, 247, 0.6)',
        'rgba(16, 185, 129, 0.6)',
        'rgba(239, 68, 68, 0.6)'
      ],
      borderColor: [
        'rgba(59, 130, 246, 1)',
        'rgba(250, 204, 21, 1)',
        'rgba(168, 85, 247, 1)',
        'rgba(16, 185, 129, 1)',
        'rgba(239, 68, 68, 1)'
      ],
      borderWidth: 1,
      borderRadius: 6,
    }]
  };

  const renderTrackerTab = () => {
    // Build timeline from applicationsRaw joined with jobsMapState
    const timeline = [...applicationsRaw]
      .map(app => {
        const job = jobsMapState[app.jobId] || {};
        const jobSnapshot = app.job || {};
        return {
          id: app.id,
          company: job.companyName || job.company || job.company_name || jobSnapshot.company || 'Unknown Company',
          position: job.jobTitle || job.position || job.title || jobSnapshot.position || 'Unknown Position',
          status: app.status || 'applied',
          date: safeToDate(app.updatedAt || app.appliedAt || app.appliedDate || app.createdAt)
        };
      })
      .filter(item => !!item)
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
      .slice(0, 6);

    const getStatusColor = (status) => ({
      applied: 'bg-blue-500',
      shortlisted: 'bg-yellow-500',
      selected: 'bg-purple-500',
      offered: 'bg-green-500',
      rejected: 'bg-red-500',
    }[status] || 'bg-gray-500');

    const getStatusText = (status) => ({
      applied: 'Applied to',
      shortlisted: 'Shortlisted by',
      selected: 'Selected by',
      offered: 'Offer from',
      rejected: 'Rejected by',
    }[status] || 'Update on');

    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Application Funnel</h3>
            <div className="text-sm text-gray-500">Total: {applicationsRaw.length}</div>
          </div>
          <div className="h-64">
            <Bar 
              data={funnelData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
              }}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <p className="text-sm text-gray-600">Applied</p>
              <p className="text-xl font-bold text-blue-600">{statusCounts[0]}</p>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg text-center">
              <p className="text-sm text-gray-600">Shortlisted</p>
              <p className="text-xl font-bold text-yellow-600">{statusCounts[1]}</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg text-center">
              <p className="text-sm text-gray-600">Selected</p>
              <p className="text-xl font-bold text-purple-600">{statusCounts[2]}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <p className="text-sm text-gray-600">Offers</p>
              <p className="text-xl font-bold text-green-600">{statusCounts[3]}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg text-center">
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-xl font-bold text-red-600">{statusCounts[4]}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Application Timeline</h3>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
            <div className="ml-12 space-y-8">
              {timeline.map((item) => (
                <div key={item.id} className="relative">
                  <div className={`absolute -left-12 mt-1.5 h-4 w-4 rounded-full border border-white ${getStatusColor(item.status)}`}></div>
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="text-md font-semibold">{getStatusText(item.status)} {item.company}</h4>
                    <p className="text-xs text-gray-500">{item.date ? item.date.toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <p className="text-sm text-gray-600">{item.position}</p>
                </div>
              ))}
              {timeline.length === 0 && (
                <p className="text-gray-500 text-center">No recent activity.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render the applied jobs tab content
  const renderAppliedJobsTab = () => {
    const formatDate = (date) => {
      if (!date) return 'Not available';
      try {
        if (date.toDate) {
          return date.toDate().toLocaleDateString();
        }
        return new Date(date).toLocaleDateString();
      } catch (error) {
        return 'Invalid date';
      }
    };

    const getStatusBadge = (status) => {
      const statusColors = {
        'applied': 'bg-blue-100 text-blue-800',
        'shortlisted': 'bg-yellow-100 text-yellow-800',
        'selected': 'bg-purple-100 text-purple-800',
        'offered': 'bg-green-100 text-green-800',
        'rejected': 'bg-red-100 text-red-800',
        'withdrawn': 'bg-gray-100 text-gray-800'
      };
      
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
          {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Applied'}
        </span>
      );
    };

    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">My Job Applications</h3>
            <div className="text-sm text-gray-600">
              Total Applications: {userData.appliedJobs.length}
            </div>
          </div>
          
          {userData.appliedJobs.length > 0 ? (
            <div className="space-y-4">
              {userData.appliedJobs.map((job) => (
                <div key={job.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-lg text-gray-900">{job.companyName}</h4>
                      <p className="text-gray-600">{job.jobTitle}</p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(job.status)}
                      <p className="text-sm text-gray-500 mt-1">Applied: {formatDate(job.appliedDate)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">CTC:</span>
                      <p className="text-sm text-gray-600">{job.ctc}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Location:</span>
                      <p className="text-sm text-gray-600">{job.location}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Job Type:</span>
                      <p className="text-sm text-gray-600">{job.jobType}</p>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => navigate(`/student/job-details/${job.jobId}`)}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    >
                      <Eye size={14} />
                      View Job Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">No job applications found.</p>
              <button
                onClick={() => navigate('/student/job-posts')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Browse Jobs
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render the offers tab content
  const renderOffersTab = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">My Offers</h3>
            {isEditing && (
              <button 
                onClick={handleAddOffer}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
              >
                <PlusCircle size={16} />
                Add Offer
              </button>
            )}
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Edit
              </button>
            ) : (
              <button 
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Save
              </button>
            )}
          </div>
          
          {userData.offers.length > 0 ? (
            <div className="space-y-4">
              {userData.offers.map((offer) => (
                <div key={offer.id} className="border rounded-lg p-4">
                  {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                        <input
                          type="text"
                          value={offer.companyName}
                          onChange={(e) => handleUpdateOffer(offer.id, "companyName", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role Offered</label>
                        <input
                          type="text"
                          value={offer.roleOffered}
                          onChange={(e) => handleUpdateOffer(offer.id, "roleOffered", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CTC / Stipend</label>
                        <input
                          type="text"
                          value={offer.ctc}
                          onChange={(e) => handleUpdateOffer(offer.id, "ctc", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Offer Letter Link</label>
                        <input
                          type="text"
                          value={offer.offerLetterLink}
                          onChange={(e) => handleUpdateOffer(offer.id, "offerLetterLink", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">T&P Remarks</label>
                        <textarea
                          value={offer.tpRemarks}
                          onChange={(e) => handleUpdateOffer(offer.id, "tpRemarks", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                          rows="2"
                        ></textarea>
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <button
                          onClick={() => handleDeleteOffer(offer.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between">
                        <h4 className="font-medium text-lg">{offer.companyName || "Company Name"}</h4>
                        <span className="text-blue-600 font-medium">{offer.ctc || "CTC not specified"}</span>
                      </div>
                      <p className="text-gray-600 mt-1">{offer.roleOffered || "Role not specified"}</p>
                      {offer.offerLetterLink && (
                        <div className="mt-2">
                          <a 
                            href={offer.offerLetterLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-500 flex items-center gap-1 text-sm"
                          >
                            <Eye size={14} />
                            View Offer Letter
                          </a>
                        </div>
                      )}
                      {offer.tpRemarks && (
                        <div className="mt-2 p-2 bg-gray-50 rounded-md">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">T&P Remarks:</span> {offer.tpRemarks}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No offers added yet. {isEditing && "Click 'Add Offer' to get started."}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render the payments tab content
  const renderPaymentsTab = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Payment History</h3>
            {isEditing && (
              <button 
                onClick={handleAddPayment}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
              >
                <PlusCircle size={16} />
                Add Payment
              </button>
            )}
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Edit
              </button>
            ) : (
              <button 
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Save
              </button>
            )}
          </div>
          
          {userData.payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                    {isEditing && <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userData.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={payment.type}
                            onChange={(e) => handleUpdatePayment(payment.id, "type", e.target.value)}
                            className="w-full px-2 py-1 border rounded-md"
                          />
                        ) : (
                          <div className="text-sm font-medium text-gray-900">{payment.type || "Not specified"}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={payment.amount}
                            onChange={(e) => handleUpdatePayment(payment.id, "amount", e.target.value)}
                            className="w-full px-2 py-1 border rounded-md"
                          />
                        ) : (
                          <div className="text-sm text-gray-900">₹{payment.amount || "0"}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <select
                            value={payment.status}
                            onChange={(e) => handleUpdatePayment(payment.id, "status", e.target.value)}
                            className="w-full px-2 py-1 border rounded-md"
                          >
                            <option value="Paid">Paid</option>
                            <option value="Pending">Pending</option>
                            <option value="Overdue">Overdue</option>
                          </select>
                        ) : (
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            payment.status === "Paid" ? "bg-green-100 text-green-800" :
                            payment.status === "Pending" ? "bg-yellow-100 text-yellow-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {payment.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="date"
                            value={payment.dueDate}
                            onChange={(e) => handleUpdatePayment(payment.id, "dueDate", e.target.value)}
                            className="w-full px-2 py-1 border rounded-md"
                          />
                        ) : (
                          <div className="text-sm text-gray-900">{payment.dueDate || "Not specified"}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="date"
                            value={payment.paidDate}
                            onChange={(e) => handleUpdatePayment(payment.id, "paidDate", e.target.value)}
                            className="w-full px-2 py-1 border rounded-md"
                          />
                        ) : (
                          <div className="text-sm text-gray-900">{payment.paidDate || "Not paid yet"}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={payment.receiptLink}
                            onChange={(e) => handleUpdatePayment(payment.id, "receiptLink", e.target.value)}
                            className="w-full px-2 py-1 border rounded-md"
                            placeholder="Receipt URL"
                          />
                        ) : (
                          payment.receiptLink ? (
                            <div className="flex space-x-2">
                              <a 
                                href={payment.receiptLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700"
                              >
                                <Eye size={16} />
                              </a>
                              <a 
                                href={payment.receiptLink} 
                                download
                                className="text-green-500 hover:text-green-700"
                              >
                                <Download size={16} />
                              </a>
                            </div>
                          ) : (
                            <span className="text-gray-400">No receipt</span>
                          )
                        )}
                      </td>
                      {isEditing && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDeletePayment(payment.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No payment records found. {isEditing && "Click 'Add Payment' to add a record."}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render the feedbacks tab content
  const renderFeedbacksTab = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Feedback & Reviews</h3>
          </div>
          
          {userData.feedbacks.length > 0 ? (
            <div className="space-y-4">
              {userData.feedbacks.map((feedback) => (
                <div key={feedback.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{feedback.type || "Feedback"}</h4>
                      <p className="text-sm text-gray-500">From: {feedback.from || "Not specified"} • {feedback.date || "No date"}</p>
                    </div>
                    {feedback.rating > 0 && (
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            size={16} 
                            className={i < feedback.rating ? "text-yellow-400 fill-current" : "text-gray-300"} 
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-gray-700">{feedback.content || "No feedback content provided."}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No feedback records found. Feedback can only be added by mentors, companies, or administrators.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render the work experience tab content
  const renderWorkExperienceTab = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Work Experience</h3>
            {isEditing && (
              <button 
                onClick={handleAddWorkExperience}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
              >
                <PlusCircle size={16} />
                Add Experience
              </button>
            )}
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Edit
              </button>
            ) : (
              <button 
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Save
              </button>
            )}
          </div>
          
          {userData.workExperience.length > 0 ? (
            <div className="space-y-6">
              {userData.workExperience.map((exp) => (
                <div key={exp.id} className="border rounded-lg p-4">
                  {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => handleUpdateWorkExperience(exp.id, "company", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <input
                          type="text"
                          value={exp.role}
                          onChange={(e) => handleUpdateWorkExperience(exp.id, "role", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select
                          value={exp.type}
                          onChange={(e) => handleUpdateWorkExperience(exp.id, "type", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="Internship">Internship</option>
                          <option value="Freelance">Freelance</option>
                          <option value="Part-time">Part-time</option>
                          <option value="Full-time">Full-time</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                          <input
                            type="date"
                            value={exp.startDate}
                            onChange={(e) => handleUpdateWorkExperience(exp.id, "startDate", e.target.value)}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                          <input
                            type="date"
                            value={exp.endDate}
                            onChange={(e) => handleUpdateWorkExperience(exp.id, "endDate", e.target.value)}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={exp.description}
                          onChange={(e) => handleUpdateWorkExperience(exp.id, "description", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                          rows="3"
                        ></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Proof/Reference Letter Link</label>
                        <input
                          type="text"
                          value={exp.proofLink}
                          onChange={(e) => handleUpdateWorkExperience(exp.id, "proofLink", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          onClick={() => handleDeleteWorkExperience(exp.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between">
                        <h4 className="font-medium text-lg">{exp.company || "Company Name"}</h4>
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{exp.type || "Experience"}</span>
                      </div>
                      <p className="text-gray-600 font-medium">{exp.role || "Role not specified"}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {exp.startDate ? new Date(exp.startDate).toLocaleDateString() : "Start date"} - 
                        {exp.endDate ? new Date(exp.endDate).toLocaleDateString() : "Present"}
                      </p>
                      <p className="mt-2 text-gray-700">{exp.description || "No description provided."}</p>
                      {exp.proofLink && (
                        <div className="mt-2">
                          <a 
                            href={exp.proofLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-500 flex items-center gap-1 text-sm"
                          >
                            <Eye size={14} />
                            View Reference Letter
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No work experience added yet. {isEditing && "Click 'Add Experience' to get started."}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4">
      
   
      
      <h2 className="text-2xl font-bold mb-6">Career Profile</h2>
      
      {/* Tab Navigation */}
      <div className="mb-6 flex gap-2 border-b overflow-x-auto">
        {profileTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 flex items-center gap-2 ${activeTab === tab.id
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="mb-8">
        {activeTab === "appliedJobs" && renderAppliedJobsTab()}
        {activeTab === "tracker" && renderTrackerTab()}
        {activeTab === "offers" && renderOffersTab()}
        {activeTab === "payments" && renderPaymentsTab()}
        {activeTab === "feedbacks" && renderFeedbacksTab()}
        {activeTab === "workExperience" && renderWorkExperienceTab()}
      </div>
    </div>
  );
};

export default ProfileCareer;