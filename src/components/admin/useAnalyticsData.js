import { useState, useEffect } from 'react';
import { db } from '../../firebase'; // Assuming firebase.js is in the parent directory
import { collection, getDocs, query, where } from 'firebase/firestore';
import { parseCTCToLPA, summarizeCTCs } from '../../utils/ctc';

// Accept filters as an argument
const useAnalyticsData = (filters) => {
  const [summaryData, setSummaryData] = useState({
    jobOpenings: 0,
    registeredStudents: 0,
    totalApplications: 0,
    placedStudents: 0,
    notPlacedStudents: 0,
    totalOffers: 0,
    highestCTC: 0,
    averageCTC: 0,
    lowestCTC: 0,
    medianCTC: 0,
    p90CTC: 0,
    placementPercentage: 0,
    jobsSecured: 0,
    placementsSecured: 0,
    companiesParticipated: 0,
  });

  const [branchData, setBranchData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Total Students',
        data: [],
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
      {
        label: 'Placed Students',
        data: [],
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      }
    ]
  });

  const [companyData, setCompanyData] = useState({
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [],
      borderColor: [],
      borderWidth: 1,
      label: 'Number of Hires'
    }]
  });

  const [companyKPIs, setCompanyKPIs] = useState([]);

  const [funnelData, setFunnelData] = useState({
    labels: ['Eligible', 'Applied', 'Shortlisted', 'Interviewed', 'Offers', 'Accepted'],
    datasets: [{
      label: 'Recruitment Funnel',
      data: [0, 0, 0, 0, 0, 0],
      backgroundColor: 'rgba(75, 192, 192, 0.5)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1
    }]
  });

  const [roundData, setRoundData] = useState([]);

  const [trendData, setTrendData] = useState({});

  const [demographicData, setDemographicData] = useState({
    branch: { labels: [], datasets: [] },
    gender: { labels: [], datasets: [] },
    skills: { labels: [], datasets: [] },
  });

  const [ctcDistribution, setCtcDistribution] = useState({ labels: [], datasets: [] });

  // --- Helpers: normalization and parsing ---
  const normalizeStatus = (status) => (status || '').toString().trim().toLowerCase();

  // Convert CTC/salary inputs to LPA (Lakhs Per Annum)
  const parseCTCToLPA = (value) => {
    if (value == null) return 0;
    // If number: assume INR amount if large, otherwise already in LPA
    if (typeof value === 'number') {
      if (value >= 100000) return +(value / 100000).toFixed(2);
      return +value.toFixed(2);
    }
    if (typeof value !== 'string') return 0;
    let cleaned = value
      .replace(/[,\s]/g, '')
      .replace(/₹|rs\.?|inr/gi, '')
      .toLowerCase();
    // Handle explicit LPA markers
    if (/lpa$/.test(cleaned)) {
      const num = parseFloat(cleaned.replace(/lpa$/, ''));
      return isNaN(num) ? 0 : +num.toFixed(2);
    }
    if (/lac|lakh|lakhs/.test(cleaned)) {
      const num = parseFloat(cleaned.replace(/lac|lakh|lakhs/, ''));
      return isNaN(num) ? 0 : +num.toFixed(2);
    }
    // If it looks like a yearly INR number (>= 1,00,000) convert to LPA
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    if (num >= 100000) return +(num / 100000).toFixed(2);
    // Otherwise treat as LPA already
    return +num.toFixed(2);
  };

  // Utility to check if any filter is active
  const hasActiveFilters = (() => {
    const { dateRange, ...rest } = filters;
    const dateActive = dateRange && (dateRange.start || dateRange.end);
    return (
      dateActive ||
      Object.values(rest).some(v => v && v !== '')
    );
  })();

  // Helper function to apply filters to students
  const applyStudentFilters = (students, filters) => {
    return students.filter(student => {
      const batchMatch = !filters.batch || student.batch === filters.batch;
      const departmentMatch = !filters.department || student.department === filters.department;
      // Add other student filters here if needed
      return batchMatch && departmentMatch;
    });
  };

  // Helper function to apply filters to applications
  const applyApplicationFilters = (applications, filters) => {
    return applications.filter(app => {
      // Date range filter
      const appTimestamp = app.timestamp instanceof Date ? app.timestamp : new Date(app.timestamp);
      const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null;
      const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null;
      const dateMatch = (!startDate || appTimestamp >= startDate) && (!endDate || appTimestamp <= endDate);

      // Application status filter
      const statusMatch = !filters.applicationStatus || normalizeStatus(app.status) === normalizeStatus(filters.applicationStatus);

      // Company filter (robust: check company, companyName, job_company)
      const companyMatch = !filters.company ||
        app.company === filters.company ||
        app.companyName === filters.company ||
        app.job_company === filters.company;

      // Job role filter (assumes app.position or similar field exists)
      const jobRoleMatch = !filters.jobRole || app.position === filters.jobRole;

      return dateMatch && statusMatch && companyMatch && jobRoleMatch;
    });
  };

  // Helper function to apply filters to jobs (primarily for KPI calculation)
  const applyJobFilters = (jobs, filters) => {
     return jobs.filter(job => {
         // Jobs don't typically have batch/department directly tied to the job itself,
         // but rather in eligibility criteria. Filtering jobs by batch/department
         // might not be the correct approach. Eligibility is checked per student per job.
         // We'll keep this simple and assume job filters aren't needed based on the current UI filters.
         // return true; // No job-specific filters from the UI currently

         // Apply date range filter to jobs based on a hypothetical 'postedDate' field
         const jobPostedDate = job.postedDate instanceof Date ? job.postedDate : (job.postedDate ? new Date(job.postedDate) : null);
         const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null;
         const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null;
         const dateMatch = (!startDate || (jobPostedDate && jobPostedDate >= startDate)) && (!endDate || (jobPostedDate && jobPostedDate <= endDate));

         // Company filter
         const companyMatch = !filters.company || job.company === filters.company;

         // Job role filter (assumes job.position or job.title field exists)
         const jobRoleMatch = !filters.jobRole || job.position === filters.jobRole;

         // Currently, only date range, company, and job role filters are applied to jobs
         return dateMatch && companyMatch && jobRoleMatch;
     });
  };


  // useEffect for overall summary data
  // Add filters to dependencies
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        const jobsSnapshot = await getDocs(collection(db, 'jobs'));
        const allJobs = jobsSnapshot.docs.map(doc => {
             const data = doc.data();
             const eligibility = data.eligibilityCriteria || {};
             return {
                 id: doc.id,
                 ...data,
                 company: data.company?.trim() || 'Unknown Company', // Ensure company exists
                 minCGPA: parseFloat(eligibility.cgpa) || 0,
                 maxArrears: parseInt(eligibility.arrears) || Infinity,
                 batch: eligibility.batch || '',
                 department: Array.isArray(eligibility.department) ? eligibility.department : (eligibility.department ? [eligibility.department] : []),
                 postedDate: data.postedDate?.toDate() || null // Assuming postedDate exists and is a Timestamp
             };
        }).filter(job => job.company !== 'Unknown Company'); // Filter out jobs with no company

        // Apply job filters (though current UI filters don't apply directly to jobs)
        const filteredJobs = applyJobFilters(allJobs, filters);
        console.log('Filtered Jobs:', filteredJobs);

        const companies = new Set(filteredJobs.map(job => job.company));
        console.log('Companies from Filtered Jobs:', Array.from(companies));

        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const allStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Apply student filters
        const filteredStudents = applyStudentFilters(allStudents, filters);
        const registeredStudents = filteredStudents.length;

        const applicationsSnapshot = await getDocs(collection(db, 'applications'));
        const allApplications = applicationsSnapshot.docs.map(doc => ({
             id: doc.id,
             ...doc.data(),
             student_id: doc.data().student_id || doc.data().studentId,
             job_id: doc.data().job_id || doc.data().jobId,
             companyName: doc.data().companyName || doc.data().company,
             status: normalizeStatus(doc.data().status),
             timestamp: doc.data().timestamp?.toDate() || new Date() // Ensure timestamp is Date object
        }));
        // Apply application filters
        const filteredApplications = applyApplicationFilters(allApplications, filters);
        const totalApplications = filteredApplications.length;

        // Filter placed students from the *filtered* student list
        // This requires knowing which of the filtered students are placed based on filtered applications
        const placedStudentIds = new Set(
          filteredApplications
            .filter(app => ['selected', 'accepted'].includes(normalizeStatus(app.status)))
            .map(app => app.student_id)
        );
        const placedStudents = filteredStudents.filter(student => placedStudentIds.has(student.id)).length;

        const jobsSecured = new Set(
          filteredApplications
            .filter(app => ['selected', 'accepted'].includes(normalizeStatus(app.status)))
            .map(app => app.job_id)
        ).size;
        const placementsSecured = placedStudents;

        const placementPercentage = registeredStudents > 0
          ? ((placedStudents / registeredStudents) * 100).toFixed(1)
          : 0;

        // Calculate additional metrics
        const notPlacedStudents = registeredStudents - placedStudents;
        const totalOffers = placedStudents; // Assuming each placed student received an offer
        
        // Calculate CTC metrics for placed students (selected or accepted)
        const selectedApplications = filteredApplications.filter(app => ['selected', 'accepted'].includes(normalizeStatus(app.status)));
        const jobById = new Map(allJobs.map(j => [j.id, j]));
        const ctcValues = [];
        for (const app of selectedApplications) {
          const job = jobById.get(app.job_id);
          const fromApp = parseCTCToLPA(app.offerCTC || app.package || app.ctc);
          const fromJob = job ? parseCTCToLPA(job.ctc || job.salary) : 0;
          const ctcLPA = fromApp || fromJob;
          if (ctcLPA > 0) ctcValues.push(ctcLPA);
        }
        
        const highestCTC = ctcValues.length > 0 ? +Math.max(...ctcValues).toFixed(2) : 0;
        const lowestCTC = ctcValues.length > 0 ? +Math.min(...ctcValues).toFixed(2) : 0;
        const averageCTC = ctcValues.length > 0 ? +(
          ctcValues.reduce((sum, ctc) => sum + ctc, 0) / ctcValues.length
        ).toFixed(2) : 0;
        const { p50, p90 } = summarizeCTCs(ctcValues);

        // Build CTC distribution (bins in LPA)
        const bins = [0, 3, 6, 9, 12, Infinity];
        const labels = ['0-3', '3-6', '6-9', '9-12', '12+'];
        const counts = [0, 0, 0, 0, 0];
        ctcValues.forEach(v => {
          if (v < 3) counts[0]++;
          else if (v < 6) counts[1]++;
          else if (v < 9) counts[2]++;
          else if (v < 12) counts[3]++;
          else counts[4]++;
        });
        setCtcDistribution({
          labels,
          datasets: [{
            label: 'Students by CTC (LPA)',
            data: counts,
            backgroundColor: 'rgba(99, 102, 241, 0.6)'
          }]
        });
        
        // Count unique companies that participated (from applications considered)
        const companiesParticipated = new Set(
          selectedApplications.map(app => app.companyName).filter(Boolean)
        ).size || companies.size;

        setSummaryData({
          jobOpenings: filteredJobs.length,
          registeredStudents: registeredStudents,
          totalApplications: totalApplications,
          placedStudents: placedStudents,
          notPlacedStudents: notPlacedStudents,
          totalOffers: totalOffers,
          highestCTC: highestCTC,
          averageCTC: averageCTC,
          lowestCTC: lowestCTC,
          medianCTC: p50,
          p90CTC: p90,
          placementPercentage,
          jobsSecured,
          placementsSecured,
          companiesParticipated,
        });
        // Do not override companyData here; it is computed in a dedicated effect below

      } catch (error) {
        console.error('Error fetching analytics data:', error);
      }
    };

    fetchAnalyticsData();
  }, [filters]); // Add filters as a dependency

  // useEffect for branch data
  // Add filters to dependencies
  useEffect(() => {
    const fetchBranchData = async () => {
      try {
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const allStudents = studentsSnapshot.docs.map(doc => ({
             id: doc.id,
             ...doc.data(),
             department: doc.data().department || 'Unknown'
        }));

        // Apply student filters
        const filteredStudents = applyStudentFilters(allStudents, filters);

        const applicationsSnapshot = await getDocs(collection(db, 'applications'));
         const allApplications = applicationsSnapshot.docs.map(doc => ({
             id: doc.id,
             ...doc.data(),
             timestamp: doc.data().timestamp?.toDate() || new Date() // Ensure timestamp is Date object
         }));
         // Apply application filters
         const filteredApplications = applyApplicationFilters(allApplications, filters);

         // Map filtered applications back to filtered students to check placement status
         const placedStudentIds = new Set(
           filteredApplications
             .filter(app => ['selected', 'accepted'].includes(normalizeStatus(app.status)))
             .map(app => app.student_id)
         );


        const branchCounts = {};
        const placedCounts = {};

        filteredStudents.forEach((student) => {
          const branch = student.department;
          branchCounts[branch] = (branchCounts[branch] || 0) + 1;
          // Check if this filtered student is in the set of placed students from filtered applications
          if (placedStudentIds.has(student.id)) {
            placedCounts[branch] = (placedCounts[branch] || 0) + 1;
          }
        });

        const branches = Object.keys(branchCounts).sort();

        setBranchData({
          labels: branches,
          datasets: [
            {
              label: 'Total Students',
              data: branches.map(branch => branchCounts[branch]),
              backgroundColor: 'rgba(53, 162, 235, 0.5)',
            },
            {
              label: 'Placed Students',
              data: branches.map(branch => placedCounts[branch] || 0),
              backgroundColor: 'rgba(75, 192, 192, 0.5)',
            }
          ]
        });
      } catch (error) {
        console.error('Error fetching branch data:', error);
      }
    };

    fetchBranchData();
  }, [filters]); // Add filters as a dependency

  // useEffect for company data (Top Recruiting Companies)
  // Add filters to dependencies
  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const applicationsSnapshot = await getDocs(collection(db, 'applications'));
        const allApplications = applicationsSnapshot.docs.map(doc => ({
             id: doc.id,
             ...doc.data(),
             timestamp: doc.data().timestamp?.toDate() || new Date() // Ensure timestamp is Date object
        }));

        // Apply application filters
        const filteredApplications = applyApplicationFilters(allApplications, filters);

        const companyHires = {};

        filteredApplications.forEach((application) => {
          if (application.companyName && ['selected', 'accepted'].includes(normalizeStatus(application.status))) {
            companyHires[application.companyName] = (companyHires[application.companyName] || 0) + 1;
          }
        });

        const sortedCompanies = Object.entries(companyHires)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5);

        setCompanyData({
          labels: sortedCompanies.map(([company]) => company),
          datasets: [{
            label: 'Number of Hires',
            data: sortedCompanies.map(([,count]) => count),
            backgroundColor: [
              'rgba(255, 99, 132, 0.5)',
              'rgba(54, 162, 235, 0.5)',
              'rgba(255, 206, 86, 0.5)',
              'rgba(75, 192, 192, 0.5)',
              'rgba(153, 102, 255, 0.5)',
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(153, 102, 255, 1)',
            ],
            borderWidth: 1,
          }]
        });
      } catch (error) {
        console.error('Error fetching company data:', error);
      }
    };

    fetchCompanyData();
  }, [filters]); // Add filters as a dependency

  // useEffect to compute company KPIs
  // Add filters to dependencies
  useEffect(() => {
    const fetchCompanyKPIs = async () => {
      try {
        const jobsSnapshot = await getDocs(collection(db, 'jobs'));
        const allJobs = jobsSnapshot.docs.map(doc => {
             const data = doc.data();
             const eligibility = data.eligibilityCriteria || {};
             return {
                 id: doc.id,
                 ...data,
                 company: data.company?.trim() || 'Unknown Company', // Ensure company exists
                 minCGPA: parseFloat(eligibility.cgpa) || 0,
                 maxArrears: parseInt(eligibility.arrears) || Infinity,
                 batch: eligibility.batch || '',
                 department: Array.isArray(eligibility.department) ? eligibility.department : (eligibility.department ? [eligibility.department] : []),
                 postedDate: data.postedDate?.toDate() || null // Assuming postedDate exists and is a Timestamp
             };
        }).filter(job => job.company !== 'Unknown Company'); // Filter out jobs with no company

        // Apply job filters (though current UI filters don't apply directly to jobs)
        const filteredJobs = applyJobFilters(allJobs, filters);
        console.log('Filtered Jobs:', filteredJobs);

        const companies = new Set(filteredJobs.map(job => job.company));
        console.log('Companies from Filtered Jobs:', Array.from(companies));


        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const allStudents = studentsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            cgpa: parseFloat(data.cgpa) || 0,
            arrears: parseInt(data.arrears) || 0,
            batch: data.batch || '',
            department: data.department || ''
          };
        });

        // Apply student filters
        const filteredStudents = applyStudentFilters(allStudents, filters);
        console.log('Filtered Students:', filteredStudents);


        const applicationsSnapshot = await getDocs(collection(db, 'applications'));
        const allApplications = applicationsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            companyName: data.companyName || data.company,
            status: normalizeStatus(data.status || 'pending'),
            timestamp: data.timestamp?.toDate() || new Date() // Ensure timestamp is Date object
          };
        });

        // Apply application filters
        const filteredApplications = applyApplicationFilters(allApplications, filters);
        console.log('Filtered Applications:', filteredApplications);


        // Calculate KPIs for each company based on *filtered* data
        const kpis = Array.from(companies).map(company => {
          // Get jobs relevant to this company *after* job filters are applied
          const companyJobs = filteredJobs.filter(job => job.company === company);

          // Calculate eligible students from the *filtered* student list
          const eligibleStudents = filteredStudents.filter(student =>
            companyJobs.some(job => {
              const meetsGPA = student.cgpa >= job.minCGPA;
              const meetsArrears = student.arrears <= job.maxArrears;
              const meetsBatch = !job.batch || student.batch === job.batch;
              const meetsDepartment = !job.department || (Array.isArray(job.department) && (!job.department.length || job.department.includes(student.department)));

              // Log eligibility check details for debugging (uncomment if needed)
              // console.log(`Checking eligibility for Student ${student.id} for Job ${job.id} (${job.company}):`);
              // console.log(`  CGPA: ${student.cgpa} >= ${job.minCGPA} (${meetsGPA})`);
              // console.log(`  Arrears: ${student.arrears} <= ${job.maxArrears} (${meetsArrears})`);
              // console.log(`  Batch: ${student.batch} === ${job.batch} (${meetsBatch})`);
              // console.log(`  Department: ${student.department} in ${job.department} (${meetsDepartment})`);
              // console.log(`  Overall Eligible for this job: ${meetsGPA && meetsArrears && meetsBatch && meetsDepartment}`);

              return meetsGPA && meetsArrears && meetsBatch && meetsDepartment;
            })
          );

          // Log eligible students for this company
          console.log(`Eligible Students for ${company}:`, eligibleStudents);


          // Calculate applications and status from the *filtered* application list
          const companyApplications = filteredApplications.filter(app =>
            app.company === company ||
            app.companyName === company ||
            app.job_company === company
          );
          console.log(`Company: ${company}, Applications:`, companyApplications);
          const applied = companyApplications.length;
          const eligible = eligibleStudents.length;
          const notApplied = Math.max(0, eligible - applied);
          // Count unique students with at least one 'selected'/'accepted' application for this company
          const selectedStudentIds = new Set(
            companyApplications
              .filter(app => ['selected', 'accepted'].includes(normalizeStatus(app.status)))
              .map(app => app.student_id)
          );
          console.log(`Company: ${company}, Selected Student IDs:`, Array.from(selectedStudentIds));
          const selected = selectedStudentIds.size;
          const rejected = companyApplications.filter(app => normalizeStatus(app.status) === 'rejected').length;

          return {
            company,
            eligible,
            applied,
            notApplied,
            selected,
            rejected,
            appliedPct: eligible > 0 ? ((applied / eligible) * 100).toFixed(1) : '0.0',
            notAppliedPct: eligible > 0 ? ((notApplied / eligible) * 100).toFixed(1) : '0.0',
            selectedPct: applied > 0 ? ((selected / applied) * 100).toFixed(1) : '0.0',
            rejectedPct: applied > 0 ? ((rejected / applied) * 100).toFixed(1) : '0.0',
          };
        });

        setCompanyKPIs(kpis);
      } catch (error) {
        console.error('Error fetching company KPIs:', error);
      }
    };

    fetchCompanyKPIs();
  }, [filters]); // Add filters as a dependency

  // useEffect for funnel and round data
  // Add filters to dependencies
  useEffect(() => {
    if (!hasActiveFilters) {
      setFunnelData({
        labels: ['Eligible', 'Applied', 'Shortlisted', 'Interviewed', 'Offers', 'Accepted'],
        datasets: [{
          label: 'Recruitment Funnel',
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      });
      return;
    }
    const fetchFunnelAndRoundData = async () => {
      try {
        const applicationsSnapshot = await getDocs(collection(db, 'applications'));
        const allApplications = applicationsSnapshot.docs.map(doc => ({
             id: doc.id,
             ...doc.data(),
             timestamp: doc.data().timestamp?.toDate() || new Date() // Ensure timestamp is Date object
        }));

        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const allStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // If company filter is set, only consider students and applications relevant to that company
        let filteredApplications = allApplications;
        let filteredStudents = allStudents;
        if (filters.company) {
          filteredApplications = allApplications.filter(app =>
            app.company === filters.company ||
            app.companyName === filters.company ||
            app.job_company === filters.company
          );
          // Only students who have applied to this company
          const studentIdsForCompany = new Set(filteredApplications.map(app => app.student_id || app.studentId));
          filteredStudents = allStudents.filter(s => studentIdsForCompany.has(s.id));
        }

        // Use the same eligibility logic as the pie chart
        const eligibleStudents = filteredStudents.filter(s =>
          s.cgpa >= 6.0 &&
          s.backlogs === 0 &&
          s.attendance >= 75 &&
          s.isFinalYear &&
          !s.disciplinaryAction
        );
        const eligibleStudentIds = new Set(eligibleStudents.map(s => s.id));

        // Only include applications from eligible students
        const eligibleApplications = filteredApplications.filter(app => eligibleStudentIds.has(app.student_id || app.studentId));

        // Apply application filters to eligible applications
        const finalFilteredApplications = applyApplicationFilters(eligibleApplications, filters);

        const funnelCounts = {
          eligible: eligibleStudents.length,
          applied: finalFilteredApplications.length,
          shortlisted: 0,
          interviewed: 0,
          offers: 0,
          accepted: 0
        };

        finalFilteredApplications.forEach(app => {
          if (app.status && app.status.toLowerCase() === 'shortlisted') funnelCounts.shortlisted++;
          if (app.status && app.status.toLowerCase() === 'interviewed') funnelCounts.interviewed++;
          if (app.status && app.status.toLowerCase() === 'offered') funnelCounts.offers++;
          if (app.status && app.status.toLowerCase() === 'accepted') funnelCounts.accepted++;
        });
        // Debug logging
        console.log('FunnelData - eligible:', eligibleStudents.length, 'applied:', finalFilteredApplications.length, 'shortlisted:', funnelCounts.shortlisted, 'interviewed:', funnelCounts.interviewed, 'offers:', funnelCounts.offers, 'accepted:', funnelCounts.accepted);
        setFunnelData(prev => ({ ...prev, datasets: [{ ...prev.datasets[0], data: Object.values(funnelCounts) }] }));
      } catch (error) {
        console.error('Error fetching funnel and round data:', error);
      }
    };
    fetchFunnelAndRoundData();
  }, [filters, hasActiveFilters]); // Add filters as a dependency

  // useEffect for Demographic and Skill Breakdowns
  // Add filters to dependencies
  useEffect(() => {
    const fetchDemographicAndSkillData = async () => {
      try {
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const allStudents = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          department: doc.data().department || 'Unknown',
          gender: doc.data().gender || 'Unknown',
          skills: Array.isArray(doc.data().skills) ? doc.data().skills : []
        }));

        // Apply student filters
        const filteredStudents = applyStudentFilters(allStudents, filters);

        const applicationsSnapshot = await getDocs(collection(db, 'applications'));
        const allApplications = applicationsSnapshot.docs.map(doc => ({
             id: doc.id,
             ...doc.data(),
             timestamp: doc.data().timestamp?.toDate() || new Date() // Ensure timestamp is Date object
        }));

        // Apply application filters
        const filteredApplications = applyApplicationFilters(allApplications, filters);

        // Get the set of student IDs who have applications *after* application filters
        const studentIdsWithFilteredApplications = new Set(filteredApplications.map(app => app.student_id));

        // Get the set of student IDs who have *selected* applications *after* application filters
         const studentIdsWithFilteredSelectedApplications = new Set(
           filteredApplications
             .filter(app => ['selected', 'accepted'].includes(normalizeStatus(app.status)))
             .map(app => app.student_id)
         );


        // --- Branch/Department Distribution (Applicants vs. Selected) ---
        const branchApplicantCounts = {};
        const branchSelectedCounts = {};

        // Count applicants and selected from the *filtered* student list
        // but only include students who have applications *after* application filters
        filteredStudents.filter(student => studentIdsWithFilteredApplications.has(student.id)).forEach(student => {
             const branch = student.department;
             branchApplicantCounts[branch] = (branchApplicantCounts[branch] || 0) + 1;
             // Check if this filtered student is in the set of placed students from filtered applications
             if (studentIdsWithFilteredSelectedApplications.has(student.id)) {
               branchSelectedCounts[branch] = (branchSelectedCounts[branch] || 0) + 1;
             }
        });


        const branches = Object.keys({ ...branchApplicantCounts, ...branchSelectedCounts }).sort();
        const branchDatasets = [
          {
            label: 'Applicants',
            data: branches.map(branch => branchApplicantCounts[branch] || 0),
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
          },
          {
            label: 'Selected',
            data: branches.map(branch => branchSelectedCounts[branch] || 0),
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
          }
        ];

        // --- Gender Breakdown ---
        const genderApplicantCounts = {};
        const genderSelectedCounts = {};

        // Count applicants and selected from the *filtered* student list
        // but only include students who have applications *after* application filters
         filteredStudents.filter(student => studentIdsWithFilteredApplications.has(student.id)).forEach(student => {
             const gender = student.gender;
             genderApplicantCounts[gender] = (genderApplicantCounts[gender] || 0) + 1;
             // Check if this filtered student is in the set of placed students from filtered applications
             if (studentIdsWithFilteredSelectedApplications.has(student.id)) {
               genderSelectedCounts[gender] = (genderSelectedCounts[gender] || 0) + 1;
             }
         });


        const genders = Object.keys({ ...genderApplicantCounts, ...genderSelectedCounts }).sort();
        const genderDatasets = [
             {
               label: 'Applicants',
               data: genders.map(gender => genderApplicantCounts[gender] || 0),
               backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966CC'],
             },
             {
               label: 'Selected',
               data: genders.map(gender => genderSelectedCounts[gender] || 0),
               backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966CC'],
             }
           ];

        // --- Top Skills ---
        const skillApplicantCounts = {};
        const skillSelectedCounts = {};

        // Count applicants and selected from the *filtered* student list
        // but only include students who have applications *after* application filters
         filteredStudents.filter(student => studentIdsWithFilteredApplications.has(student.id)).forEach(student => {
             student.skills.forEach(skill => {
                 skillApplicantCounts[skill] = (skillApplicantCounts[skill] || 0) + 1;
             });
         });

         filteredStudents.filter(student => studentIdsWithFilteredSelectedApplications.has(student.id)).forEach(student => {
             student.skills.forEach(skill => {
                 skillSelectedCounts[skill] = (skillSelectedCounts[skill] || 0) + 1;
             });
         });


        const allSkills = Object.keys({ ...skillApplicantCounts, ...skillSelectedCounts });
        const sortedSkills = allSkills.sort((a, b) => (skillApplicantCounts[b] || 0) - (skillApplicantCounts[a] || 0)).slice(0, 10);

        const skillDatasets = [
          {
            label: 'Applicants',
            data: sortedSkills.map(skill => skillApplicantCounts[skill] || 0),
            backgroundColor: 'rgba(153, 102, 255, 0.6)',
          },
          {
            label: 'Selected',
            data: sortedSkills.map(skill => skillSelectedCounts[skill] || 0),
            backgroundColor: 'rgba(255, 159, 64, 0.6)',
          }
        ];

        setDemographicData({
          branch: { labels: branches, datasets: branchDatasets },
          gender: { labels: genders, datasets: genderDatasets },
          skills: { labels: sortedSkills, datasets: skillDatasets },
        });

      } catch (error) {
        console.error('Error fetching demographic and skill data:', error);
      }
    };

    fetchDemographicAndSkillData();
  }, [filters]); // Add filters as a dependency

  // useEffect for trend data
  // Add filters to dependencies
  useEffect(() => {
    const fetchTrendData = async () => {
      try {
        const applicationsSnapshot = await getDocs(collection(db, 'applications'));
        const allApplications = applicationsSnapshot.docs.map(doc => ({
          ...doc.data(), timestamp: doc.data().timestamp?.toDate() || new Date()
        }));

        // Apply application filters
        const filteredApplications = applyApplicationFilters(allApplications, filters);

        const dateGroups = {}; const acceptedGroups = {};
        filteredApplications.forEach(app => {
          const date = app.timestamp.toLocaleDateString();
          dateGroups[date] = (dateGroups[date] || 0) + 1;
          if (app.status === 'accepted') {
            acceptedGroups[date] = (acceptedGroups[date] || 0) + 1;
          }
        });
        const dates = Object.keys(dateGroups).sort();
        setTrendData({
          labels: dates,
          datasets: [
            { label: 'Applications', data: dates.map(date => dateGroups[date]), borderColor: 'rgba(53, 162, 235, 1)', tension: 0.1 },
            { label: 'Offers Accepted', data: dates.map(date => acceptedGroups[date] || 0), borderColor: 'rgba(75, 192, 192, 1)', tension: 0.1 }
          ]
        });
      } catch (error) {
        console.error('Error fetching trend data:', error);
      }
    };
    fetchTrendData();
  }, [filters]); // Add filters as a dependency


  return {
    summaryData,
    branchData,
    companyData,
    companyKPIs,
    funnelData,
    roundData,
    trendData,
    demographicData,
    ctcDistribution,
  };
};

export default useAnalyticsData;