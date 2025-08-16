import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { 
  Building, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Search,
  Filter,
  MapPin,
  Globe,
  Users,
  Calendar,
  Star,
  Briefcase,
  DollarSign,
  ChevronRight,
  Heart,
  Bell,
  TrendingUp,
  Award,
  MessageCircle,
  Linkedin,
  ExternalLink
} from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import NoData from '../ui/NoData';
import RecruitmentOverview from './RecruitmentOverview';
import { createCompanyActionNotification, createSystemAlertNotification } from '../../utils/notificationHelpers';

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [editingCompany, setEditingCompany] = useState(null);

  // Form state for adding/editing companies
  const [formData, setFormData] = useState({
    companyName: '',
    industry: '',
    foundedYear: '',
    location: '',
    website: '',
    linkedin: '',
    description: '',
    employeeCount: '',
    logo: '',
    banner: '',
    highlights: [],
    isActive: true,
    jobPostingsCount: 0,
    totalApplications: 0,
    selectedStudentsCount: 0,
    lastJobPosted: null
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const companiesRef = collection(db, 'companies');
      const querySnapshot = await getDocs(companiesRef);
      
      const companiesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const companiesWithStats = await Promise.all(companiesList.map(async company => {
        const jobsRef = collection(db, 'jobs');
        // Query jobs by company Name, as confirmed from data
        const jobsQuery = query(jobsRef, where('company', '==', company.companyName));
        const jobsSnapshot = await getDocs(jobsQuery);
        const companyJobs = jobsSnapshot.docs.map(doc => doc.data());

        const totalJobsPosted = companyJobs.length;
        let highestCTCOffered = 0;
        let totalCTCs = 0;

        const { parseCTCToLPA } = require('../../utils/ctc');
        companyJobs.forEach(job => {
          const ctcLPA = parseCTCToLPA(job.ctc || job.salary);
          if (ctcLPA > highestCTCOffered) highestCTCOffered = ctcLPA;
          totalCTCs += ctcLPA;
        });

        const averageCTCOffered = totalJobsPosted > 0 ? +(totalCTCs / totalJobsPosted).toFixed(2) : 0;

        return {
          ...company,
          totalJobsPosted,
          highestCTCOffered,
          averageCTCOffered
        };
      }));

      setCompanies(companiesWithStats);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Error loading companies');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompany = async (e, companyData) => {
    e.preventDefault();
    try {
      const newCompany = {
        ...companyData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'active',
        jobPostingsCount: 0,
        lastJobPosted: null
      };
      
      const docRef = await addDoc(collection(db, 'companies'), newCompany);

      // Send admin notification about company addition
      try {
        await createCompanyActionNotification(
          'Company Added',
          `New company "${companyData.companyName}" has been added to the system.`,
          `/admin/companies/${docRef.id}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success('Company added successfully!');
      setShowAddForm(false);
      resetForm();
      fetchCompanies();
    } catch (error) {
      console.error('Error adding company:', error);
      toast.error('Error adding company');
    }
  };

  const handleUpdateCompany = async (e, companyData) => {
    e.preventDefault();
    try {
      const companyRef = doc(db, 'companies', editingCompany.id);
      await updateDoc(companyRef, {
        ...companyData,
        updatedAt: serverTimestamp()
      });

      // Send admin notification about company update
      try {
        await createCompanyActionNotification(
          'Company Updated',
          `Company profile for "${companyData.companyName}" has been updated.`,
          `/admin/companies/${editingCompany.id}`
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }
      
      toast.success('Company updated successfully!');
      setEditingCompany(null);
      resetForm();
      fetchCompanies();
    } catch (error) {
      console.error('Error updating company:', error);
      toast.error('Error updating company');
    }
  };

  const handleDeleteCompany = async (companyId) => {
    if (window.confirm('Are you sure you want to delete this company?')) {
      try {
        await deleteDoc(doc(db, 'companies', companyId));

        // Send admin notification about company deletion
        try {
          await createCompanyActionNotification(
            'Company Deleted',
            `Company has been removed from the system.`,
            '/admin/companies'
          );
        } catch (error) {
          console.error('Error sending admin notification:', error);
        }

        toast.success('Company deleted successfully!');
        fetchCompanies();
      } catch (error) {
        console.error('Error deleting company:', error);
        toast.error('Error deleting company');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      companyName: '',
      industry: '',
      foundedYear: '',
      location: '',
      website: '',
      linkedin: '',
      description: '',
      employeeCount: '',
      logo: '',
      banner: '',
      highlights: [],
      isActive: true
    });
  };

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         company.industry?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIndustry = !filterIndustry || company.industry === filterIndustry;
    return matchesSearch && matchesIndustry;
  });

  const industries = [...new Set(companies.map(c => c.industry).filter(Boolean))];

  // Company Detail View Component
  const CompanyDetailView = ({ company }) => {
    const [companyJobs, setCompanyJobs] = useState([]);
    const [companyApplications, setCompanyApplications] = useState([]);
    const [applicationStats, setApplicationStats] = useState({
      totalApplications: 0,
      selectedStudentsCount: 0,
      pendingApplications: 0,
      rejectedApplications: 0,
      shortlistedApplications: 0
    });
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      fetchCompanyData();
    }, [company]);

    const fetchCompanyData = async () => {
      try {
        setLoading(true);
        
        // Fetch all jobs for this company
        const jobsRef = collection(db, 'jobs');
        const jobsQuery = query(jobsRef, where('company', '==', company.companyName));
        const jobsSnapshot = await getDocs(jobsQuery);
        
        const jobsList = jobsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setCompanyJobs(jobsList);

        // Fetch all applications for this company's jobs
        const jobIds = jobsList.map(job => job.id);
        const applicationsRef = collection(db, 'applications');
        let allApplications = [];

        // Fetch applications for each job
        for (const jobId of jobIds) {
          const applicationsQuery1 = query(applicationsRef, where('jobId', '==', jobId));
          const applicationsQuery2 = query(applicationsRef, where('job_id', '==', jobId));
          
          const [snapshot1, snapshot2] = await Promise.all([
            getDocs(applicationsQuery1),
            getDocs(applicationsQuery2)
          ]);
          
          const applications = [
            ...snapshot1.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            ...snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          ];
          
          // Remove duplicates
          const uniqueApplications = applications.filter((app, index, self) => 
            index === self.findIndex(a => a.id === app.id)
          );
          
          allApplications = [...allApplications, ...uniqueApplications];
        }

        setCompanyApplications(allApplications);

        // Calculate application statistics
        const stats = {
          totalApplications: allApplications.length,
          // Count both 'selected' (pre-offer decision) and 'offer_accepted' as selections
          selectedStudentsCount: allApplications.filter(app => app.status === 'selected' || app.status === 'offer_accepted').length,
          pendingApplications: allApplications.filter(app => !app.status || app.status === 'pending').length,
          rejectedApplications: allApplications.filter(app => app.status === 'rejected' || app.status === 'offer_rejected').length,
          shortlistedApplications: allApplications.filter(app => app.status === 'shortlisted').length
        };
        
        setApplicationStats(stats);

        // Update company document with latest stats
        if (jobsList.length > 0) {
          const companyRef = doc(db, 'companies', company.id);
          await updateDoc(companyRef, {
            jobPostingsCount: jobsList.length,
            totalApplications: stats.totalApplications,
            selectedStudentsCount: stats.selectedStudentsCount,
            lastJobPosted: jobsList.reduce((latest, job) => {
              const jobDate = job.createdAt?.toDate?.() || new Date(job.createdAt);
              return jobDate > latest ? jobDate : latest;
            }, new Date(0)),
            updatedAt: new Date()
          });
        }
        
      } catch (error) {
        console.error('Error fetching company data:', error);
      } finally {
        setLoading(false);
      }
    };

    const tabs = [
      { id: 'overview', label: 'Overview', icon: Building },
      { id: 'jobs', label: 'Jobs', icon: Briefcase },
      { id: 'reviews', label: 'Reviews', icon: Star },
      { id: 'events', label: 'Events', icon: Calendar },
      { id: 'insights', label: 'Insights', icon: TrendingUp }
    ];

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Button */}
          <button
            onClick={() => setSelectedCompany(null)}
            className="mb-4 flex items-center text-blue-600 hover:text-blue-800"
          >
            <ChevronRight size={20} className="rotate-180 mr-1" />
            Back to Companies
          </button>

          {/* Company Header */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="relative">
              {company.banner && (
                <img 
                  src={company.banner} 
                  alt={company.companyName} 
                  className="w-full h-64 object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-4 left-4 flex items-center">
                {company.logo ? (
                  <img 
                    src={company.logo} 
                    alt={company.companyName} 
                    className="h-20 w-20 rounded-full border-4 border-white"
                  />
                ) : (
                  <Building size={80} className="text-white bg-blue-600 rounded-full p-4" />
                )}
                <div className="ml-4 text-white">
                  <h1 className="text-3xl font-bold">{company.companyName}</h1>
                  <p className="text-lg">{company.industry}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Company Details</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Founded:</strong> {company.foundedYear}</p>
                    <p><strong>Location:</strong> {company.location}</p>
                    <p><strong>Employees:</strong> {company.employeeCount}</p>
                    {company.website && (
                      <p>
                        <strong>Website:</strong>{' '}
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {company.website}
                        </a>
                      </p>
                    )}
                    {company.linkedin && (
                      <p>
                        <strong>LinkedIn:</strong>{' '}
                        <a href={company.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          View Profile
                        </a>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">About</h3>
                  <p className="text-sm text-gray-600">{company.description}</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Highlights</h3>
                  <div className="flex flex-wrap gap-2">
                    {company.highlights?.map((highlight, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="border-b">
              <nav className="flex space-x-8 px-6">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon size={16} className="inline mr-2" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <RecruitmentOverview
                  companyId={company.id}
                  companyName={company.companyName}
                  jobs={companyJobs}
                  applications={companyApplications}
                />
              )}

              {activeTab === 'jobs' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Job Listings</h3>
                  {companyJobs.length === 0 ? (
                    <NoData message="No jobs posted by this company" />
                  ) : (
                    <div className="space-y-4">
                      {companyJobs.map(job => (
                        <div key={job.id} className="border rounded-lg p-4">
                          <h4 className="text-lg font-semibold">{job.position}</h4>
                          <p className="text-sm text-gray-600">{job.location} • {job.type}</p>
                          <p className="text-sm text-gray-500">{job.description?.substring(0, 100)}...</p>
                          <p className="text-lg font-bold text-green-600 mt-2">₹{job.ctc?.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Student Reviews</h3>
                  <p className="text-gray-600">Reviews will be displayed here once available.</p>
                </div>
              )}

              {activeTab === 'events' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Upcoming Events</h3>
                  <p className="text-gray-600">Events will be displayed here once scheduled.</p>
                </div>
              )}

              {activeTab === 'insights' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Company Insights</h3>
                  <p className="text-gray-600">Detailed insights and analytics will be available soon.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Add/Edit Form Component
  const CompanyForm = ({ onSubmit, initialData = null }) => {
    const [localFormData, setLocalFormData] = useState(initialData || formData);

    const handleChange = (e) => {
      const { name, value } = e.target;
      setLocalFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      onSubmit(e, localFormData);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
            <h2 className="text-xl font-semibold">
              {initialData ? 'Edit Company' : 'Add New Company'}
            </h2>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setEditingCompany(null); resetForm(); }}
              className="px-3 py-1 rounded-md border hover:bg-gray-50"
            >
              Close
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Company Name</label>
              <input
                type="text"
                name="companyName"
                value={localFormData.companyName}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Industry</label>
              <input
                type="text"
                name="industry"
                value={localFormData.industry}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Founded Year</label>
                <input
                  type="number"
                  name="foundedYear"
                  value={localFormData.foundedYear}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <input
                  type="text"
                  name="location"
                  value={localFormData.location}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Website</label>
              <input
                type="url"
                name="website"
                value={localFormData.website}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">LinkedIn URL</label>
              <input
                type="url"
                name="linkedin"
                value={localFormData.linkedin}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Employee Count</label>
              <input
                type="text"
                name="employeeCount"
                value={localFormData.employeeCount}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                name="description"
                value={localFormData.description}
                onChange={handleChange}
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Logo URL</label>
                <input
                  type="url"
                  name="logo"
                  value={localFormData.logo}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Banner URL</label>
                <input
                  type="url"
                  name="banner"
                  value={localFormData.banner}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingCompany(null);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {editingCompany ? 'Update' : 'Add'} Company
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (selectedCompany) {
    return <CompanyDetailView company={selectedCompany} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus size={20} className="mr-2" />
            Add Company
          </button>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <select
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Industries</option>
                {industries.map(industry => (
                  <option key={industry} value={industry}>{industry}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Companies Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="large" text="Loading companies..." />
          </div>
        ) : filteredCompanies.length === 0 ? (
          <NoData message="No companies found" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map(company => (
              <div key={company.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      {company.logo ? (
                        <img 
                          src={company.logo} 
                          alt={company.companyName} 
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <Building size={48} className="text-gray-400" />
                      )}
                      <div className="ml-3">
                        <h3 className="text-lg font-semibold">{company.companyName}</h3>
                        <p className="text-sm text-gray-600">{company.industry}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedCompany(company)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingCompany(company);
                          setFormData(company);
                        }}
                        className="p-2 text-green-600 hover:bg-green-50 rounded"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteCompany(company.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">{company.description?.substring(0, 100)}...</p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-500">
                      <MapPin size={14} className="mr-2" />
                      {company.location}
                    </div>
                    <div className="flex items-center text-gray-500">
                      <Users size={14} className="mr-2" />
                      {company.employeeCount} employees
                    </div>
                    <div className="flex items-center text-gray-500">
                      <Calendar size={14} className="mr-2" />
                      Founded {company.foundedYear}
                    </div>
                  </div>

                  {/* Display calculated statistics */}
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center text-gray-700">
                      <Briefcase size={14} className="mr-2" />
                      Total Jobs Posted: <span className="font-semibold ml-1">{company.totalJobsPosted || 0}</span>
</div>
                    <div className="flex items-center text-gray-700">
                      <TrendingUp size={14} className="mr-2" />
                      Highest CTC: <span className="font-semibold ml-1">₹{company.highestCTCOffered?.toLocaleString() || 'N/A'}</span>
                    </div>
                     <div className="flex items-center text-gray-700">
 <DollarSign size={14} className="mr-2" />
                      Average CTC: <span className="font-semibold ml-1">₹{company.averageCTCOffered?.toLocaleString() || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={() => setSelectedCompany(company)}
                      className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      View Details
                      <ChevronRight size={16} className="ml-2" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Form */}
        {(showAddForm || editingCompany) && (
          <CompanyForm
            onSubmit={editingCompany ? handleUpdateCompany : handleAddCompany}
            initialData={editingCompany}
          />
        )}
      </div>
    </div>
  );
};

export default Companies;
