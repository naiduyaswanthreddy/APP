import React, { useState, useEffect } from 'react';
import { getDocs, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Download, FileText, BarChart3, Users, Building, Calendar, TrendingUp, Award, Target } from 'lucide-react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    batch: '',
    department: '',
    company: '',
    dateRange: { start: '', end: '' }
  });

  // Report categories and definitions
  const reportCategories = {
    core: {
      title: "Core Placement Reports",
      subtitle: "Operational reports for daily placement management",
      icon: <FileText className="w-5 h-5" />,
      color: "bg-blue-500",
      reports: [
        {
          id: 'placement-summary',
          name: 'Placement Summary Report',
          description: 'Overview of total students placed vs total eligible',
          fields: ['Branch-wise count', '% placed', 'average salary'],
          icon: <BarChart3 className="w-4 h-4" />
        },
        {
          id: 'company-wise-placement',
          name: 'Company-wise Placement Report',
          description: 'Shows performance per recruiter',
          fields: ['Company name', 'number of offers', 'highest & lowest package'],
          icon: <Building className="w-4 h-4" />
        },
        {
          id: 'eligibility-report',
          name: 'Eligibility Report',
          description: 'Shows who is eligible for each upcoming drive',
          fields: ['Drive name', 'eligibility criteria', 'eligible student list'],
          icon: <Target className="w-4 h-4" />
        },
        {
          id: 'offer-status',
          name: 'Offer Status Report',
          description: 'Tracks students with multiple offers or pending offers',
          fields: ['Student name', 'company', 'offer status', 'joining date'],
          icon: <Target className="w-4 h-4" />
        },
        {
          id: 'rejected-candidates',
          name: 'Rejected Candidate Report',
          description: 'List of students who attended but were rejected',
          fields: ['Drive name', 'stage reached', 'reason for rejection'],
          icon: <Users className="w-4 h-4" />
        },
        {
          id: 'internship-report',
          name: 'Internship Report',
          description: 'Summarizes internship offers',
          fields: ['Company', 'duration', 'stipend', 'branch-wise distribution'],
          icon: <Calendar className="w-4 h-4" />
        },
        {
          id: 'unplaced-students',
          name: 'Unplaced Students Report',
          description: 'Students still seeking placements',
          fields: ['Student name', 'branch', 'skills', 'preferred roles'],
          icon: <Users className="w-4 h-4" />
        }
      ]
    },
    specialized: {
      title: "Specialized Reports",
      subtitle: "Compliance & accreditation reports for NAAC, NBA, AICTE",
      icon: <Award className="w-5 h-5" />,
      color: "bg-green-500",
      reports: [
        {
          id: 'yearly-statistics',
          name: 'Yearly Placement Statistics',
          description: 'Used for NAAC/NBA submissions',
          fields: ['Year', 'branch', 'no. of students placed', 'salary range'],
          icon: <BarChart3 className="w-4 h-4" />
        },
        {
          id: 'branch-wise-ratio',
          name: 'Branch-wise Placement Ratio',
          description: 'Showcases academic department performance',
          fields: ['Branch', 'total students', 'placed students', '% placed'],
          icon: <TrendingUp className="w-4 h-4" />
        },
        {
          id: 'salary-trend',
          name: 'Salary Trend Report',
          description: 'Tracks salary growth year over year',
          fields: ['Min', 'Max', 'Average CTC by year'],
          icon: <TrendingUp className="w-4 h-4" />
        },
        {
          id: 'alumni-history',
          name: 'Alumni Placement History',
          description: 'For historical data proof',
          fields: ['Name', 'batch', 'company joined', 'current position'],
          icon: <Users className="w-4 h-4" />
        },
        {
          id: 'category-wise',
          name: 'Category-wise Placement Report',
          description: 'For government quota and diversity reporting',
          fields: ['Gender', 'category (SC/ST/OBC/GEN)', 'placement status'],
          icon: <Users className="w-4 h-4" />
        },
        {
          id: 'skill-based',
          name: 'Skill-based Placement Report',
          description: 'Maps job roles with skills in demand',
          fields: ['Skill name', 'no. of students placed with that skill'],
          icon: <Target className="w-4 h-4" />
        }
      ]
    },
    insights: {
      title: "Performance & Insights Reports",
      subtitle: "Strategic reports for planning and improvement",
      icon: <TrendingUp className="w-5 h-5" />,
      color: "bg-purple-500",
      reports: [
        {
          id: 'recruiter-retention',
          name: 'Recruiter Retention Report',
          description: 'Which companies return every year',
          fields: ['Company name', 'years visited', 'offers made'],
          icon: <Building className="w-4 h-4" />
        },
        {
          id: 'top-hiring-domains',
          name: 'Top Hiring Domains Report',
          description: 'Find which industries hire the most',
          fields: ['Domain (IT, Core Engg, Analytics)', 'offers count'],
          icon: <BarChart3 className="w-4 h-4" />
        },
        {
          id: 'offer-conversion-rate',
          name: 'Offer Conversion Rate Report',
          description: 'Track how many eligible → appeared → got placed',
          fields: ['Drive name', 'eligible count', 'appeared count', 'placed count'],
          icon: <Target className="w-4 h-4" />
        },
        {
          id: 'student-performance-tests',
          name: 'Student Performance in Tests',
          description: 'Identify weak areas for training',
          fields: ['Aptitude score avg', 'coding score avg', 'reasoning avg'],
          icon: <BarChart3 className="w-4 h-4" />
        },
        {
          id: 'preparation-effectiveness',
          name: 'Preparation Effectiveness Report',
          description: 'Compare mock test results vs actual placement test',
          fields: ['Mock avg score', 'placement test score improvement'],
          icon: <TrendingUp className="w-4 h-4" />
        },
        {
          id: 'drive-clash-analysis',
          name: 'Drive Clash Analysis',
          description: 'Shows impact of overlapping drives on attendance',
          fields: ['Date', 'drive names', 'attendance drop %'],
          icon: <Calendar className="w-4 h-4" />
        }
      ]
    }
  };

  const generateEligibilityReport = (students) => {
    // Basic institute-wide eligibility based on common criteria
    const eligible = [];
    const notEligible = [];
    students.forEach(s => {
      const isEligible = (s.cgpa ?? 0) >= 6.0 && (s.backlogs ?? 0) === 0 && (s.attendance ?? 0) >= 75 && !!s.isFinalYear && !s.disciplinaryAction;
      const row = {
        name: s.name || s.email || 'Unknown',
        rollNumber: s.rollNumber || 'N/A',
        branch: s.department || s.branch || 'Unknown',
        cgpa: s.cgpa ?? 'N/A',
        backlogs: s.backlogs ?? 0,
        attendance: s.attendance ?? 'N/A',
        finalYear: s.isFinalYear ? 'Yes' : 'No',
        disciplinaryAction: s.disciplinaryAction ? 'Yes' : 'No',
        eligibility: isEligible ? 'Eligible' : 'Not Eligible',
        notEligibleReason: isEligible ? '' : (
          (s.cgpa ?? 0) < 6.0 ? 'CGPA below 6.0' :
          (s.backlogs ?? 0) > 0 ? 'Has active backlogs' :
          (s.attendance ?? 0) < 75 ? 'Attendance below 75%' :
          !s.isFinalYear ? 'Not in final year' :
          s.disciplinaryAction ? 'Disciplinary action on record' : 'N/A'
        )
      };
      if (isEligible) eligible.push(row); else notEligible.push(row);
    });

    return {
      title: 'Eligibility Report',
      data: [...eligible, ...notEligible],
      summary: {
        eligible: eligible.length,
        notEligible: notEligible.length,
      }
    };
  };

  // Generate report data based on report type (returns data)
  const generateReportData = async (reportId) => {
    let data = {};
    // Fetch base data
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const applicationsSnapshot = await getDocs(collection(db, 'applications'));
    const applications = applicationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const jobsSnapshot = await getDocs(collection(db, 'jobs'));
    const jobs = jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    switch (reportId) {
      case 'placement-summary':
        data = generatePlacementSummary(students, applications);
        break;
      case 'company-wise-placement':
        data = generateCompanyWiseReport(applications, jobs);
        break;
      case 'eligibility-report':
        data = generateEligibilityReport(students);
        break;
      case 'offer-status':
        data = generateOfferStatusReport(students, applications);
        break;
      case 'rejected-candidates':
        data = generateRejectedCandidatesReport(students, applications);
        break;
      case 'internship-report':
        data = generateInternshipReport(applications, jobs);
        break;
      case 'unplaced-students':
        data = generateUnplacedStudentsReport(students, applications);
        break;
      case 'yearly-statistics':
        data = generateYearlyStatistics(students, applications);
        break;
      case 'branch-wise-ratio':
        data = generateBranchWiseRatio(students, applications);
        break;
      case 'salary-trend':
        data = generateSalaryTrend(applications, jobs);
        break;
      case 'alumni-history':
        data = generateAlumniHistory(students, applications);
        break;
      case 'category-wise':
        data = generateCategoryWiseReport(students, applications);
        break;
      case 'skill-based':
        data = generateSkillBasedReport(students, applications);
        break;
      case 'recruiter-retention':
        data = generateRecruiterRetention(jobs, applications);
        break;
      case 'top-hiring-domains':
        data = generateTopHiringDomains(jobs, applications);
        break;
      case 'offer-conversion-rate':
        data = generateOfferConversionRate(applications, jobs);
        break;
      case 'student-performance-tests':
        data = generateStudentPerformanceTests(students, applications);
        break;
      case 'preparation-effectiveness':
        data = generatePreparationEffectiveness(students, applications);
        break;
      case 'drive-clash-analysis':
        data = generateDriveClashAnalysis(jobs, applications);
        break;
      default:
        data = { error: 'Report not implemented yet' };
    }
    return data;
  };

  // Keep preview flow using the generator above
  const generateReport = async (reportId) => {
    setLoading(true);
    try {
      const data = await generateReportData(reportId);
      setReportData(data);
      toast.success('Report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  // Quick download helper
  const downloadReport = async (reportId, format = 'xlsx') => {
    setLoading(true);
    try {
      const data = await generateReportData(reportId);
      if (format === 'csv') {
        exportToCSV(data);
      } else {
        exportToXLSX(data);
      }
      toast.success('Report downloaded');
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
    } finally {
      setLoading(false);
    }
  };

  // Report generation functions
  const generatePlacementSummary = (students, applications) => {
    const branches = {};
    const placedStudentIds = new Set(
      applications
        .filter(app => ['selected', 'accepted'].includes(app.status?.toLowerCase()))
        .map(app => app.student_id || app.studentId)
    );

    students.forEach(student => {
      const branch = student.department || student.branch || 'Unknown';
      if (!branches[branch]) {
        branches[branch] = { total: 0, placed: 0, salaries: [] };
      }
      branches[branch].total++;
      if (placedStudentIds.has(student.id)) {
        branches[branch].placed++;
      }
    });

    // Calculate salary data
    applications
      .filter(app => ['selected', 'accepted'].includes(app.status?.toLowerCase()))
      .forEach(app => {
        const student = students.find(s => s.id === (app.student_id || app.studentId));
        if (student) {
          const branch = student.department || student.branch || 'Unknown';
          const salary = parseFloat(app.offerCTC || app.package || app.ctc || 0);
          if (salary > 0 && branches[branch]) {
            branches[branch].salaries.push(salary);
          }
        }
      });

    const summary = Object.entries(branches).map(([branch, data]) => ({
      branch,
      total: data.total,
      placed: data.placed,
      percentage: ((data.placed / data.total) * 100).toFixed(1),
      averageSalary: data.salaries.length > 0 
        ? (data.salaries.reduce((sum, sal) => sum + sal, 0) / data.salaries.length).toFixed(2)
        : 'N/A'
    }));

    return {
      title: 'Placement Summary Report',
      data: summary,
      totalStudents: students.length,
      totalPlaced: placedStudentIds.size,
      overallPercentage: ((placedStudentIds.size / students.length) * 100).toFixed(1)
    };
  };

  const generateCompanyWiseReport = (applications, jobs) => {
    const companies = {};
    
    applications
      .filter(app => ['selected', 'accepted'].includes(app.status?.toLowerCase()))
      .forEach(app => {
        const company = app.companyName || app.company || 'Unknown';
        if (!companies[company]) {
          companies[company] = { offers: 0, packages: [] };
        }
        companies[company].offers++;
        
        const salary = parseFloat(app.offerCTC || app.package || app.ctc || 0);
        if (salary > 0) {
          companies[company].packages.push(salary);
        }
      });

    const companyData = Object.entries(companies).map(([company, data]) => ({
      company,
      offers: data.offers,
      highest: data.packages.length > 0 ? Math.max(...data.packages).toFixed(2) : 'N/A',
      lowest: data.packages.length > 0 ? Math.min(...data.packages).toFixed(2) : 'N/A',
      average: data.packages.length > 0 
        ? (data.packages.reduce((sum, pkg) => sum + pkg, 0) / data.packages.length).toFixed(2)
        : 'N/A'
    })).sort((a, b) => b.offers - a.offers);

    return {
      title: 'Company-wise Placement Report',
      data: companyData
    };
  };

  const generateOfferStatusReport = (students, applications) => {
    const studentOffers = {};
    
    applications
      .filter(app => ['selected', 'accepted', 'offered'].includes(app.status?.toLowerCase()))
      .forEach(app => {
        const studentId = app.student_id || app.studentId;
        if (!studentOffers[studentId]) {
          studentOffers[studentId] = [];
        }
        studentOffers[studentId].push(app);
      });

    const multipleOffers = Object.entries(studentOffers)
      .filter(([studentId, offers]) => offers.length > 1)
      .map(([studentId, offers]) => {
        const student = students.find(s => s.id === studentId);
        return {
          studentName: student?.name || student?.email || 'Unknown',
          rollNumber: student?.rollNumber || 'N/A',
          totalOffers: offers.length,
          companies: offers.map(offer => offer.companyName || offer.company).join(', '),
          statuses: offers.map(offer => offer.status).join(', ')
        };
      });

    return {
      title: 'Offer Status Report',
      data: multipleOffers,
      summary: {
        studentsWithMultipleOffers: multipleOffers.length,
        totalOffersTracked: Object.values(studentOffers).flat().length
      }
    };
  };

  const generateRejectedCandidatesReport = (students, applications) => {
    const rejectedApps = applications.filter(app => 
      app.status?.toLowerCase() === 'rejected'
    );

    const rejectedData = rejectedApps.map(app => {
      const student = students.find(s => s.id === (app.student_id || app.studentId));
      return {
        studentName: student?.name || student?.email || 'Unknown',
        rollNumber: student?.rollNumber || 'N/A',
        company: app.companyName || app.company || 'Unknown',
        appliedDate: app.timestamp?.toDate?.()?.toLocaleDateString() || app.appliedDate || 'N/A',
        reason: app.rejectionReason || 'Not specified'
      };
    });

    return {
      title: 'Rejected Candidates Report',
      data: rejectedData,
      totalRejected: rejectedData.length
    };
  };

  const generateUnplacedStudentsReport = (students, applications) => {
    const placedStudentIds = new Set(
      applications
        .filter(app => ['selected', 'accepted'].includes(app.status?.toLowerCase()))
        .map(app => app.student_id || app.studentId)
    );

    const unplacedStudents = students
      .filter(student => !placedStudentIds.has(student.id))
      .map(student => ({
        name: student.name || student.email || 'Unknown',
        rollNumber: student.rollNumber || 'N/A',
        branch: student.department || student.branch || 'Unknown',
        cgpa: student.cgpa || 'N/A',
        skills: Array.isArray(student.skills) ? student.skills.join(', ') : 'N/A',
        preferredRoles: student.preferredRoles || 'Not specified'
      }));

    return {
      title: 'Unplaced Students Report',
      data: unplacedStudents,
      totalUnplaced: unplacedStudents.length
    };
  };

  // Additional report generation functions
  const generateInternshipReport = (applications, jobs) => {
    const internshipApps = applications.filter(app => {
      const job = jobs.find(j => j.id === (app.job_id || app.jobId));
      return job?.type?.toLowerCase() === 'internship' || job?.jobType?.toLowerCase() === 'internship';
    });

    const internshipData = internshipApps
      .filter(app => ['selected', 'accepted'].includes(app.status?.toLowerCase()))
      .map(app => {
        const job = jobs.find(j => j.id === (app.job_id || app.jobId));
        return {
          company: app.companyName || app.company || 'Unknown',
          duration: job?.duration || 'Not specified',
          stipend: job?.stipend || app.stipend || 'Not specified',
          branch: app.studentBranch || 'Unknown',
          studentName: app.studentName || 'Unknown'
        };
      });

    return {
      title: 'Internship Report',
      data: internshipData,
      summary: { totalInternships: internshipData.length }
    };
  };

  const generateYearlyStatistics = (students, applications) => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear];
    
    const yearlyData = years.map(year => {
      const yearStudents = students.filter(s => {
        const batch = parseInt(s.batch) || parseInt(s.graduationYear) || currentYear;
        return batch === year;
      });
      
      const placedStudentIds = new Set(
        applications
          .filter(app => ['selected', 'accepted'].includes(app.status?.toLowerCase()))
          .map(app => app.student_id || app.studentId)
      );
      
      const placedCount = yearStudents.filter(s => placedStudentIds.has(s.id)).length;
      const salaries = applications
        .filter(app => ['selected', 'accepted'].includes(app.status?.toLowerCase()))
        .map(app => parseFloat(app.offerCTC || app.package || 0))
        .filter(sal => sal > 0);
      
      return {
        year,
        totalStudents: yearStudents.length,
        placedStudents: placedCount,
        placementPercentage: yearStudents.length > 0 ? ((placedCount / yearStudents.length) * 100).toFixed(1) : '0',
        minSalary: salaries.length > 0 ? Math.min(...salaries).toFixed(2) : 'N/A',
        maxSalary: salaries.length > 0 ? Math.max(...salaries).toFixed(2) : 'N/A',
        avgSalary: salaries.length > 0 ? (salaries.reduce((sum, sal) => sum + sal, 0) / salaries.length).toFixed(2) : 'N/A'
      };
    });

    return {
      title: 'Yearly Placement Statistics',
      data: yearlyData
    };
  };

  const generateBranchWiseRatio = (students, applications) => {
    const branches = {};
    const placedStudentIds = new Set(
      applications
        .filter(app => ['selected', 'accepted'].includes(app.status?.toLowerCase()))
        .map(app => app.student_id || app.studentId)
    );

    students.forEach(student => {
      const branch = student.department || student.branch || 'Unknown';
      if (!branches[branch]) {
        branches[branch] = { total: 0, placed: 0 };
      }
      branches[branch].total++;
      if (placedStudentIds.has(student.id)) {
        branches[branch].placed++;
      }
    });

    const branchData = Object.entries(branches).map(([branch, data]) => ({
      branch,
      totalStudents: data.total,
      placedStudents: data.placed,
      placementPercentage: ((data.placed / data.total) * 100).toFixed(1)
    }));

    return {
      title: 'Branch-wise Placement Ratio',
      data: branchData
    };
  };

  const generateSalaryTrend = (applications, jobs) => {
    const years = {};
    
    applications
      .filter(app => ['selected', 'accepted'].includes(app.status?.toLowerCase()))
      .forEach(app => {
        const year = app.timestamp?.toDate?.()?.getFullYear() || new Date().getFullYear();
        const salary = parseFloat(app.offerCTC || app.package || 0);
        
        if (salary > 0) {
          if (!years[year]) years[year] = [];
          years[year].push(salary);
        }
      });

    const trendData = Object.entries(years).map(([year, salaries]) => ({
      year: parseInt(year),
      minCTC: Math.min(...salaries).toFixed(2),
      maxCTC: Math.max(...salaries).toFixed(2),
      avgCTC: (salaries.reduce((sum, sal) => sum + sal, 0) / salaries.length).toFixed(2),
      totalOffers: salaries.length
    })).sort((a, b) => a.year - b.year);

    return {
      title: 'Salary Trend Report',
      data: trendData
    };
  };

  const generateAlumniHistory = (students, applications) => {
    const alumniData = students
      .filter(s => s.placementStatus === 'placed' || s.graduationYear < new Date().getFullYear())
      .map(student => {
        const placementApp = applications.find(app => 
          (app.student_id || app.studentId) === student.id && 
          ['selected', 'accepted'].includes(app.status?.toLowerCase())
        );
        
        return {
          name: student.name || student.email || 'Unknown',
          batch: student.batch || student.graduationYear || 'Unknown',
          companyJoined: student.placedCompany || placementApp?.companyName || 'Unknown',
          currentPosition: student.currentPosition || 'Not updated',
          package: student.placedPackage || placementApp?.offerCTC || 'Not specified'
        };
      });

    return {
      title: 'Alumni Placement History',
      data: alumniData
    };
  };

  const generateCategoryWiseReport = (students, applications) => {
    const categories = {};
    const placedStudentIds = new Set(
      applications
        .filter(app => ['selected', 'accepted'].includes(app.status?.toLowerCase()))
        .map(app => app.student_id || app.studentId)
    );

    students.forEach(student => {
      const gender = student.gender || 'Not specified';
      const category = student.category || student.caste || 'General';
      const key = `${gender}-${category}`;
      
      if (!categories[key]) {
        categories[key] = { gender, category, total: 0, placed: 0 };
      }
      categories[key].total++;
      if (placedStudentIds.has(student.id)) {
        categories[key].placed++;
      }
    });

    const categoryData = Object.values(categories).map(data => ({
      gender: data.gender,
      category: data.category,
      totalStudents: data.total,
      placedStudents: data.placed,
      placementStatus: `${data.placed}/${data.total} (${((data.placed / data.total) * 100).toFixed(1)}%)`
    }));

    return {
      title: 'Category-wise Placement Report',
      data: categoryData
    };
  };

  const generateSkillBasedReport = (students, applications) => {
    const skillMap = {};
    const placedStudentIds = new Set(
      applications
        .filter(app => ['selected', 'accepted'].includes(app.status?.toLowerCase()))
        .map(app => app.student_id || app.studentId)
    );

    students.forEach(student => {
      const skills = student.skills || [];
      const isPlaced = placedStudentIds.has(student.id);
      
      skills.forEach(skill => {
        if (!skillMap[skill]) {
          skillMap[skill] = { total: 0, placed: 0 };
        }
        skillMap[skill].total++;
        if (isPlaced) {
          skillMap[skill].placed++;
        }
      });
    });

    const skillData = Object.entries(skillMap).map(([skill, data]) => ({
      skillName: skill,
      totalStudents: data.total,
      placedStudents: data.placed,
      placementRate: ((data.placed / data.total) * 100).toFixed(1)
    })).sort((a, b) => b.placedStudents - a.placedStudents);

    return {
      title: 'Skill-based Placement Report',
      data: skillData
    };
  };

  const generateRecruiterRetention = (jobs, applications) => {
    const companyYears = {};
    
    jobs.forEach(job => {
      const company = job.company || job.companyName || 'Unknown';
      const year = job.createdAt?.toDate?.()?.getFullYear() || new Date().getFullYear();
      
      if (!companyYears[company]) {
        companyYears[company] = new Set();
      }
      companyYears[company].add(year);
    });

    const retentionData = Object.entries(companyYears).map(([company, yearsSet]) => {
      const years = Array.from(yearsSet).sort();
      const companyOffers = applications.filter(app => 
        (app.companyName || app.company) === company && 
        ['selected', 'accepted'].includes(app.status?.toLowerCase())
      ).length;
      
      return {
        companyName: company,
        yearsVisited: years.length,
        firstYear: years[0] || 'Unknown',
        lastYear: years[years.length - 1] || 'Unknown',
        totalOffers: companyOffers
      };
    }).sort((a, b) => b.yearsVisited - a.yearsVisited);

    return {
      title: 'Recruiter Retention Report',
      data: retentionData
    };
  };

  const generateTopHiringDomains = (jobs, applications) => {
    const domains = {};
    
    applications
      .filter(app => ['selected', 'accepted'].includes(app.status?.toLowerCase()))
      .forEach(app => {
        const job = jobs.find(j => j.id === (app.job_id || app.jobId));
        const domain = job?.domain || job?.industry || 'IT'; // Default to IT
        
        domains[domain] = (domains[domain] || 0) + 1;
      });

    const domainData = Object.entries(domains).map(([domain, count]) => ({
      domain,
      offersCount: count,
      percentage: ((count / Object.values(domains).reduce((sum, c) => sum + c, 0)) * 100).toFixed(1)
    })).sort((a, b) => b.offersCount - a.offersCount);

    return {
      title: 'Top Hiring Domains Report',
      data: domainData
    };
  };

  const generateOfferConversionRate = (applications, jobs) => {
    const driveData = {};
    
    jobs.forEach(job => {
      const driveName = job.title || job.position || 'Unknown Drive';
      const jobApps = applications.filter(app => (app.job_id || app.jobId) === job.id);
      
      driveData[driveName] = {
        driveName,
        eligibleCount: job.eligibleStudents || jobApps.length, // Fallback to total applications
        appearedCount: jobApps.length,
        placedCount: jobApps.filter(app => ['selected', 'accepted'].includes(app.status?.toLowerCase())).length
      };
    });

    const conversionData = Object.values(driveData).map(data => ({
      ...data,
      conversionRate: data.appearedCount > 0 ? ((data.placedCount / data.appearedCount) * 100).toFixed(1) : '0'
    }));

    return {
      title: 'Offer Conversion Rate Report',
      data: conversionData
    };
  };

  const generateStudentPerformanceTests = (students, applications) => {
    const performanceData = students.map(student => ({
      studentName: student.name || student.email || 'Unknown',
      rollNumber: student.rollNumber || 'N/A',
      aptitudeScore: student.aptitudeScore || 'N/A',
      codingScore: student.codingScore || 'N/A',
      reasoningScore: student.reasoningScore || 'N/A',
      overallScore: student.overallTestScore || 'N/A'
    })).filter(data => 
      data.aptitudeScore !== 'N/A' || 
      data.codingScore !== 'N/A' || 
      data.reasoningScore !== 'N/A'
    );

    return {
      title: 'Student Performance in Tests',
      data: performanceData
    };
  };

  const generatePreparationEffectiveness = (students, applications) => {
    const effectivenessData = students.map(student => ({
      studentName: student.name || student.email || 'Unknown',
      rollNumber: student.rollNumber || 'N/A',
      mockTestAvg: student.mockTestAverage || 'N/A',
      actualTestScore: student.placementTestScore || 'N/A',
      improvement: student.mockTestAverage && student.placementTestScore 
        ? (student.placementTestScore - student.mockTestAverage).toFixed(1)
        : 'N/A'
    })).filter(data => data.mockTestAvg !== 'N/A' || data.actualTestScore !== 'N/A');

    return {
      title: 'Preparation Effectiveness Report',
      data: effectivenessData
    };
  };

  const generateDriveClashAnalysis = (jobs, applications) => {
    const dateMap = {};
    
    jobs.forEach(job => {
      const date = job.applicationDeadline?.toDate?.()?.toDateString() || 
                   job.driveDate?.toDate?.()?.toDateString() || 
                   'Unknown Date';
      
      if (!dateMap[date]) {
        dateMap[date] = [];
      }
      dateMap[date].push({
        driveName: job.title || job.position || 'Unknown',
        applications: applications.filter(app => (app.job_id || app.jobId) === job.id).length
      });
    });

    const clashData = Object.entries(dateMap)
      .filter(([date, drives]) => drives.length > 1)
      .map(([date, drives]) => {
        const totalApps = drives.reduce((sum, drive) => sum + drive.applications, 0);
        const avgApps = totalApps / drives.length;
        
        return {
          date,
          driveNames: drives.map(d => d.driveName).join(', '),
          totalDrives: drives.length,
          totalApplications: totalApps,
          avgApplicationsPerDrive: avgApps.toFixed(1),
          attendanceDrop: drives.length > 1 ? `${((drives.length - 1) * 15).toFixed(0)}%` : '0%' // Estimated
        };
      });

    return {
      title: 'Drive Clash Analysis',
      data: clashData
    };
  };

  // Export report data to CSV
  const exportToCSV = (reportData) => {
    if (!reportData || !reportData.data || reportData.data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(reportData.data[0]);
    const csvContent = [
      headers.join(','),
      ...reportData.data.map(row => 
        headers.map(header => `"${row[header] || ''}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportData.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Placement Reports</h1>
          <p className="text-gray-600">Generate comprehensive placement reports for analysis and compliance</p>
        </div>
      </div>

      {/* Report Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Object.entries(reportCategories).map(([key, category]) => (
          <div key={key} className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className={`${category.color} text-white p-4 rounded-t-lg`}>
              <div className="flex items-center space-x-3">
                {category.icon}
                <div>
                  <h3 className="font-semibold">{category.title}</h3>
                  <p className="text-sm opacity-90">{category.subtitle}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              {category.reports.map((report) => (
                <div
                  key={report.id}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedReport(report);
                    generateReport(report.id);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-gray-500 mt-1">
                      {report.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-800 text-sm">{report.name}</h4>
                      <p className="text-xs text-gray-600 mt-1">{report.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {report.fields.slice(0, 2).map((field, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {field}
                          </span>
                        ))}
                        {report.fields.length > 2 && (
                          <span className="text-xs text-gray-500">+{report.fields.length - 2} more</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadReport(report.id, 'csv'); }}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100"
                        title="Download CSV"
                      >CSV</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadReport(report.id, 'xlsx'); }}
                        className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100"
                        title="Download XLSX"
                      >XLSX</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Report Display */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Generating report...</span>
          </div>
        </div>
      )}

      {reportData && !loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">{reportData.title}</h2>
                {selectedReport && (
                  <p className="text-gray-600 mt-1">{selectedReport.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportToCSV(reportData)}
                  className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </button>
                <button
                  onClick={() => exportToXLSX(reportData)}
                  className="flex items-center px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export XLSX
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {reportData.message ? (
              <div className="text-center py-8">
                <p className="text-gray-600">{reportData.message}</p>
              </div>
            ) : reportData.data && reportData.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(reportData.data[0]).map((header) => (
                        <th
                          key={header}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {header.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {Object.values(row).map((value, cellIdx) => (
                          <td key={cellIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">No data available for this report</p>
              </div>
            )}

            {/* Summary Statistics */}
            {reportData.summary && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-800 mb-2">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(reportData.summary).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{value}</div>
                      <div className="text-sm text-gray-600">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
