import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';
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
  TrendingUp,
  Award,
  BarChart3,
  Target,
  Zap,
  CheckCircle,
  AlertCircle,
  Download,
  Grid,
  List,
  ArrowUpDown,
  ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyStats, setCompanyStats] = useState({});
  const [viewMode, setViewMode] = useState('analytics'); // 'grid' or 'analytics'
  const [sortBy, setSortBy] = useState('placements'); // 'placements', 'package', 'jobs'
  const [sortOrder, setSortOrder] = useState('desc');

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
    isActive: true
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchCompanies(),
        fetchJobs(),
        fetchApplications()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    const companiesRef = collection(db, 'companies');
    const querySnapshot = await getDocs(companiesRef);
    const companiesList = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setCompanies(companiesList);
  };

  const fetchJobs = async () => {
    const jobsRef = collection(db, 'jobs');
    const querySnapshot = await getDocs(jobsRef);
    const jobsList = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setJobs(jobsList);
  };

  const fetchApplications = async () => {
    const applicationsRef = collection(db, 'applications');
    const querySnapshot = await getDocs(applicationsRef);
    const applicationsList = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setApplications(applicationsList);
  };

  // Calculate comprehensive company statistics
  const calculateCompanyStats = () => {
    const stats = {};
    
    companies.forEach(company => {
      const companyJobs = jobs.filter(job => 
        job.company === company.companyName || job.companyName === company.companyName
      );
      
      const companyApplications = applications.filter(app => 
        companyJobs.some(job => job.id === app.jobId)
      );
      
      const placedStudents = companyApplications.filter(app => 
        app.status === 'selected' || app.offerDecision === 'accepted'
      );
      
      // Calculate package statistics
      const packages = companyJobs.map(job => {
        const ctc = parseFloat(job.ctc || job.maxCtc || job.salary || job.maxSalary || 0);
        return ctc;
      }).filter(ctc => ctc > 0);
      
      const highestPackage = packages.length > 0 ? Math.max(...packages) : 0;
      const lowestPackage = packages.length > 0 ? Math.min(...packages) : 0;
      const averagePackage = packages.length > 0 ? 
        packages.reduce((sum, pkg) => sum + pkg, 0) / packages.length : 0;
      
      stats[company.id] = {
        totalJobs: companyJobs.length,
        totalApplications: companyApplications.length,
        placedStudents: placedStudents.length,
        highestPackage: highestPackage,
        lowestPackage: lowestPackage,
        averagePackage: averagePackage,
        conversionRate: companyApplications.length > 0 ? 
          (placedStudents.length / companyApplications.length * 100).toFixed(1) : 0,
        lastJobPosted: companyJobs.length > 0 ? 
          Math.max(...companyJobs.map(job => new Date(job.createdAt?.toDate?.() || job.createdAt).getTime())) : null
      };
    });
    
    setCompanyStats(stats);
  };

  useEffect(() => {
    if (companies.length > 0 && jobs.length > 0 && applications.length > 0) {
      calculateCompanyStats();
    }
  }, [companies, jobs, applications]);

  const handleAddCompany = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'companies'), {
        ...formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      toast.success('Company added successfully!');
      setShowAddForm(false);
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
        isActive: true
      });
      fetchAllData();
    } catch (error) {
      console.error('Error adding company:', error);
      toast.error('Failed to add company');
    }
  };

  const handleDeleteCompany = async (companyId) => {
    if (window.confirm('Are you sure you want to delete this company?')) {
      try {
        await deleteDoc(doc(db, 'companies', companyId));
        toast.success('Company deleted successfully!');
        fetchAllData();
      } catch (error) {
        console.error('Error deleting company:', error);
        toast.error('Failed to delete company');
      }
    }
  };

  const exportCompanyData = () => {
    const exportData = companies.map(company => {
      const stats = companyStats[company.id] || {};
      return {
        'Company Name': company.companyName,
        'Industry': company.industry,
        'Location': company.location,
        'Total Jobs Posted': stats.totalJobs || 0,
        'Total Applications': stats.totalApplications || 0,
        'Students Placed': stats.placedStudents || 0,
        'Highest Package (LPA)': stats.highestPackage || 0,
        'Lowest Package (LPA)': stats.lowestPackage || 0,
        'Average Package (LPA)': stats.averagePackage?.toFixed(2) || 0,
        'Conversion Rate (%)': stats.conversionRate || 0,
        'Website': company.website || '',
        'Employee Count': company.employeeCount || '',
        'Status': company.isActive ? 'Active' : 'Inactive'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Companies');
    XLSX.writeFile(wb, `companies_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Company data exported successfully!');
  };

  const filteredAndSortedCompanies = companies
    .filter(company => {
      const matchesSearch = company.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           company.industry.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesIndustry = !filterIndustry || company.industry === filterIndustry;
      return matchesSearch && matchesIndustry;
    })
    .sort((a, b) => {
      const statsA = companyStats[a.id] || {};
      const statsB = companyStats[b.id] || {};
      
      let valueA, valueB;
      switch (sortBy) {
        case 'placements':
          valueA = statsA.placedStudents || 0;
          valueB = statsB.placedStudents || 0;
          break;
        case 'package':
          valueA = statsA.averagePackage || 0;
          valueB = statsB.averagePackage || 0;
          break;
        case 'jobs':
          valueA = statsA.totalJobs || 0;
          valueB = statsB.totalJobs || 0;
          break;
        default:
          valueA = a.companyName;
          valueB = b.companyName;
      }
      
      if (sortOrder === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });

  const industries = [...new Set(companies.map(c => c.industry).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Company Management</h1>
          <p className="text-gray-600 mt-1">Manage recruitment partners and track placement statistics</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportCompanyData}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Download size={20} />
            Export Data
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            Add Company
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Companies</p>
              <p className="text-3xl font-bold text-gray-900">{companies.length}</p>
            </div>
            <Building className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Placements</p>
              <p className="text-3xl font-bold text-green-600">
                {Object.values(companyStats).reduce((sum, stats) => sum + (stats.placedStudents || 0), 0)}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Package (LPA)</p>
              <p className="text-3xl font-bold text-purple-600">
                {Object.values(companyStats).length > 0 ? 
                  (Object.values(companyStats).reduce((sum, stats) => sum + (stats.averagePackage || 0), 0) / 
                   Object.values(companyStats).filter(stats => stats.averagePackage > 0).length).toFixed(1) : '0'}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Jobs</p>
              <p className="text-3xl font-bold text-orange-600">
                {Object.values(companyStats).reduce((sum, stats) => sum + (stats.totalJobs || 0), 0)}
              </p>
            </div>
            <Briefcase className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <select
              value={filterIndustry}
              onChange={(e) => setFilterIndustry(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Industries</option>
              {industries.map(industry => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-2 items-center">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="placements">Sort by Placements</option>
              <option value="package">Sort by Package</option>
              <option value="jobs">Sort by Jobs Posted</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <ArrowUpDown size={16} />
            </button>
            
            <div className="flex border border-gray-300 rounded-lg">
              <button
                onClick={() => setViewMode('analytics')}
                className={`p-2 ${viewMode === 'analytics' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
              >
                <BarChart3 size={16} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
              >
                <Grid size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Companies Display */}
      {viewMode === 'analytics' ? (
        <div className="space-y-4">
          {filteredAndSortedCompanies.map(company => {
            const stats = companyStats[company.id] || {};
            return (
              <div key={company.id} className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{company.companyName}</h3>
                      <p className="text-sm text-gray-600">{company.industry} • {company.location}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {company.website && (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-600 hover:text-blue-600"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                    <button
                      onClick={() => setEditingCompany(company)}
                      className="p-2 text-gray-600 hover:text-blue-600"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteCompany(company.id)}
                      className="p-2 text-gray-600 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{stats.placedStudents || 0}</p>
                    <p className="text-xs text-gray-600">Students Placed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.totalJobs || 0}</p>
                    <p className="text-xs text-gray-600">Jobs Posted</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">₹{stats.highestPackage?.toFixed(1) || '0'}</p>
                    <p className="text-xs text-gray-600">Highest (LPA)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">₹{stats.lowestPackage?.toFixed(1) || '0'}</p>
                    <p className="text-xs text-gray-600">Lowest (LPA)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-indigo-600">₹{stats.averagePackage?.toFixed(1) || '0'}</p>
                    <p className="text-xs text-gray-600">Average (LPA)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-teal-600">{stats.conversionRate || 0}%</p>
                    <p className="text-xs text-gray-600">Conversion Rate</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedCompanies.map(company => {
            const stats = companyStats[company.id] || {};
            return (
              <div key={company.id} className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setEditingCompany(company)}
                      className="p-2 text-gray-600 hover:text-blue-600"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteCompany(company.id)}
                      className="p-2 text-gray-600 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{company.companyName}</h3>
                <p className="text-sm text-gray-600 mb-4">{company.industry} • {company.location}</p>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Students Placed:</span>
                    <span className="text-sm font-semibold text-green-600">{stats.placedStudents || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Package:</span>
                    <span className="text-sm font-semibold text-purple-600">₹{stats.averagePackage?.toFixed(1) || '0'} LPA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Jobs Posted:</span>
                    <span className="text-sm font-semibold text-blue-600">{stats.totalJobs || 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Company Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add New Company</h2>
            <form onSubmit={handleAddCompany} className="space-y-4">
              <input
                type="text"
                placeholder="Company Name"
                value={formData.companyName}
                onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Industry"
                value={formData.industry}
                onChange={(e) => setFormData({...formData, industry: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Location"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="url"
                placeholder="Website"
                value={formData.website}
                onChange={(e) => setFormData({...formData, website: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Company
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Companies;
