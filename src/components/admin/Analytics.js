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
import LoadingSpinner from '../ui/LoadingSpinner';
import useAnalyticsData from './useAnalyticsData';
import AnalyticsCharts from './AnalyticsCharts';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);




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
  const [showEligibleList, setShowEligibleList] = useState(false);
  const [showNotEligibleList, setShowNotEligibleList] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibleStudentsList, setEligibleStudentsList] = useState([]);
  const [notEligibleStudentsList, setNotEligibleStudentsList] = useState([]);

  // Fetch all data first
  const [allStudents, setAllStudents] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [allApplications, setAllApplications] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch all data on component mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setDataLoading(true);
        const [studentsSnapshot, jobsSnapshot, applicationsSnapshot] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'jobs')),
          getDocs(collection(db, 'applications'))
        ]);

        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const jobs = jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const applications = applicationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setAllStudents(students);
        setAllJobs(jobs);
        setAllApplications(applications);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Use the custom hook and pass the filters state and all data
  const {
    summaryData,
    branchData,
    companyData,
    companyKPIs,
    funnelData,
    ctcDistribution,
    eligibilityData,
    loading: analyticsLoading,
    error: analyticsError
  } = useAnalyticsData(filters, allStudents, allJobs, allApplications);

  // Add state for dynamic batch and department options
  const [batchOptions, setBatchOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);

  // Chart options
  const pieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: false },
    },
  }), []);

  // Fetch department and batch options from the database on mount
  useEffect(() => {
    async function fetchOptions() {
      try {
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const students = studentsSnapshot.docs.map(doc => doc.data());
        const departments = Array.from(new Set(students.map(s => s.department).filter(Boolean)));
        const batches = Array.from(new Set(students.map(s => s.batch).filter(Boolean))).sort();
        setDepartmentOptions(departments);
        setBatchOptions(batches);
      } catch (error) {
        setDepartmentOptions([]);
        setBatchOptions([]);
      }
    }
    fetchOptions();
  }, []);

  // Add export functionality
  // Update the handleExport function
  const handleExport = () => {
    console.log('Export clicked, companyKPIs:', companyKPIs);
    console.log('Selected companies:', selectedCompanies);
    console.log('Summary data:', summaryData);
    console.log('Branch data:', branchData);
    
    // Create comprehensive export data from all analytics data
    const exportData = [];
    
    // Add summary data
    if (summaryData) {
      exportData.push({
        Type: 'Summary',
        Metric: 'Total Students',
        Value: summaryData.totalStudents || 0
      });
      exportData.push({
        Type: 'Summary',
        Metric: 'Students Placed',
        Value: summaryData.studentsPlaced || 0
      });
      exportData.push({
        Type: 'Summary',
        Metric: 'Placement Percentage',
        Value: `${summaryData.placementPercentage || 0}%`
      });
      exportData.push({
        Type: 'Summary',
        Metric: 'Average CTC',
        Value: `${summaryData.averageCtc || 0} LPA`
      });
      exportData.push({
        Type: 'Summary',
        Metric: 'Highest CTC',
        Value: `${summaryData.highestCtc || 0} LPA`
      });
      exportData.push({
        Type: 'Summary',
        Metric: 'Total Companies',
        Value: summaryData.totalCompanies || 0
      });
      exportData.push({
        Type: 'Summary',
        Metric: 'Total Applications',
        Value: summaryData.totalApplications || 0
      });
    }
    
    // Add branch data
    if (branchData && branchData.labels) {
      branchData.labels.forEach((branch, index) => {
        const totalStudents = branchData.datasets?.[0]?.data?.[index] || 0;
        const placedStudents = branchData.datasets?.[1]?.data?.[index] || 0;
        exportData.push({
          Type: 'Branch',
          Metric: `${branch} - Total Students`,
          Value: totalStudents
        });
        exportData.push({
          Type: 'Branch',
          Metric: `${branch} - Placed Students`,
          Value: placedStudents
        });
      });
    }
    
    // Add company data
    if (companyData && companyData.labels) {
      companyData.labels.forEach((company, index) => {
        const hires = companyData.datasets?.[0]?.data?.[index] || 0;
        exportData.push({
          Type: 'Company',
          Metric: `${company} - Hires`,
          Value: hires
        });
      });
    }
    
    // Add company KPIs if available
    if (companyKPIs && companyKPIs.length > 0) {
      const dataToExport = selectedCompanies.length > 0
        ? companyKPIs.filter(kpi => selectedCompanies.includes(kpi.company))
        : companyKPIs;
      
      dataToExport.forEach(kpi => {
        exportData.push({
          Type: 'Company KPI',
          Metric: `${kpi.company} - Applied`,
          Value: kpi.applied || 0
        });
        exportData.push({
          Type: 'Company KPI',
          Metric: `${kpi.company} - Selected`,
          Value: kpi.selected || 0
        });
      });
    }

    console.log('Final export data:', exportData);

    if (!exportData || exportData.length === 0) {
      alert('No analytics data available to export. Please wait for data to load.');
      return;
    }

    try {
      const headers = ['Type', 'Metric', 'Value'];
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          [row.Type, row.Metric, row.Value].map(cell => 
            typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
          ).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `analytics_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  // Fix the export button condition
  const hasExportableData = summaryData && (
    summaryData.totalStudents > 0 || 
    summaryData.studentsPlaced > 0 || 
    (branchData && branchData.labels && branchData.labels.length > 0) ||
    (companyData && companyData.labels && companyData.labels.length > 0) ||
    (companyKPIs && companyKPIs.length > 0)
  );

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

  // Add state for placement probability
  const [showPlacementProb, setShowPlacementProb] = useState(false);
  const [placementProbData, setPlacementProbData] = useState([]);
  const [placementProbLoading, setPlacementProbLoading] = useState(false);
  // Reports modal state
  const [showReports, setShowReports] = useState(false);

  // CSV helper and Report generator inside component to access state
  const downloadCSV = (filename, headers, rows) => {
    try {
      const csvContent = [
        headers.join(','),
        ...rows.map(r => headers.map(h => {
          const cell = r[h] ?? '';
          const s = String(cell);
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(','))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('CSV download error:', e);
      alert('Failed to download report.');
    }
  };

  const handleDownloadReport = (reportKey) => {
    const today = new Date().toISOString().split('T')[0];
    const norm = (s) => (s || '').toString().trim().toLowerCase();
    const selectedSet = new Set(allApplications.filter(a => ['selected', 'accepted'].includes(norm(a.status))).map(a => a.student_id || a.studentId));

    const byBranch = (arr) => {
      const map = new Map();
      arr.forEach(s => {
        const b = s.department || s.branch || 'Unknown';
        map.set(b, (map.get(b) || 0) + 1);
      });
      return Array.from(map.entries()).map(([Branch, Count]) => ({ Branch, Count }));
    };
    const byCompanyOffers = () => {
      const map = new Map();
      allApplications.filter(a => ['selected', 'accepted'].includes(norm(a.status))).forEach(a => {
        const job = allJobs.find(j => j.id === (a.job_id || a.jobId));
        const company = a.companyName || a.company || job?.company || 'Unknown';
        const ctc = a.offerCTC || a.package || a.ctc || job?.ctc || job?.salary || '';
        const entry = map.get(company) || { company: company, offers: 0, min: null, max: null };
        entry.offers += 1;
        const parsed = parseFloat(String(ctc).toString().replace(/[^0-9\.]/g, '')) || 0;
        entry.min = entry.min == null ? parsed : Math.min(entry.min, parsed);
        entry.max = entry.max == null ? parsed : Math.max(entry.max, parsed);
        map.set(company, entry);
      });
      return Array.from(map.values()).sort((a,b) => b.offers - a.offers);
    };

    const generators = {
      placement_summary: () => {
        const total = allStudents.length;
        const placed = allStudents.filter(s => selectedSet.has(s.id)).length;
        const avgCTC = (() => {
          let sum = 0, cnt = 0;
          allApplications.filter(a => ['selected', 'accepted'].includes(norm(a.status))).forEach(a => {
            const job = allJobs.find(j => j.id === (a.job_id || a.jobId));
            const ctc = a.offerCTC || a.package || a.ctc || job?.ctc || job?.salary;
            const parsed = parseFloat(String(ctc).toString().replace(/[^0-9\.]/g, ''));
            if (!isNaN(parsed)) { sum += parsed; cnt++; }
          });
          return cnt ? (sum / cnt).toFixed(2) : '0';
        })();
        const branchRows = byBranch(allStudents).map(r => ({ Metric: `Branch: ${r.Branch}`, Value: r.Count }));
        const rows = [
          { Metric: 'Total Students', Value: total },
          { Metric: 'Students Placed', Value: placed },
          { Metric: 'Placement %', Value: total ? ((placed/total)*100).toFixed(2) : '0' },
          { Metric: 'Average Salary (raw units)', Value: avgCTC },
          ...branchRows
        ];
        downloadCSV(`placement_summary_${today}.csv`, ['Metric', 'Value'], rows);
      },
      company_wise_placement: () => {
        const data = byCompanyOffers();
        const rows = data.map(d => ({ 'Company': d.company, 'Offers': d.offers, 'Lowest Package': d.min ?? '', 'Highest Package': d.max ?? '' }));
        downloadCSV(`company_wise_placement_${today}.csv`, ['Company', 'Offers', 'Lowest Package', 'Highest Package'], rows);
      },
      eligibility: () => {
        const rows = [];
        allJobs.forEach(job => {
          const crit = job.eligibility || job.eligibilityCriteria || '';
          const minCgpa = job.minCgpa || job.min_cgpa || 0;
          const noBacklogs = job.noBacklogs || false;
          const eligible = allStudents.filter(s => {
            const cg = parseFloat(s.cgpa || s.CGPA || 0) || 0;
            const bl = parseInt(s.backlogs || s.activeBacklogs || 0) || 0;
            let ok = cg >= minCgpa;
            if (noBacklogs) ok = ok && bl === 0;
            return ok;
          });
          eligible.forEach(s => rows.push({ 'Drive': job.title || job.position || job.company || job.id, 'Eligibility Criteria': crit || `CGPA>=${minCgpa}${noBacklogs?' & No Backlogs':''}`, 'Student': s.name || s.email || s.id }));
        });
        if (!rows.length) return alert('No eligibility data available from jobs.');
        downloadCSV(`eligibility_${today}.csv`, ['Drive', 'Eligibility Criteria', 'Student'], rows);
      },
      offer_status: () => {
        const rows = allApplications.map(a => {
          const student = allStudents.find(s => s.id === (a.student_id || a.studentId));
          const job = allJobs.find(j => j.id === (a.job_id || a.jobId));
          return {
            'Student': student?.name || student?.email || a.student_id || a.studentId,
            'Company': a.companyName || a.company || job?.company || '',
            'Offer Status': a.offerStatus || a.status || '',
            'Joining Date': a.joiningDate || ''
          };
        });
        downloadCSV(`offer_status_${today}.csv`, ['Student', 'Company', 'Offer Status', 'Joining Date'], rows);
      },
      rejected_candidates: () => {
        const rows = allApplications.filter(a => norm(a.status) === 'rejected').map(a => {
          const student = allStudents.find(s => s.id === (a.student_id || a.studentId));
          const job = allJobs.find(j => j.id === (a.job_id || a.jobId));
          return {
            'Drive': job?.title || job?.position || job?.company || (a.companyName || a.company) || '',
            'Student': student?.name || student?.email || a.student_id || a.studentId,
            'Stage Reached': a.stage || a.round || '',
            'Reason': a.rejectionReason || ''
          };
        });
        if (!rows.length) return alert('No rejected candidates found.');
        downloadCSV(`rejected_candidates_${today}.csv`, ['Drive', 'Student', 'Stage Reached', 'Reason'], rows);
      },
      internship: () => {
        const rows = allApplications.filter(a => norm(a.type) === 'internship' || norm(a.offerType) === 'internship' || norm(a.roleType) === 'internship').map(a => {
          const student = allStudents.find(s => s.id === (a.student_id || a.studentId));
          const job = allJobs.find(j => j.id === (a.job_id || a.jobId));
          return {
            'Company': a.companyName || a.company || job?.company || '',
            'Duration': a.duration || job?.duration || '',
            'Stipend': a.stipend || job?.stipend || '',
            'Branch': student?.department || student?.branch || ''
          };
        });
        if (!rows.length) return alert('No internship data found.');
        downloadCSV(`internship_${today}.csv`, ['Company', 'Duration', 'Stipend', 'Branch'], rows);
      },
      unplaced_students: () => {
        const placedIds = selectedSet;
        const rows = allStudents.filter(s => !placedIds.has(s.id)).map(s => ({ 'Student': s.name || s.email || s.id, 'Branch': s.department || s.branch || '', 'Skills': Array.isArray(s.skills) ? s.skills.join('; ') : (s.skills || '') , 'Preferred Roles': Array.isArray(s.preferredRoles) ? s.preferredRoles.join('; ') : (s.preferredRoles || '') }));
        downloadCSV(`unplaced_students_${today}.csv`, ['Student', 'Branch', 'Skills', 'Preferred Roles'], rows);
      },
      yearly_stats: () => {
        const map = new Map(); // year -> { branch -> { total, placed } }
        allStudents.forEach(s => {
          const year = s.batch || s.year || '';
          const branch = s.department || s.branch || 'Unknown';
          const placed = selectedSet.has(s.id) ? 1 : 0;
          if (!map.has(year)) map.set(year, new Map());
          const inner = map.get(year);
          const agg = inner.get(branch) || { total: 0, placed: 0 };
          agg.total += 1; agg.placed += placed;
          inner.set(branch, agg);
        });
        const rows = [];
        for (const [year, branches] of map.entries()) {
          for (const [branch, agg] of branches.entries()) {
            rows.push({ 'Year': year, 'Branch': branch, 'Students Placed': agg.placed, 'Total Students': agg.total });
          }
        }
        downloadCSV(`yearly_placement_statistics_${today}.csv`, ['Year', 'Branch', 'Students Placed', 'Total Students'], rows);
      },
      branch_ratio: () => {
        const rows = [];
        const map = new Map();
        allStudents.forEach(s => {
          const branch = s.department || s.branch || 'Unknown';
          const agg = map.get(branch) || { total: 0, placed: 0 };
          agg.total += 1; agg.placed += selectedSet.has(s.id) ? 1 : 0;
          map.set(branch, agg);
        });
        for (const [branch, agg] of map.entries()) {
          rows.push({ 'Branch': branch, 'Total Students': agg.total, 'Placed Students': agg.placed, '% Placed': agg.total ? ((agg.placed/agg.total)*100).toFixed(2) : '0' });
        }
        downloadCSV(`branch_wise_ratio_${today}.csv`, ['Branch', 'Total Students', 'Placed Students', '% Placed'], rows);
      },
      salary_trend: () => {
        const map = new Map(); // year -> { min, max, avg }
        const entries = allApplications.filter(a => ['selected', 'accepted'].includes(norm(a.status))).map(a => {
          const student = allStudents.find(s => s.id === (a.student_id || a.studentId));
          const year = student?.batch || student?.year || 'Unknown';
          const job = allJobs.find(j => j.id === (a.job_id || a.jobId));
          const ctc = a.offerCTC || a.package || a.ctc || job?.ctc || job?.salary;
          const val = parseFloat(String(ctc).toString().replace(/[^0-9\.]/g, ''));
          return { year, val: isNaN(val) ? 0 : val };
        }).filter(e => e.val > 0);
        entries.forEach(e => {
          const agg = map.get(e.year) || { total: 0, count: 0, min: null, max: null };
          agg.total += e.val; agg.count += 1;
          agg.min = agg.min == null ? e.val : Math.min(agg.min, e.val);
          agg.max = agg.max == null ? e.val : Math.max(agg.max, e.val);
          map.set(e.year, agg);
        });
        const rows = Array.from(map.entries()).map(([year, agg]) => ({ 'Year': year, 'Min CTC': agg.min ?? '', 'Max CTC': agg.max ?? '', 'Average CTC': agg.count ? (agg.total/agg.count).toFixed(2) : '' }));
        if (!rows.length) return alert('No salary data found.');
        downloadCSV(`salary_trend_${today}.csv`, ['Year', 'Min CTC', 'Max CTC', 'Average CTC'], rows);
      },
      alumni_history: () => { alert('Alumni Placement History depends on alumni dataset which is not available.'); },
      category_wise: () => {
        const rows = [];
        allStudents.forEach(s => {
          rows.push({ 'Student': s.name || s.email || s.id, 'Gender': s.gender || '', 'Category': s.category || s.caste || '', 'Placed': selectedSet.has(s.id) ? 'Yes' : 'No' });
        });
        downloadCSV(`category_wise_placement_${today}.csv`, ['Student', 'Gender', 'Category', 'Placed'], rows);
      },
      skill_based: () => {
        const skillMap = new Map();
        const placedIds = selectedSet;
        allStudents.forEach(s => {
          const skills = Array.isArray(s.skills) ? s.skills : (typeof s.skills === 'string' ? s.skills.split(/[;,]/).map(t => t.trim()).filter(Boolean) : []);
          skills.forEach(sk => {
            const agg = skillMap.get(sk) || { skill: sk, placed: 0 };
            agg.placed += placedIds.has(s.id) ? 1 : 0;
            skillMap.set(sk, agg);
          });
        });
        const rows = Array.from(skillMap.values()).sort((a,b) => b.placed - a.placed).map(x => ({ 'Skill': x.skill, 'Students Placed with Skill': x.placed }));
        if (!rows.length) return alert('No skills data found on students.');
        downloadCSV(`skill_based_placement_${today}.csv`, ['Skill', 'Students Placed with Skill'], rows);
      },
      recruiter_retention: () => {
        const map = new Map(); // company -> set of years
        allJobs.forEach(j => {
          const company = j.company || j.companyName || 'Unknown';
          const year = (j.batch || j.year || (j.date ? new Date(j.date).getFullYear() : '')) || 'Unknown';
          const set = map.get(company) || new Set();
          set.add(year);
          map.set(company, set);
        });
        const rows = Array.from(map.entries()).map(([company, years]) => ({ 'Company': company, 'Years Visited': Array.from(years).sort().join(', '), 'Visit Count': years.size }));
        downloadCSV(`recruiter_retention_${today}.csv`, ['Company', 'Years Visited', 'Visit Count'], rows);
      },
      top_domains: () => {
        const map = new Map();
        allJobs.forEach(j => {
          const domain = j.domain || j.industry || ((txt) => {
            const t = txt.toLowerCase();
            if (/(developer|software|it|sde|full\s*stack|frontend|backend)/.test(t)) return 'IT';
            if (/(analytics|data|ml|ai|scientist|analyst)/.test(t)) return 'Analytics';
            if (/(electrical|mechanical|civil|core)/.test(t)) return 'Core Engg';
            return 'Other';
          })(j.position || j.title || '');
          map.set(domain, (map.get(domain) || 0) + 1);
        });
        const rows = Array.from(map.entries()).map(([Domain, Offers]) => ({ Domain, Offers }));
        downloadCSV(`top_hiring_domains_${today}.csv`, ['Domain', 'Offers'], rows);
      },
      offer_conversion: () => {
        const rows = [];
        const companies = Array.from(new Set(allJobs.map(j => j.company || j.companyName).filter(Boolean)));
        companies.forEach(company => {
          const jobs = allJobs.filter(j => (j.company || j.companyName) === company);
          const jobIds = new Set(jobs.map(j => j.id));
          const apps = allApplications.filter(a => jobIds.has(a.job_id || a.jobId));
          const eligible = apps.length > 0 ? new Set(apps.map(a => a.student_id || a.studentId)).size : 0; // proxy
          const appeared = apps.length;
          const placed = apps.filter(a => ['selected', 'accepted'].includes(norm(a.status))).length;
          rows.push({ 'Company/Drive': company, 'Eligible Count (proxy)': eligible, 'Appeared (Applied) Count': appeared, 'Placed Count': placed });
        });
        downloadCSV(`offer_conversion_${today}.csv`, ['Company/Drive', 'Eligible Count (proxy)', 'Appeared (Applied) Count', 'Placed Count'], rows);
      },
      student_tests: () => { alert('Student test performance requires test score fields that are not present.'); },
      prep_effectiveness: () => { alert('Preparation effectiveness requires mock vs placement test metrics.'); },
      drive_clash: () => { alert('Drive clash analysis requires overlapping drive schedules and attendance.'); }
    };

    const fn = generators[reportKey];
    if (!fn) return alert('Unknown report.');
    fn();
    setShowReports(false);
  };

  // Compute placement probability whenever filters change
  useEffect(() => {
    async function fetchPlacementProbData() {
      setPlacementProbLoading(true);
      try {
        // Use already fetched data instead of refetching
        const batch = filters.batch;
        const department = filters.department;
        const filteredStudents = allStudents.filter(student => {
          const batchMatch = !batch || student.batch === batch;
          const departmentMatch = !department || student.department === department;
          return batchMatch && departmentMatch;
        });
        // Calculate probability (rule-based)
        const studentData = filteredStudents.map(student => {
          const apps = allApplications.filter(app => app.student_id === student.id);
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
    if (allStudents.length > 0 && allApplications.length > 0) {
      fetchPlacementProbData();
    }
  }, [filters, allStudents, allApplications]);

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
    <div className="p-6 space-y-6 bg-white dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Analytics Dashboard</h1>
      <div className="flex flex-row gap-4 w-full mb-6 items-start justify-between">
        <div className="flex gap-2">
          <button
            className="flex items-center px-4 py-2 border rounded bg-white dark:bg-gray-800 shadow hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
            onClick={() => setShowFilters(true)}
          >
            <Filter className="mr-2" size={18} />
            Filters
          </button>
          <button
            className="flex items-center px-4 py-2 border rounded bg-white dark:bg-gray-800 shadow hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 border-gray-300 dark:border-gray-600"
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
            className="flex items-center px-4 py-2 border rounded bg-white dark:bg-gray-800 shadow hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
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
          <button
            className="flex items-center px-4 py-2 border rounded bg-blue-600 text-white shadow hover:bg-blue-700"
            onClick={() => setShowReports(true)}
          >
            <Download className="mr-2" size={18} />
            Reports
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
        <div>
          {/* You can move your company-wise analytics table and filtered summary here */}
          {/* Example: */}
          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">🎯 Company-wise Recruitment Status (Filtered)</h3>
              <button
                onClick={handleExport}
                disabled={!hasExportableData}
                className={`flex items-center px-4 py-2 rounded-md transition-colors duration-200 ${
                  hasExportableData
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={hasExportableData ? 'Export analytics data to CSV' : 'No data available to export'}
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
          {funnelData && funnelData.datasets && funnelData.datasets[0] && funnelData.datasets[0].data && funnelData.datasets[0].data.some(d => d > 0) ? (
            <Bar options={funnelChartOptions} data={funnelData} />
          ) : (
            <p className="text-gray-500">No funnel data available.</p>
          )}
        </div>
      </section>
      </section>
          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-row gap-8 mb-8 flex-wrap">
              {/* Pie Chart */}
              <div className="flex-1 w-[250px] h-[250px] p-4 bg-white rounded shadow flex flex-col items-center justify-center">
                <h2 className="text-xl font-semibold mb-2 text-center">Student Placement Eligibility</h2>
                <p className="text-gray-600 mb-4 text-center">Eligible vs Not Eligible students for placements.</p>
                <div className="w-[200px] h-[200px] flex items-center justify-center">
                  {eligibilityLoading ? (
                    <div>Loading chart...</div>
                  ) : eligibilityData && eligibilityData.labels && eligibilityData.datasets ? (
                    <Pie data={eligibilityData} options={pieOptions} />
                  ) : (
                    <div>No data available</div>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex-1 w-[250px] p-4 bg-white rounded shadow flex flex-col items-center justify-center">
                <h2 className="text-xl font-semibold mb-4 text-center">Quick Actions</h2>
                <div className="flex flex-col gap-4 w-full">
                  <button
                    onClick={() => setShowEligibleList(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 w-full"
                  >
                    View Eligible Students ({eligibilityData?.datasets?.[0]?.data?.[0] || 0})
                  </button>
                  <button
                    onClick={() => setShowNotEligibleList(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 w-full"
                  >
                    View Not Eligible Students ({eligibilityData?.datasets?.[0]?.data?.[1] || 0})
                  </button>
                </div>
              </div>
            </div>

            {/* Eligible Students Modal */}
            {showEligibleList && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
                  <h2 className="text-xl font-semibold mb-4">Eligible Students ({eligibleStudentsList.length})</h2>
                  <ul className="space-y-2 mb-4">
                    {eligibleStudentsList.map((student, index) => (
                      <li key={index} className="p-2 border rounded">
                        <strong>{student.name}</strong> - {student.email} ({student.department})
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => setShowEligibleList(false)}>Close</button>
                  </div>
                </div>
              </div>
            )}

            {/* Not Eligible Students Modal */}
            {showNotEligibleList && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
                  <h2 className="text-xl font-semibold mb-4">Not Eligible Students ({notEligibleStudentsList.length})</h2>
                  <ul className="space-y-2 mb-4">
                    {notEligibleStudentsList.map((student, index) => (
                      <li key={index} className="p-2 border rounded">
                        <strong>{student.name}</strong> - {student.email} ({student.department})
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
        </div>
      ) : (
        // Render full analytics dashboard (no filters)
        <AnalyticsCharts
          summaryData={summaryData}
          branchData={branchData}
          companyData={companyData}
          funnelData={funnelData}
          ctcDistribution={ctcDistribution}
          eligibilityData={eligibilityData}
          loading={analyticsLoading}
          onEligibleClick={() => setShowEligibleList(true)}
          onNotEligibleClick={() => setShowNotEligibleList(true)}
        />
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

// Small internal component for report buttons
const ReportButton = ({ label, onClick, disabledReason }) => {
  const disabled = !!disabledReason;
  return (
    <button
      className={`w-full text-left px-3 py-2 rounded border transition ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700'}`}
      onClick={() => !disabled && onClick()}
      title={disabled ? disabledReason : `Download ${label}`}
      disabled={disabled}
    >
      {label}
    </button>
  );
};

export default Analytics;
