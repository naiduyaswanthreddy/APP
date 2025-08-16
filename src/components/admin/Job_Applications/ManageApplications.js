import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, where, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from 'react-router-dom';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import AdminChat from '../AdminChat';
import NoData from '../../ui/NoData';
import Loader from '../../../loading';

// Custom toast component for truncating long messages
const CustomToast = ({ message }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = message.length > 15;

  return (
    <div>
      {shouldTruncate && !isExpanded ? (
        <div>
          {message.substring(0, 15)}
          <button
            onClick={() => setIsExpanded(true)}
            className="ml-2 text-blue-500 underline text-sm"
          >
            Show More
          </button>
        </div>
      ) : (
        message
      )}
    </div>
  );
};

// Custom toast function
const showToast = (message, type = 'success') => {
  toast[type](
    <CustomToast message={message} />,
    { closeButton: true }
  );
};

const ManageApplications = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shareLinks, setShareLinks] = useState({});
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedYear, setSelectedYear] = useState(null);
  const [jobTypes, setJobTypes] = useState(['all']);
  const [eligibleYears, setEligibleYears] = useState([]);

  const currentYear = new Date().getFullYear();
  const defaultYears = Array.from({length: 6}, (_, i) => currentYear - 3 + i);

  // Generate share link
  const generateShareLink = async (jobId, company) => {
    try {
      const shareData = {
        jobId,
        company,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        token: Math.random().toString(36).substring(2) + Date.now().toString(36)
      };
      const shareRef = await addDoc(collection(db, 'companyShares'), shareData);
      const baseUrl = window.location.href.split('/admin')[0];
      const shareLink = `${baseUrl}/company-view/${shareRef.id}`;

      setShareLinks(prev => ({
        ...prev,
        [jobId]: shareLink
      }));
      showToast('Share link generated successfully!');
      return shareLink;
    } catch (error) {
      console.error('Error generating share link:', error);
      showToast('Failed to generate share link', 'error');
    }
  };

  const handleViewApplications = (jobId) => {
    if (jobId) {
      navigate(`/admin/job-applications/${jobId}`);
    } else {
      showToast('Invalid job ID', 'error');
    }
  };

  const handleChatClick = (jobId) => {
    setSelectedJobId(jobId);
    setShowChatModal(true);
  };

