import { useState, useEffect } from 'react';
import { parseCTCToLPA, summarizeCTCs } from '../../utils/ctc';

// Debounce filters to prevent excessive re-renders

const useAnalyticsData = (filters, allStudents, allJobs, allApplications) => {
  const [analyticsData, setAnalyticsData] = useState({
    summaryData: {
      totalStudents: 0,
      totalCompanies: 0,
      totalApplications: 0,
      studentsPlaced: 0,
      placementPercentage: 0,
      averageCtc: 0,
      highestCtc: 0,
      medianCtc: 0,
    },
    branchData: { labels: [], datasets: [] },
    companyData: { labels: [], datasets: [] },
    companyKPIs: [],
    funnelData: { labels: [], datasets: [] },
    ctcDistribution: { labels: [], datasets: [] },
    eligibilityData: { eligible: 0, notEligible: 0, eligibleStudentsList: [], notEligibleStudentsList: [] },
    placementProbData: [],
    deptPlacementTrends: { labels: [], datasets: [] },
    avgPackageData: { labels: [], datasets: [] },
    loading: true,
    error: null,
  });


  const normalizeStatus = (status) => (status ? status.toString().trim().toLowerCase() : 'pending');
  const toNumber = (val, def = 0) => {
    if (val === undefined || val === null || val === '') return def;
    if (typeof val === 'number' && !Number.isNaN(val)) return val;
    const match = String(val).match(/-?\d*\.?\d+/);
    return match ? parseFloat(match[0]) : def;
  };
  const toBoolean = (val, def = false) => {
    if (typeof val === 'boolean') return val;
    if (val === undefined || val === null || val === '') return def;
    const s = String(val).trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(s)) return true;
    if (['false', 'no', 'n', '0'].includes(s)) return false;
    return def;
  };
  const safeTimestamp = (timestamp) => {
    if (!timestamp) return new Date();
    return timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  };

  const fetchAnalyticsData = async () => {
    setAnalyticsData(prev => ({ ...prev, loading: true }));
    setAnalyticsData(prev => ({ ...prev, error: null }));

    try {
      // Filter data based on passed filters
      const students = allStudents.filter(student => {
        const batchMatch = !filters.batch || student.batch === filters.batch;
        const departmentMatch = !filters.department || student.department === filters.department;
        return batchMatch && departmentMatch;
      });

      const studentIds = new Set(students.map(s => s.id));

      const applications = allApplications.filter(app => {
        const studentMatch = studentIds.has(app.student_id);
        const statusMatch = !filters.applicationStatus || (app.status && app.status.toLowerCase() === filters.applicationStatus.toLowerCase());
        const companyMatch = !filters.company || (app.companyName && app.companyName.toLowerCase().includes(filters.company.toLowerCase()));
        const date = app.appliedDate?.toDate() || new Date(0);
        const dateMatch = (!filters.dateRange?.start || date >= new Date(filters.dateRange.start)) && 
                          (!filters.dateRange?.end || date <= new Date(filters.dateRange.end));
        return studentMatch && statusMatch && companyMatch && dateMatch;
      });

      const jobIds = new Set(applications.map(a => a.job_id));
      const jobs = allJobs.filter(job => {
        const idMatch = jobIds.has(job.id);
        const roleMatch = !filters.jobRole || (job.position && job.position.toLowerCase().includes(filters.jobRole.toLowerCase()));
        const companyMatch = !filters.company || (job.company && job.company.toLowerCase().includes(filters.company.toLowerCase()));
        return idMatch || (roleMatch && companyMatch);
      });

      // --- Data Processing and Aggregation ---
      // Get placed students from multiple sources
      const placedStudentIds = new Set();
      
      // From applications with selected/placed/hired status
      applications.filter(app => {
        const status = normalizeStatus(app.status);
        return status === 'selected' || status === 'placed' || status === 'hired';
      }).forEach(app => {
        const studentId = app.student_id || app.studentId;
        if (studentId) placedStudentIds.add(studentId);
      });
      
      // From students collection with placementStatus = 'placed'
      students.filter(student => student.placementStatus === 'placed').forEach(student => {
        placedStudentIds.add(student.id);
      });

      const placedStudents = students.filter(student => placedStudentIds.has(student.id) || student.placementStatus === 'placed');

      // Eligibility Calculation
      const eligibleStudents = [];
      const notEligibleStudents = [];
      allStudents.forEach(s => {
        const cgpa = toNumber(s.cgpa, 0);
        const backlogs = toNumber(s.backlogs ?? s.activeBacklogs ?? s.backlogCount, 0);
        const attendance = toNumber(s.attendance, 0); // handles '80%'
        const isFinalYear = toBoolean(s.isFinalYear ?? s.finalYear ?? s.is_final_year, false);
        const hasDisciplinary = toBoolean(s.disciplinaryAction ?? s.hasDisciplinaryAction, false);

        const isEligible = cgpa >= 6.0 && backlogs === 0 && attendance >= 75 && isFinalYear && !hasDisciplinary;

        if (isEligible) {
          eligibleStudents.push({ ...s, cgpa, backlogs, attendance, isFinalYear, disciplinaryAction: hasDisciplinary });
        } else {
          let reason = '';
          if (cgpa < 6.0) reason = 'CGPA below 6.0';
          else if (backlogs > 0) reason = 'Has active backlogs';
          else if (attendance < 75) reason = 'Attendance below 75%';
          else if (!isFinalYear) reason = 'Not in final year';
          else if (hasDisciplinary) reason = 'Disciplinary action on record';
          notEligibleStudents.push({ ...s, cgpa, backlogs, attendance, isFinalYear, disciplinaryAction: hasDisciplinary, notEligibleReason: reason });
        }
      });
      
      // Create proper chart data structure for eligibility
      const eligibilityData = {
        labels: ['Eligible', 'Not Eligible'],
        datasets: [{
          data: [eligibleStudents.length, notEligibleStudents.length],
          backgroundColor: ['#4BC0C0', '#FF6384'],
          borderWidth: 1
        }],
        eligible: eligibleStudents.length,
        notEligible: notEligibleStudents.length,
        eligibleStudentsList: eligibleStudents,
        notEligibleStudentsList: notEligibleStudents
      };

      // CTC Calculations - get from multiple sources
      const ctcValues = [];
      
      // From applications with selected/placed/hired status
      applications
        .filter(app => {
          const status = normalizeStatus(app.status);
          return status === 'selected' || status === 'placed' || status === 'hired';
        })
        .forEach(app => {
          const job = jobs.find(j => j.id === (app.job_id || app.jobId));
          const fromApp = parseCTCToLPA(app.offerCTC || app.package || app.ctc || app.salary);
          const fromJob = job ? parseCTCToLPA(job.ctc || job.maxCtc || job.salary) : 0;
          const ctc = fromApp || fromJob;
          if (ctc > 0) ctcValues.push(ctc);
        });
      
      // From students collection with placementStatus = 'placed'
      students
        .filter(student => student.placementStatus === 'placed')
        .forEach(student => {
          const ctc = parseCTCToLPA(student.placedPackage || student.package || student.ctc || student.salary);
          if (ctc > 0) ctcValues.push(ctc);
        });

      const { p50, p90, avg, max } = summarizeCTCs(ctcValues);

      // Summary Data
      const summary = {
        totalStudents: students.length,
        totalCompanies: new Set(applications.map(a => a.companyName || a.company).filter(Boolean)).size,
        totalApplications: applications.length,
        studentsPlaced: placedStudents.length,
        placementPercentage: students.length > 0 ? Math.round((placedStudents.length / students.length) * 100) : 0,
        averageCtc: avg || 0,
        highestCtc: max || 0,
        medianCtc: p50 || 0,
      };

      // Branch Distribution
      const branchCounts = {};
      const placedCounts = {};
      students.forEach(student => {
        const branch = student.department || 'Unknown';
        branchCounts[branch] = (branchCounts[branch] || 0) + 1;
        if (placedStudentIds.has(student.id)) {
          placedCounts[branch] = (placedCounts[branch] || 0) + 1;
        }
      });
      const branches = Object.keys(branchCounts).sort();
      const branchDistribution = {
        labels: branches,
        datasets: [
          { label: 'Total Students', data: branches.map(b => branchCounts[b]), backgroundColor: 'rgba(53, 162, 235, 0.5)' },
          { label: 'Placed Students', data: branches.map(b => placedCounts[b] || 0), backgroundColor: 'rgba(75, 192, 192, 0.5)' },
        ],
      };

      // Company Distribution - Show all companies with placement counts
      const companyHires = {};
      
      // From applications
      applications
        .filter(app => {
          const status = normalizeStatus(app.status);
          return status === 'selected' || status === 'placed' || status === 'hired';
        })
        .forEach(app => {
          const company = app.companyName || app.company || 'Unknown';
          companyHires[company] = (companyHires[company] || 0) + 1;
        });
      
      // From students collection with placementStatus = 'placed'
      students
        .filter(student => student.placementStatus === 'placed')
        .forEach(student => {
          const company = student.placedCompany || 'Unknown';
          companyHires[company] = (companyHires[company] || 0) + 1;
        });
      
      // Show all companies, not just top 5
      const sortedCompanies = Object.entries(companyHires).sort((a, b) => b[1] - a[1]);
      const companyDistribution = {
        labels: sortedCompanies.map(([name]) => name),
        datasets: [{
          label: 'Number of Hires',
          data: sortedCompanies.map(([, count]) => count),
          backgroundColor: sortedCompanies.map((_, i) => {
            const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#4BC0C0'];
            return colors[i % colors.length];
          }),
        }],
      };

      // CTC Distribution - Fix logic and ensure data availability
      const ctcDist = {
        labels: ['0-3 LPA', '3-6 LPA', '6-10 LPA', '10-15 LPA', '15+ LPA'],
        datasets: [{
          label: 'Students',
          data: ctcValues.length > 0 ? [
            ctcValues.filter(ctc => ctc > 0 && ctc <= 3).length,
            ctcValues.filter(ctc => ctc > 3 && ctc <= 6).length,
            ctcValues.filter(ctc => ctc > 6 && ctc <= 10).length,
            ctcValues.filter(ctc => ctc > 10 && ctc <= 15).length,
            ctcValues.filter(ctc => ctc > 15).length,
          ] : [0, 0, 0, 0, 0],
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
        }],
      };

      setAnalyticsData({
        summaryData: summary,
        branchData: branchDistribution,
        companyData: companyDistribution,
        companyKPIs: [],
        funnelData: { labels: [], datasets: [] },
        ctcDistribution: ctcDist,
        eligibilityData: eligibilityData,
        placementProbData: [],
        deptPlacementTrends: { labels: [], datasets: [] },
        avgPackageData: { labels: [], datasets: [] },
        loading: false,
        error: null,
      });
    } catch (error) {
      setAnalyticsData(prev => ({ ...prev, error: error.message }));
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
    // Set up real-time data refresh every 30 seconds
    const interval = setInterval(fetchAnalyticsData, 30000);
    return () => clearInterval(interval);
  }, [filters, allStudents, allJobs, allApplications]);

  return analyticsData;
};

 export default useAnalyticsData;