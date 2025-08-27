import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Briefcase, FileText, CheckCircle, 
  TrendingUp, Building, Clock, Download, Filter, 
  Section, UserCheck
} from 'lucide-react';
import { getDocs, collection } from 'firebase/firestore';
import { logger } from '../../utils/logging';
import { db } from '../../firebase';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import LoadingSpinner from '../ui/LoadingSpinner';
// {{ edit_1 }}
// Import the new custom hook
import useAnalyticsData from './useAnalyticsData';
// {{ end_edit_1 }}


ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  PointElement,
  LineElement
);

const Analytics = () => {
  // Keep state variables related to UI interaction (filters, selected companies)
  const [filters, setFilters] = useState({
    batch: '',
    department: '',
    round: '',
    dateRange: { start: '', end: '' },
    company: '',
    jobRole: '',
    applicationStatus: '',
  });

  const [selectedCompanies, setSelectedCompanies] = useState([]);

  const [showFilters, setShowFilters] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [savedViews, setSavedViews] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('analyticsViews')) || [];
    } catch {
      return [];
    }
  });
  const [viewName, setViewName] = useState('');
  const [showStudentDetails, setShowStudentDetails] = useState(false);
  const [showCompanyDetails, setShowCompanyDetails] = useState(false);

  // {{ edit_2 }}
  // Use the custom hook and pass the filters state
  const {
    summaryData,
    branchData,
    companyData,
    companyKPIs,
    funnelData,
    roundData,
    trendData,
    demographicData,
    ctcDistribution,
  } = useAnalyticsData(filters); // Pass filters here
  // {{ end_edit_2 }}

  // Add state for dynamic batch and department options
  const [batchOptions, setBatchOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);

  // Fetch department options from the database on mount
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const students = studentsSnapshot.docs.map(doc => doc.data());
        const departments = Array.from(new Set(students.map(s => s.department).filter(Boolean)));
        setDepartmentOptions(departments);
      } catch (error) {
        setDepartmentOptions([]);
      }
    }
    fetchDepartments();
  }, []);

  // Add export functionality
  // Update the handleExport function
  const handleExport = () => {
    const dataToExport = selectedCompanies.length > 0
      ? companyKPIs.filter(kpi => selectedCompanies.includes(kpi.company))
      : companyKPIs;

    if (!dataToExport || dataToExport.length === 0) {
      alert('No data available to export');
      return;
    }

    try {
      const headers = [
        'Company',
        'Eligible Students',
        'Applied',
        'Applied %',
        'Not Applied',
        'Not Applied %',
        'Selected',
        'Selected %',
        'Rejected',
        'Rejected %'
      ];

      const csvData = [
        headers.join(','),
        ...dataToExport.map(kpi => [
          kpi.company,
          kpi.eligible,
          kpi.applied,
          `${kpi.appliedPct}%`,
          kpi.notApplied,
          `${kpi.notAppliedPct}%`,
          kpi.selected,
          `${kpi.selectedPct}%`,
          kpi.rejected,
          `${kpi.rejectedPct}%`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `placement_stats_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  // Update the handleFilterChange function
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setSelectedCompanies([]); // Reset selections when filter changes
  };

  // Update the handleCompanySelect function
  const handleCompanySelect = (companyName) => {
    setSelectedCompanies(prev => {
      const isSelected = prev.includes(companyName);
      return isSelected
        ? prev.filter(name => name !== companyName)
        : [...prev, companyName];
    });
  };

  // Handler for date range filter changes
  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [name]: value
      }
    }));
  };

  const filteredCompanyKPIs = selectedCompanies.length > 0
    ? companyKPIs.filter(kpi => selectedCompanies.includes(kpi.company))
    : companyKPIs;

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false, // Titles are handled by h3 tags
        text: '',
      },
    },
    maintainAspectRatio: false, // Allow height to be controlled by parent div
  };

  const demographicBranchChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        display: true,
        text: 'Branch/Department Distribution',
      },
    },
    scales: {
      x: {
        stacked: true,
        title: { display: true, text: 'Department' },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        title: { display: true, text: 'Students' },
      },
    },
  };

  const companyChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        display: true,
        text: 'Top Recruiting Companies',
      },
    },
  };

  const funnelChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        display: true,
        text: 'Application Funnel',
      },
    },
    scales: {
      x: {
        beginAtZero: true,
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  const skillChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        display: true,
        text: 'Top Skills',
      },
    },
    scales: {
      x: {
        stacked: true,
      },
      y: {
        stacked: true,
        beginAtZero: true,
      },
    },
  };

  const [jobRoleOptions, setJobRoleOptions] = useState([]);

  // Fetch job role (position) options from the database on mount
  useEffect(() => {
    async function fetchJobRoles() {
      try {
        const jobsSnapshot = await getDocs(collection(db, 'jobs'));
        const jobs = jobsSnapshot.docs.map(doc => doc.data());
        const positions = Array.from(new Set(jobs.map(j => j.position).filter(Boolean)));
        setJobRoleOptions(positions);
      } catch (error) {
        setJobRoleOptions([]);
      }
    }
    fetchJobRoles();
  }, []);

  const [eligibilityData, setEligibilityData] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);
  const [showEligibleList, setShowEligibleList] = useState(false);
  const [showNotEligibleList, setShowNotEligibleList] = useState(false);
  const [eligibleStudentsList, setEligibleStudentsList] = useState([]);
  const [notEligibleStudentsList, setNotEligibleStudentsList] = useState([]);

  useEffect(() => {
    async function fetchEligibilityData() {
      setEligibilityLoading(true);
      // Fetch students
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Determine eligibility and reason
      const eligibleStudents = [];
      const notEligibleStudents = [];
      students.forEach(s => {
        if (
          s.cgpa >= 6.0 &&
          s.backlogs === 0 &&
          s.attendance >= 75 &&
          s.isFinalYear &&
          !s.disciplinaryAction
        ) {
          eligibleStudents.push(s);
        } else {
          let reason = '';
          if (s.cgpa < 6.0) reason = 'CGPA below 6.0';
          else if (s.backlogs > 0) reason = 'Has active backlogs';
          else if (s.attendance < 75) reason = 'Attendance below 75%';
          else if (!s.isFinalYear) reason = 'Not in final year';
          else if (s.disciplinaryAction) reason = 'Disciplinary action on record';
          else reason = 'No reason provided';
          notEligibleStudents.push({ ...s, notEligibleReason: reason });
        }
      });
      setEligibilityData({
        eligible: eligibleStudents.length,
        notEligible: notEligibleStudents.length,
      });
      setEligibleStudentsList(eligibleStudents);
      setNotEligibleStudentsList(notEligibleStudents);
      setEligibilityLoading(false);
    }
    fetchEligibilityData();
  }, []);

  // Add state for placement probability
  const [showPlacementProb, setShowPlacementProb] = useState(false);
  const [placementProbData, setPlacementProbData] = useState([]);
  const [placementProbLoading, setPlacementProbLoading] = useState(false);

  // Compute placement probability whenever filters change
  useEffect(() => {
    async function fetchPlacementProbData() {
      setPlacementProbLoading(true);
      try {
        // Fetch students and applications
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const applicationsSnapshot = await getDocs(collection(db, 'applications'));
        const applications = applicationsSnapshot.docs.map(doc => doc.data());
        // Apply filters (reuse logic from useAnalyticsData)
        const batch = filters.batch;
        const department = filters.department;
        const filteredStudents = students.filter(student => {
          const batchMatch = !batch || student.batch === batch;
          const departmentMatch = !department || student.department === department;
          return batchMatch && departmentMatch;
        });
        // Calculate probability (rule-based)
        const studentData = filteredStudents.map(student => {
          const apps = applications.filter(app => app.student_id === student.id);
          let probability = 0.2; // base
          if (student.cgpa >= 8.0) probability += 0.3;
          else if (student.cgpa >= 7.0) probability += 0.2;
          else if (student.cgpa >= 6.0) probability += 0.1;
          if (student.backlogs === 0) probability += 0.2;
          if (apps.length > 5) probability += 0.2;
          else if (apps.length > 2) probability += 0.1;
          if (probability > 1) probability = 1;
          return {
            name: student.name || student.email || student.id,
            cgpa: student.cgpa,
            applications: apps.length,
            probability: Math.round(probability * 100),
          };
        });
        setPlacementProbData(studentData);
      } catch (e) {
        setPlacementProbData([]);
      }
      setPlacementProbLoading(false);
    }
    fetchPlacementProbData();
  }, [filters]);

  // Add state for department placement trends and average package analytics
  const [deptPlacementTrends, setDeptPlacementTrends] = useState({ labels: [], datasets: [] });
  const [deptPlacementLoading, setDeptPlacementLoading] = useState(false);
  const [avgPackageData, setAvgPackageData] = useState({ labels: [], datasets: [] });
  const [avgPackageLoading, setAvgPackageLoading] = useState(false);

  // Fetch Department Placement Trends
  useEffect(() => {
    async function fetchDeptPlacementTrends() {
      setDeptPlacementLoading(true);
      try {
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const applicationsSnapshot = await getDocs(collection(db, 'applications'));
        const applications = applicationsSnapshot.docs.map(doc => doc.data());
        // Apply filters
        const batch = filters.batch;
        const department = filters.department;
        const filteredStudents = students.filter(student => {
          const batchMatch = !batch || student.batch === batch;
          const departmentMatch = !department || student.department === department;
          return batchMatch && departmentMatch;
        });
        // Get all batches and departments present in filtered students
        const batches = Array.from(new Set(filteredStudents.map(s => s.batch).filter(Boolean))).sort();
        const departments = Array.from(new Set(filteredStudents.map(s => s.department).filter(Boolean))).sort();
        // For each department and batch, calculate placement ratio
        const datasets = [
          {
            label: 'Total Students',
            data: batches.map(batchVal =>
              departments.map(dept =>
                students.filter(s => s.department === dept && s.batch === batchVal).length
              )
            ),
            backgroundColor: 'rgba(53, 162, 235, 0.5)',
          },
          {
            label: 'Placed Students',
            data: batches.map(batchVal =>
              departments.map(dept => {
                const studentsInDeptBatch = students.filter(s => s.department === dept && s.batch === batchVal);
                const placedIds = new Set(applications.filter(app => app.status && app.status.toLowerCase() === 'selected').map(app => app.student_id || app.studentId));
                return studentsInDeptBatch.filter(s => placedIds.has(s.id)).length;
              })
            ),
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
          }
        ];
        setDeptPlacementTrends({ labels: batches, datasets });
      } catch (e) {
        setDeptPlacementTrends({ labels: [], datasets: [] });
      }
      setDeptPlacementLoading(false);
    }
    fetchDeptPlacementTrends();
  }, [filters]);

  // Fetch Average Package Analytics (by company)
  useEffect(() => {
    async function fetchAvgPackageData() {
      setAvgPackageLoading(true);
      try {
        const normalizeStatus = (s) => (s || '').toString().trim().toLowerCase();
        const parseCTCToLPA = (value) => {
          if (value == null) return 0;
          if (typeof value === 'number') return value >= 100000 ? +(value / 100000).toFixed(2) : +value.toFixed(2);
          let cleaned = String(value).replace(/[\,\s]/g, '').replace(/₹|rs\.?|inr/gi, '').toLowerCase();
          if (/lpa$/.test(cleaned)) {
            const num = parseFloat(cleaned.replace(/lpa$/, ''));
            return isNaN(num) ? 0 : +num.toFixed(2);
          }
          if (/lac|lakh|lakhs/.test(cleaned)) {
            const num = parseFloat(cleaned.replace(/lac|lakh|lakhs/, ''));
            return isNaN(num) ? 0 : +num.toFixed(2);
          }
          const num = parseFloat(cleaned);
          if (isNaN(num)) return 0;
          return num >= 100000 ? +(num / 100000).toFixed(2) : +num.toFixed(2);
        };

        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const applicationsSnapshot = await getDocs(collection(db, 'applications'));
        const applications = applicationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const jobsSnapshot = await getDocs(collection(db, 'jobs'));
        const jobs = jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // filter batches present
        const batch = filters.batch;
        const batches = Array.from(new Set(students.map(s => s.batch).filter(Boolean))).sort();

        // compute per company per batch average
        const jobById = new Map(jobs.map(j => [j.id, j]));
        const perBatchCompany = new Map(); // key: `${batch}::${company}` -> { total, count }
        applications
          .filter(app => ['selected', 'accepted'].includes(normalizeStatus(app.status)))
          .forEach(app => {
            const studentId = app.student_id || app.studentId;
            const student = students.find(s => s.id === studentId);
            const b = student?.batch || '';
            if (batch && b !== batch) return;
            const company = app.companyName || app.company || jobById.get(app.job_id || app.jobId)?.company;
            if (!company || !b) return;
            const job = jobById.get(app.job_id || app.jobId);
            const ctc = parseCTCToLPA(app.offerCTC || app.package || app.ctc || job?.ctc || job?.salary);
            if (ctc <= 0) return;
            const key = `${b}::${company}`;
            const agg = perBatchCompany.get(key) || { total: 0, count: 0 };
            agg.total += ctc;
            agg.count += 1;
            perBatchCompany.set(key, agg);
          });

        const labelBatches = batch ? [batch] : batches;
        // collect companies involved across selected batch scope
        const companiesSet = new Set();
        for (const key of perBatchCompany.keys()) {
          const [, company] = key.split('::');
          companiesSet.add(company);
        }
        const companies = Array.from(companiesSet).sort();

        const datasets = companies.map((company, idx) => ({
          label: company,
          data: labelBatches.map(b => {
            const agg = perBatchCompany.get(`${b}::${company}`);
            return agg ? +(agg.total / agg.count).toFixed(2) : 0;
          }),
          backgroundColor: `rgba(${153 + (idx*37)%102}, ${102 + (idx*53)%153}, ${255 - (idx*29)%155}, 0.5)`
        }));

        setAvgPackageData({ labels: labelBatches, datasets });
      } catch (e) {
        setAvgPackageData({ labels: [], datasets: [] });
      }
      setAvgPackageLoading(false);
    }
    fetchAvgPackageData();
  }, [filters]);

  // useMemo to check for active filters
  const hasActiveFilters = useMemo(() => {
    // Exclude dateRange if both start and end are empty
    const { dateRange, ...rest } = filters;
    const dateActive = dateRange && (dateRange.start || dateRange.end);
    return (
      dateActive ||
      Object.values(rest).some(v => v && v !== '')
    );
  }, [filters]);

  const navigate = useNavigate();
  
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Analytics Dashboard</h1>
      <div className="flex flex-row gap-4 w-full mb-6 items-start justify-between">
        <div className="flex gap-2">
          <button
            className="flex items-center px-4 py-2 border rounded bg-white shadow hover:bg-gray-100"
            onClick={() => setShowFilters(true)}
          >
            <Filter className="mr-2" size={18} />
            Filters
          </button>
          <button
            className="flex items-center px-4 py-2 border rounded bg-white shadow hover:bg-gray-100 text-red-600"
            onClick={() => setFilters({
              batch: '',
              department: '',
              round: '',
              dateRange: { start: '', end: '' },
              company: '',
              jobRole: '',
              applicationStatus: '',
            })}
          >
            Reset Filters
          </button>
          <button
            className="flex items-center px-4 py-2 border rounded bg-white shadow hover:bg-gray-100"
            onClick={() => setShowViews(true)}
          >
            <span className="mr-2">Views</span>
          </button>
          <button
            className="flex items-center px-4 py-2 border rounded bg-green-600 text-white shadow hover:bg-green-700"
            onClick={() => navigate('/admin/placed-students')}
          >
            <UserCheck className="mr-2" size={18} />
            Placed Students
          </button>
        </div>
        {/* Removed student and company statistics cards here */}
      </div>

      {/* Filter Modal/Dropdown */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Blurred background */}
          <div
            className="absolute inset-0 bg-black bg-opacity-30 backdrop-blur-sm"
            onClick={() => setShowFilters(false)}
          />
          {/* Filter content */}
          <div className="relative bg-white rounded shadow-lg p-6 z-10 w-full max-w-md mx-auto">
            <h2 className="text-lg font-semibold mb-4">Filters</h2>
            {/* Existing filter fields go here */}
            <div className="space-y-3">
              {/* Batch Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Batch</label>
                <select
                  name="batch"
                  value={filters.batch}
                  onChange={handleFilterChange}
                  className="border rounded px-2 py-1 w-full"
                >
                  <option value="">All</option>
                  {batchOptions.map(batch => (
                    <option key={batch} value={batch}>{batch}</option>
                  ))}
                </select>
              </div>
              {/* Department Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select
                  name="department"
                  value={filters.department}
                  onChange={handleFilterChange}
                  className="border rounded px-2 py-1 w-full"
                >
                  <option value="">All</option>
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              {/* Company Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Company</label>
                <select
                  name="company"
                  value={filters.company}
                  onChange={handleFilterChange}
                  className="border rounded px-2 py-1 w-full"
                >
                  <option value="">All</option>
                  {companyData.labels && companyData.labels.map((company) => (
                    <option key={company} value={company}>{company}</option>
                  ))}
                </select>
              </div>
              {/* Job Role Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Job Role</label>
                <select
                  name="jobRole"
                  value={filters.jobRole}
                  onChange={handleFilterChange}
                  className="border rounded px-2 py-1 w-full"
                >
                  <option value="">All</option>
                  {jobRoleOptions.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              {/* Application Status Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Application Status</label>
                <select
                  name="applicationStatus"
                  value={filters.applicationStatus}
                  onChange={handleFilterChange}
                  className="border rounded px-2 py-1 w-full"
                >
                  <option value="">All</option>
                  <option value="applied">Applied</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="selected">Selected</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Date Range</label>
                <div className="flex space-x-2">
                  <input
                    type="date"
                    name="start"
                    value={filters.dateRange.start}
                    onChange={handleDateRangeChange}
                    className="border rounded px-2 py-1 w-1/2"
                  />
                  <input
                    type="date"
                    name="end"
                    value={filters.dateRange.end}
                    onChange={handleDateRangeChange}
                    className="border rounded px-2 py-1 w-1/2"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-6">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => setShowFilters(false)}
              >
                Apply Filters
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 ml-2"
                onClick={() => {
                  const name = prompt('Enter a name for this view:');
                  if (name) {
                    const newViews = [...savedViews, { name, filters }];
                    setSavedViews(newViews);
                    localStorage.setItem('analyticsViews', JSON.stringify(newViews));
                  }
                }}
              >
                Save as View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conditionally render analytics sections */}
      {hasActiveFilters ? (
        // Render CompanyAnalyticsTable (filtered analytics)
        <section>
          {/* You can move your company-wise analytics table and filtered summary here */}
          {/* Example: */}
          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">🎯 Company-wise Recruitment Status (Filtered)</h3>
              <button
                onClick={handleExport}
                disabled={!filteredCompanyKPIs || filteredCompanyKPIs.length === 0}
                className={`flex items-center px-4 py-2 rounded-lg ${
                  filteredCompanyKPIs && filteredCompanyKPIs.length > 0
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={filteredCompanyKPIs && filteredCompanyKPIs.length > 0 ? 'Export data to CSV' : 'No data available to export'}
              >
                <Download size={16} className="mr-2" />
                Export Data
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eligible</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Not Applied</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Selected</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rejected</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCompanyKPIs && filteredCompanyKPIs.map(kpi => (
                    <tr key={kpi.company}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input
                          type="checkbox"
                          checked={selectedCompanies.includes(kpi.company)}
                          onChange={() => handleCompanySelect(kpi.company)}
                          className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{kpi.company}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kpi.eligible}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {kpi.applied} ({kpi.appliedPct}%)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {kpi.notApplied} ({kpi.notAppliedPct}%)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {kpi.selected} ({kpi.selectedPct}%)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {kpi.rejected} ({kpi.rejectedPct}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
                  {/* Application Funnel */}
      <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">📊 Application Funnel</h3>
        <div className="h-64">
          {funnelData.datasets[0].data.some(d => d > 0) ? (
            <Bar options={funnelChartOptions} data={funnelData} />
          ) : (
            <p className="text-gray-500">No funnel data available.</p>
          )}
        </div>
      </section>
          </section>
          <section>
          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-row gap-8 mb-8 flex-wrap">
              {/* Pie Chart */}
              <div className="flex-1 w-[250px] h-[250px] p-4 bg-white rounded shadow flex flex-col items-center justify-center">
                <h2 className="text-xl font-semibold mb-2 text-center">Student Placement Eligibility</h2>
                <p className="text-gray-600 mb-4 text-center">Eligible vs Not Eligible students for placements.</p>
                <div className="w-[200px] h-[200px] flex items-center justify-center">
                  {eligibilityLoading ? (
                    <div>Loading chart...</div>
                  ) : eligibilityData ? (
                    <Pie
                      data={{
                        labels: ['Eligible', 'Not Eligible'],
                        datasets: [
                          {
                            data: [
                              eligibilityData.eligible,
                              eligibilityData.notEligible,
                            ],
                            backgroundColor: [
                              'rgba(75, 192, 192, 0.7)',
                              'rgba(255, 99, 132, 0.7)',
                            ],
                          },
                        ],
                      }}
                      options={{
                        responsive: false,
                        plugins: {
                          legend: { position: 'bottom' },
                        },
                        maintainAspectRatio: false,
                        onClick: (evt, elements) => {
                          if (elements && elements.length > 0) {
                            const idx = elements[0].index;
                            if (idx === 0) setShowEligibleList(true);
                            if (idx === 1) setShowNotEligibleList(true);
                          }
                        },
                      }}
                      width={200}
                      height={200}
                    />
                  ) : (
                    <div>No data available.</div>
                  )}
                </div>
              </div>

            </div>
            {/* Modal for eligible students */}
            {showEligibleList && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black bg-opacity-30 backdrop-blur-sm" onClick={() => setShowEligibleList(false)} />
                <div className="relative bg-white rounded shadow-lg p-6 z-10 w-full max-w-md mx-auto max-h-[80vh] overflow-y-auto">
                  <h2 className="text-lg font-semibold mb-4">Eligible Students</h2>
                  <ul className="mb-4">
                    {eligibleStudentsList.length === 0 && <li className="text-gray-500">No eligible students.</li>}
                    {eligibleStudentsList.map((student) => (
                      <li key={student.id} className="mb-2 border-b pb-1">
                        <span className="font-medium">{student.name || student.email || student.id}</span>
                        {student.department && <span className="ml-2 text-xs text-gray-500">({student.department})</span>}
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => setShowEligibleList(false)}>Close</button>
                  </div>
                </div>
              </div>
            )}
            {/* Modal for not eligible students */}
            {showNotEligibleList && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black bg-opacity-30 backdrop-blur-sm" onClick={() => setShowNotEligibleList(false)} />
                <div className="relative bg-white rounded shadow-lg p-6 z-10 w-full max-w-md mx-auto max-h-[80vh] overflow-y-auto">
                  <h2 className="text-lg font-semibold mb-4">Not Eligible Students</h2>
                  <ul className="mb-4">
                    {notEligibleStudentsList.length === 0 && <li className="text-gray-500">No not eligible students.</li>}
                    {notEligibleStudentsList.map((student) => (
                      <li key={student.id} className="mb-2 border-b pb-1">
                        <span className="font-medium">{student.name || student.email || student.id}</span>
                        {student.department && <span className="ml-2 text-xs text-gray-500">({student.department})</span>}
                        <div className="text-xs text-red-500 mt-1">
                          Reason: {student.notEligibleReason || student.reason || 'No reason provided'}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => setShowNotEligibleList(false)}>Close</button>
                  </div>
                </div>
              </div>
            )}
          </section>
          </section>

        </section>
      ) : (
        // Render OverallAnalytics (unfiltered analytics)
        <section>
          {/* You can move your overall summary cards and charts here */}
          {/* Example: */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-700"> Overall Placement Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 📌 Total Jobs Posted */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Jobs Posted</p>
                    <p className="text-2xl font-bold text-gray-800">{summaryData.jobOpenings}</p>
                  </div>
                  <Briefcase className="text-blue-500" size={24} />
                </div>
              </div>

              {/* 👩‍🎓 Total Registered Students */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Registered Students</p>
                    <p className="text-2xl font-bold text-gray-800">{summaryData.registeredStudents}</p>
                  </div>
                  <Users className="text-indigo-500" size={24} />
                </div>
              </div>

              {/* 📝 Total Applications */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Applications</p>
                    <p className="text-2xl font-bold text-gray-800">{summaryData.totalApplications}</p>
                  </div>
                  <FileText className="text-purple-500" size={24} />
                </div>
              </div>

              {/* 🟢 Students Placed */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Students Placed</p>
                    <p className="text-2xl font-bold text-green-600">{summaryData.placedStudents}</p>
                  </div>
                  <CheckCircle className="text-green-500" size={24} />
                </div>
              </div>

              {/* ❌ Not Yet Placed */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Not Yet Placed</p>
                    <p className="text-2xl font-bold text-red-600">{summaryData.notPlacedStudents}</p>
                  </div>
                  <Clock className="text-red-500" size={24} />
                </div>
              </div>

           

              {/* 💰 CTC Statistics */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">CTC Statistics</p>
                    <div className="text-xs text-gray-600 mt-1">
                      <div>Highest: ₹{summaryData.highestCTC}L</div>
                      <div>Average: ₹{summaryData.averageCTC}L</div>
                      <div>Lowest: ₹{summaryData.lowestCTC}L</div>
                      <div>Median: ₹{summaryData.medianCTC}L</div>
                      <div>P90: ₹{summaryData.p90CTC}L</div>
                    </div>
                  </div>
                  <TrendingUp className="text-teal-500" size={24} />
                </div>
              </div>

              {/* 💼 Number of Companies Participated */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Companies Participated</p>
                    <p className="text-2xl font-bold text-blue-600">{summaryData.companiesParticipated}</p>
                  </div>
                  <Building className="text-blue-500" size={24} />
                </div>
              </div>

              {/* 📊 Placement Rate */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Placement Rate</p>
                    <p className="text-2xl font-bold text-teal-600">{summaryData.placementPercentage}%</p>
                  </div>
                  <TrendingUp className="text-teal-500" size={24} />
                </div>
              </div>
            </div>
          </section>

          {/* Company-wise Recruitment Status (overall) */}
          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">🎯 Company-wise Recruitment Status (Overall)</h3>
              <button
                onClick={handleExport}
                disabled={!companyKPIs || companyKPIs.length === 0}
                className={`flex items-center px-4 py-2 rounded-lg ${
                  companyKPIs && companyKPIs.length > 0
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={companyKPIs && companyKPIs.length > 0 ? 'Export data to CSV' : 'No data available to export'}
              >
                <Download size={16} className="mr-2" />
                Export Data
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eligible</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Not Applied</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Selected</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rejected</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {companyKPIs && companyKPIs.map(kpi => (
                    <tr key={kpi.company}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{kpi.company}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kpi.eligible}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kpi.applied} ({kpi.appliedPct}%)</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kpi.notApplied} ({kpi.notAppliedPct}%)</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kpi.selected} ({kpi.selectedPct}%)</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kpi.rejected} ({kpi.rejectedPct}%)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Department Placement Trends & Average Package Analytics Side by Side */}
          <div className="flex flex-col lg:flex-row gap-6 mb-8">
            {/* Department Placement Trends Section (legend: department names) */}
            <div className="bg-white p-6 rounded shadow flex-1 mb-6 lg:mb-0">
              <h2 className="text-xl font-semibold mb-4">Department Placement Trends</h2>
              <p className="text-gray-600 mb-4">Department-wise placement ratios over time (per batch/year).</p>
              {deptPlacementLoading ? (
                <div className="flex items-center justify-center h-72"><LoadingSpinner /></div>
              ) : deptPlacementTrends.labels.length === 0 ? (
                <div>No data available.</div>
              ) : (
                <div className="h-72">
                  {/* Legend: department names */}
                  <Bar
                    options={{
                      responsive: true,
                      plugins: { legend: { position: 'top' }, title: { display: false } },
                      scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Placement %' } } },
                    }}
                    data={{
                      labels: deptPlacementTrends.labels,
                      datasets: deptPlacementTrends.datasets.map((ds, i) => ({
                        ...ds,
                        backgroundColor: `rgba(${53 + i * 30}, ${162 + i * 10}, ${235 - i * 20}, 0.5)`
                      }))
                    }}
                  />
                </div>
              )}
            </div>
            {/* Average Package Analytics Section (legend: company names) */}
            <div className="bg-white p-6 rounded shadow flex-1">
              <h2 className="text-xl font-semibold mb-4">Average Package Analytics</h2>
              <p className="text-gray-600 mb-4">Average package offered by each company per year (batch).</p>
                {avgPackageLoading ? (
                <div className="flex items-center justify-center h-72"><LoadingSpinner /></div>
              ) : avgPackageData.labels.length === 0 ? (
                <div>No data available.</div>
              ) : (
                <div className="h-72">
                  {/* Legend: company names */}
                  <Bar
                    options={{
                      responsive: true,
                        plugins: { legend: { position: 'top', labels: { filter: (item) => true } }, title: { display: false } },
                        scales: {
                          x: { title: { display: true, text: 'Batch' } },
                          y: { beginAtZero: true, title: { display: true, text: 'Average Package (LPA)' } }
                        },
                    }}
                    data={{
                      labels: avgPackageData.labels,
                      datasets: avgPackageData.datasets.map((ds, i) => ({
                        ...ds,
                        label: ds.label, // Ensure label is company name
                        backgroundColor: `rgba(${153 + i * 20}, ${102 + i * 10}, ${255 - i * 15}, 0.5)`
                      }))
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Student Analytics */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Branch/Department Distribution (Applicants vs. Selected) */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">🏢 Branch/Department Distribution (Applicants vs. Selected)</h3>
              <div className="h-64">
                {demographicData.branch.labels.length > 0 ? (
                  <Bar options={demographicBranchChartOptions} data={demographicData.branch} />
                ) : (
                  <p className="text-gray-500">No branch distribution data available.</p>
                )}
              </div>
            </div>

            {/* Top Recruiting Companies Chart */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">💼 Top Recruiting Companies</h3>
              <div className="h-64">
                {companyData.labels.length > 0 ? (
                  <Bar
                    options={{
                      responsive: true,
                      plugins: { legend: { position: 'top' }, title: { display: false } },
                      scales: {
                        x: {
                          stacked: true,
                          title: { display: true, text: 'Company' },
                        },
                        y: {
                          stacked: true,
                          beginAtZero: true,
                          title: { display: true, text: 'Students Recruited' },
                        },
                      },
                    }}
                    data={{
                      labels: companyData.labels,
                      datasets: [{
                        label: 'Students Recruited',
                        data: companyData.datasets[0].data, // Assuming the first dataset is the one we want
                        backgroundColor: 'rgba(54, 162, 235, 0.7)',
                      }],
                    }}
                  />
                ) : (
                  <p className="text-gray-500">No company data available.</p>
                )}
              </div>
            </div>
          </section>

          {/* CTC Distribution */}
          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
            <h3 className="text-lg font-semibold mb-4">💰 CTC Distribution (LPA)</h3>
            <div className="h-64">
              {ctcDistribution.labels.length > 0 ? (
                <Bar
                  options={{
                    responsive: true,
                    plugins: { legend: { position: 'top' }, title: { display: false } },
                    scales: {
                      x: { title: { display: true, text: 'LPA Range' } },
                      y: { beginAtZero: true, title: { display: true, text: 'Students' } },
                    },
                  }}
                  data={ctcDistribution}
                />
              ) : (
                <p className="text-gray-500">No CTC distribution data available.</p>
              )}
            </div>
          </section>
        </section>
      )}

      {/* Views modal/dropdown */}
      {showViews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black bg-opacity-30 backdrop-blur-sm"
            onClick={() => setShowViews(false)}
          />
          <div className="relative bg-white rounded shadow-lg p-6 z-10 w-full max-w-md mx-auto">
            <h2 className="text-lg font-semibold mb-4">Saved Views</h2>
            <ul className="mb-4">
              {savedViews.length === 0 && <li className="text-gray-500">No saved views.</li>}
              {savedViews.map((view, idx) => (
                <li key={idx} className="flex justify-between items-center mb-2">
                  <span>{view.name}</span>
                  <button
                    className="ml-2 px-2 py-1 bg-blue-500 text-white rounded text-xs"
                    onClick={() => {
                      setFilters(view.filters);
                      setShowViews(false);
                    }}
                  >Apply</button>
                  <button
                    className="ml-2 px-2 py-1 bg-red-500 text-white rounded text-xs"
                    onClick={() => {
                      const newViews = savedViews.filter((_, i) => i !== idx);
                      setSavedViews(newViews);
                      localStorage.setItem('analyticsViews', JSON.stringify(newViews));
                    }}
                  >Delete</button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                onClick={() => setShowViews(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Analytics;