const handleDeleteJob = async (jobId) => {
    try {
      if (window.confirm('Are you sure you want to delete this job?')) {
        await deleteDoc(doc(db, 'jobs', jobId));
        showToast('Job deleted successfully');
        fetchJobs();
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      showToast('Failed to delete job', 'error');
    }
  };

// New function to update company statistics when application status changes
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

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const jobsRef = collection(db, 'jobs');
      const jobsSnapshot = await getDocs(jobsRef);
      const jobsData = [];
      const types = new Set(['all']);
      const years = new Set(defaultYears);

      for (const jobDoc of jobsSnapshot.docs) {
        const jobData = jobDoc.data();
        const applicationsRef = collection(db, 'applications');
        // Query for both job_id and jobId fields to ensure we get all applications
        const applicationsQuery1 = query(applicationsRef, where('job_id', '==', jobDoc.id));
        const applicationsQuery2 = query(applicationsRef, where('jobId', '==', jobDoc.id));
        const applicationsSnapshot1 = await getDocs(applicationsQuery1);
        const applicationsSnapshot2 = await getDocs(applicationsQuery2);
        
        // Combine results and remove duplicates
        const allApplications = [...applicationsSnapshot1.docs, ...applicationsSnapshot2.docs];
        const uniqueApplications = allApplications.filter((doc, index, self) => 
          index === self.findIndex(d => d.id === doc.id)
        );

        const applications = [];
        for (const appDoc of uniqueApplications) {
          const appData = appDoc.data();
          const studentId = appData.student_id || appData.studentId;
          let studentData = {};
          if (studentId) {
            try {
              const sDoc = await getDoc(doc(db, 'students', studentId));
              studentData = sDoc.exists() ? sDoc.data() : {};
            } catch (e) {
              console.warn('Failed to fetch student for application', appDoc.id, 'studentId:', studentId, e);
            }
          }

          applications.push({
            id: appDoc.id,
            ...appData,
            student: {
              name: studentData.name || appData.student_name || 'N/A',
              rollNumber: studentData.rollNumber || appData.student_rollNumber || 'N/A',
              department: studentData.department || appData.student_department || 'N/A',
            }
          });
        }

        // Handle Firestore timestamp
        let deadlineDate = null;
        let deadlineFormatted = 'No Deadline';

        if (jobData.deadline) {
          if (jobData.deadline.toDate && typeof jobData.deadline.toDate === 'function') {
            deadlineDate = jobData.deadline.toDate();
            deadlineFormatted = deadlineDate.toLocaleDateString();
          } else if (jobData.deadline instanceof Date) {
            deadlineDate = jobData.deadline;
            deadlineFormatted = deadlineDate.toLocaleDateString();
          } else if (typeof jobData.deadline === 'string') {
            const parsedDate = new Date(jobData.deadline);
            if (!isNaN(parsedDate.getTime())) {
              deadlineDate = parsedDate;
              deadlineFormatted = parsedDate.toLocaleDateString();
            }
          }
        }

        // Add job type to set
        if (jobData.jobTypes) {
          types.add(jobData.jobTypes);
        }

        // Add eligible years to set
        if (jobData.eligibleBatch && Array.isArray(jobData.eligibleBatch)) {
          jobData.eligibleBatch.forEach(year => years.add(Number(year)));
        }

        jobsData.push({
          id: jobDoc.id,
          ...jobData,
          deadlineDate: deadlineDate,
          deadline: deadlineFormatted,
          stats: {
            total: applications.length,
            shortlisted: applications.filter(app => app.status === 'shortlisted').length,
            rejected: applications.filter(app => app.status === 'rejected').length,
            selected: applications.filter(app => app.status === 'selected').length,
            pending: applications.filter(app => ['pending', 'under_review'].includes(app.status)).length
          },
          applications: applications
        });
      }

      setJobs(jobsData);
      setJobTypes([...types]);
      setEligibleYears([...years].sort((a, b) => a - b));
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch jobs data');
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs
    .filter(job => {
      if (searchTerm) {
        const company = String(job.company || '').toLowerCase();
        const position = String(job.position || '').toLowerCase();
        const lowerSearch = searchTerm.toLowerCase();
        return company.includes(lowerSearch) || position.includes(lowerSearch);
      }
      return true;
    })
    .filter(job => {
      if (selectedType !== 'all') {
        return job.jobTypes === selectedType;
      }
      return true;
    })
    .filter(job => {
      if (selectedYear) {
        const batch = Array.isArray(job.eligibleBatch) ? job.eligibleBatch : [];
        return batch.includes(selectedYear);
      }
      return true;
    })
    .sort((a, b) => {
      if (!a.deadlineDate) return 1;
      if (!b.deadlineDate) return -1;
      return a.deadlineDate - b.deadlineDate;
    });

  return (
    <div className="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <ToastContainer />
      {/* Header Section - always shown with total count */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Job Applications Dashboard
            </h1>
            <span className="text-lg text-gray-600">({filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'})</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative w-full max-w-md">
              <input
                type="text"
                placeholder="Search by company or position..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg shadow-sm pl-10
                  hover:border-blue-400 focus:border-blue-500 focus:ring focus:ring-blue-200
                  transition-all duration-200"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            </div>
            <button
              onClick={() => navigate('/admin/jobpost')}
              className="px-4 py-2 bg-blue-600 text-white text-lg font-bold rounded-lg hover:bg-blue-700 transition shadow-md"
            >
              +
            </button>
          </div>
        </div>
      </div>
      {/* Filters Section - always shown, reduced size, no individual counts */}
      <div className="my-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {jobTypes.map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1 rounded-lg text-sm ${selectedType === type ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {type === 'all' ? 'All' : type}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedYear(null)}
            className={`px-3 py-1 rounded-lg text-sm ${selectedYear === null ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            All Years
          </button>
          {eligibleYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-3 py-1 rounded-lg text-sm ${selectedYear === year ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
      {/* Chat Modal */}
      {showChatModal && selectedJobId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[70%] h-[88%] overflow-hidden">
            <div className="p-2 flex justify-between items-center border-b">
              <h2 className="text-lg font-semibold">Chat with Applicants</h2>
              <button
                onClick={() => setShowChatModal(false)}
                className="p-1 rounded hover:bg-gray-200"
              >
                ✕
              </button>
            </div>
            <AdminChat
              jobId={selectedJobId}
              onClose={() => setShowChatModal(false)}
            />
          </div>
        </div>
      )}
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed top-0 left-[20%] right-0 bottom-0 bg-gray-200 bg-opacity-10 flex items-center justify-center z-50">
          <Loader />
        </div>
      )}
      {/* Table Section or NoData */}
      {!loading && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            {filteredJobs.length === 0 ? (
              <NoData text="No jobs found." />
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="bg-teal-100">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Position</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600 uppercase tracking-wider">Applications Overview</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Deadline</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredJobs.map(job => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-lg font-semibold text-gray-900">{job.company}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600">{job.position}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-4">
                          <div className="text-center">
                            <div className="text-lg font-semibold">{job.stats.total}</div>
                            <div className="text-sm text-gray-500">Total</div>
                          </div>
                          {/* <div className="text-center">
                            <div className="text-lg font-semibold text-green-600">{job.stats.shortlisted}</div>
                            <div className="text-sm text-gray-500">Shortlisted</div>
                          </div> */}
                          {/* <div className="text-center">
                            <div className="text-lg font-semibold text-red-600">{job.stats.rejected}</div>
                            <div className="text-sm text-gray-500">Rejected</div>
                          </div> */}
                          <div className="text-center">
                            <div className="text-lg font-semibold text-yellow-600">{job.stats.selected}</div>
                            <div className="text-sm text-gray-500">Selected</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {job.deadline}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleViewApplications(job.id)}
                            className="px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                          >
                            👁 View
                          </button>
                          <button
                            onClick={() => handleChatClick(job.id)}
                            className="px-3 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100"
                          >
                            💬 Chat
                          </button>
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            className="px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                          >
                            🗑 Delete
                          </button>
                        </div>
                        {shareLinks[job.id] && (
                          <div className="absolute mt-2 p-2 bg-white rounded shadow-lg border border-gray-200">
                            <input
                              type="text"
                              value={shareLinks[job.id]}
                              readOnly
                              className="w-full p-1 border rounded text-sm"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(shareLinks[job.id]);
                                toast.success('Link copied!');
                              }}
                              className="mt-1 w-full px-2 py-1 bg-blue-50 text-blue-600 rounded text-sm hover:bg-blue-100"
                            >
                              Copy Link
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageApplications;