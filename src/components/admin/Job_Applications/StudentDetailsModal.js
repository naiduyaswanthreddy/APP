import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import { PDFDownloadLink } from '@react-pdf/renderer';
import StudentProfilePDF from './StudentProfilePDF';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

// Register ChartJS components
ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title
);

const StudentDetailsModal = ({ student, onClose }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchCompany, setSearchCompany] = useState('');
  const [notes, setNotes] = useState(student.notes || '');
  const [filteredApplications, setFilteredApplications] = useState([]);

  // Status configuration for consistent styling
  const statusConfig = {
    pending: { label: '⏳ Under Review', class: 'bg-gray-100 text-gray-800', color: 'rgba(156, 163, 175, 0.7)' },
    shortlisted: { label: '✅ Shortlisted', class: 'bg-green-100 text-green-800', color: 'rgba(5, 150, 105, 0.7)' },
    waitlisted: { label: '🟡 Waitlisted', class: 'bg-yellow-100 text-yellow-800', color: 'rgba(245, 158, 11, 0.7)' },
    interview_scheduled: { label: '📅 Interview Scheduled', class: 'bg-blue-100 text-blue-800', color: 'rgba(59, 130, 246, 0.7)' },
    selected: { label: '🌟 Selected', class: 'bg-purple-100 text-purple-800', color: 'rgba(139, 92, 246, 0.7)' },
    placed: { label: '🎉 Placed', class: 'bg-blue-100 text-blue-800', color: 'rgba(59, 130, 246, 0.7)' },
    rejected: { label: '⚠️ Rejected', class: 'bg-red-100 text-red-800', color: 'rgba(239, 68, 68, 0.7)' }
  };

  // Filter applications based on status and company search
  useEffect(() => {
    if (!student.applications) return;
    
    let filtered = [...student.applications];
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(app => app.status === filterStatus);
    }
    
    if (searchCompany) {
      const search = searchCompany.toLowerCase();
      filtered = filtered.filter(app => 
        (app.job?.company || '').toLowerCase().includes(search)
      );
    }
    
    setFilteredApplications(filtered);
  }, [student.applications, filterStatus, searchCompany]);

  // Prepare data for pie chart
  const prepareStatusPieData = () => {
    if (!student.analytics?.statusCounts) return null;
    
    const labels = [];
    const data = [];
    const backgroundColor = [];
    
    Object.entries(student.analytics.statusCounts).forEach(([status, count]) => {
      labels.push(statusConfig[status]?.label || status);
      data.push(count);
      backgroundColor.push(statusConfig[status]?.color || 'rgba(156, 163, 175, 0.7)');
    });
    
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderWidth: 1,
        },
      ],
    };
  };

  // Prepare data for applications over time chart
  const prepareApplicationsTimelineData = () => {
    if (!student.applications || student.applications.length === 0) return null;
    
    // Group applications by month
    const applicationsByMonth = {};
    
    student.applications.forEach(app => {
      if (!app.createdAt) return;
      
      let date;
      try {
        // Handle both Firestore timestamp and string date formats
        date = app.createdAt.toDate ? app.createdAt.toDate() : new Date(app.createdAt);
      } catch (e) {
        return;
      }
      
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      applicationsByMonth[monthYear] = (applicationsByMonth[monthYear] || 0) + 1;
    });
    
    // Sort by date
    const sortedMonths = Object.keys(applicationsByMonth).sort((a, b) => {
      const [aMonth, aYear] = a.split('/').map(Number);
      const [bMonth, bYear] = b.split('/').map(Number);
      return aYear === bYear ? aMonth - bMonth : aYear - bYear;
    });
    
    return {
      labels: sortedMonths,
      datasets: [
        {
          label: 'Applications',
          data: sortedMonths.map(month => applicationsByMonth[month]),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
        },
      ],
    };
  };

  // Calculate offer rate
  const calculateOfferRate = () => {
    if (!student.analytics?.statusCounts) return 0;
    
    const offersReceived = student.analytics.statusCounts.selected || 0;
    const totalApplications = student.analytics.totalApplications || 0;
    
    return totalApplications > 0 ? Math.round((offersReceived / totalApplications) * 100) : 0;
  };

  // Handle saving notes
  const handleSaveNotes = async () => {
    try {
      // Get a reference to the student document in Firestore
      const studentRef = doc(db, "students", student.id);
      
      // Update the document with the notes
      await updateDoc(studentRef, {
        notes: notes
      });
      
      // Show success message
      alert('Notes saved successfully!');
    } catch (error) {
      console.error("Error saving notes:", error);
      alert(`Failed to save notes: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 bg-gray-100">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold text-gray-800">{student.name}</h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6 bg-white rounded-t-lg p-2">
            <nav className="-mb-px flex space-x-8 px-4">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-2 px-3 border-b-2 font-medium text-sm rounded-t-lg ${
                  activeTab === 'profile' 
                    ? 'border-blue-500 text-blue-600 bg-blue-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-100'
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`py-2 px-3 border-b-2 font-medium text-sm rounded-t-lg ${
                  activeTab === 'analytics' 
                    ? 'border-blue-500 text-blue-600 bg-blue-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-100'
                }`}
              >
                Analytics
              </button>
              <button
                onClick={() => setActiveTab('applications')}
                className={`py-2 px-3 border-b-2 font-medium text-sm rounded-t-lg ${
                  activeTab === 'applications' 
                    ? 'border-blue-500 text-blue-600 bg-blue-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-100'
                }`}
              >
                Applications
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`py-2 px-3 border-b-2 font-medium text-sm rounded-t-lg ${
                  activeTab === 'notes' 
                    ? 'border-blue-500 text-blue-600 bg-blue-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-100'
                }`}
              >
                Notes
              </button>
            </nav>
          </div>
          
          {/* Content area with white background */}
          <div className="bg-gray p-6 rounded-lg shadow-sm">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-blue-100 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 pl-4 border-l-4 border-blue-500">
                      Personal Information
                    </h3>
                    <div className="space-y-2">
                      <p><span className="font-medium">Roll Number:</span> {student.rollNumber}</p>
                      <p>
                        <span className="font-medium">Email:</span>{' '}
                        <a href={`mailto:${student.email}`} className="text-blue-600 hover:underline">
                          {student.email}
                        </a>
                      </p>
                      <p><span className="font-medium">Phone:</span> {student.mobile}</p>
                      <p><span className="font-medium">Department:</span> {student.department}</p>
                    </div>
                  </div>
                  
                  <div className="bg-purple-100 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 pl-4 border-l-4 border-purple-500">
                      Academic Information
                    </h3>
                    <div className="space-y-2">
                      <p><span className="font-medium">CGPA:</span> {student.cgpa}</p>
                      <p><span className="font-medium">Current Arrears:</span> {student.currentArrears}</p>
                      <p><span className="font-medium">History of Arrears:</span> {student.historyArrears}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mb-6 bg-green-100 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3 pl-4 border-l-4 border-green-500">
                    Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(student.skills) && student.skills.length > 0 ? (
                      student.skills.map((skill, index) => (
                        <a
                          key={index}
                          href={`https://www.google.com/search?q=${encodeURIComponent(skill)}+programming`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-white text-blue-800 rounded-full text-sm border border-blue-200 hover:bg-blue-50 transition-colors"
                        >
                          {skill}
                        </a>
                      ))
                    ) : (
                      <p className="text-gray-500">No skills listed</p>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-end">
                  {student && (
                    <PDFDownloadLink
                      document={<StudentProfilePDF student={student} />}
                      fileName={`${student.name.replace(/\s+/g, '_')}_profile.pdf`}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      {({ loading }) => (loading ? 'Preparing document...' : '📤 Download Profile as PDF')}
                    </PDFDownloadLink>
                  )}
                </div>
              </>
            )}
            
            {/* Rest of the tabs remain the same */}
            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-8">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-medium text-blue-800 mb-1">Total Applications</h4>
                    <p className="text-3xl font-bold text-blue-900">{student.analytics?.totalApplications || 0}</p>
                  </div>
                  
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 className="text-sm font-medium text-purple-800 mb-1">Interviews Scheduled</h4>
                    <p className="text-3xl font-bold text-purple-900">{student.analytics?.statusCounts?.interview_scheduled || 0}</p>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="text-sm font-medium text-green-800 mb-1">Offers Received</h4>
                    <p className="text-3xl font-bold text-green-900">{student.analytics?.statusCounts?.selected || 0}</p>
                  </div>
                </div>
                
                {/* Pie Chart: Application Status */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">📊 Application Status Breakdown</h3>
                  <div className="h-64 flex justify-center">
                    {prepareStatusPieData() ? (
                      <Pie data={prepareStatusPieData()} options={{ maintainAspectRatio: false }} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        No application data available
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Line Chart: Applications Over Time */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">📈 Applications Over Time</h3>
                  <div className="h-64">
                    {prepareApplicationsTimelineData() ? (
                      <Line 
                        data={prepareApplicationsTimelineData()} 
                        options={{ 
                          maintainAspectRatio: false,
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                precision: 0
                              }
                            }
                          }
                        }} 
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        No timeline data available
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Offer Rate */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Offer vs. Application Ratio</h3>
                  <div className="flex items-center justify-center">
                    <div className="relative w-48 h-48">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-4xl font-bold text-blue-600">{calculateOfferRate()}%</p>
                          <p className="text-sm text-gray-500">Offer Rate</p>
                        </div>
                      </div>
                      <svg viewBox="0 0 36 36" className="w-full h-full">
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#eee"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="3"
                          strokeDasharray={`${calculateOfferRate()}, 100`}
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="text-center mt-4 text-sm text-gray-600">
                    {student.analytics?.statusCounts?.selected || 0} offers out of {student.analytics?.totalApplications || 0} applications
                  </div>
                </div>
              </div>
            )}
            
            {/* Applications Tab */}
            {activeTab === 'applications' && (
              <>
                {/* Filters */}
                <div className="mb-6 flex flex-col md:flex-row gap-4">
                  <div className="md:w-1/3">
                    <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                      Filter by Status
                    </label>
                    <select
                      id="status-filter"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="all">All Statuses</option>
                      {Object.entries(statusConfig).map(([value, { label }]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="md:w-2/3">
                    <label htmlFor="company-search" className="block text-sm font-medium text-gray-700 mb-1">
                      Search by Company
                    </label>
                    <input
                      type="text"
                      id="company-search"
                      value={searchCompany}
                      onChange={(e) => setSearchCompany(e.target.value)}
                      placeholder="Enter company name..."
                      className="w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {/* Applications List */}
                {student.applications && filteredApplications.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied On</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredApplications.map((app) => (
                          <tr key={app.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {app.job?.company || 'Unknown Company'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {app.job?.position || 'Unknown Position'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                statusConfig[app.status]?.class || 'bg-gray-100 text-gray-800'
                              }`}>
                                {statusConfig[app.status]?.label || '⏳ Under Review'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {app.createdAt ? new Date(app.createdAt.toDate()).toLocaleDateString() : 'Unknown'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : student.applications ? (
                  <div className="text-center p-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No applications match your filters.</p>
                  </div>
                ) : (
                  <div className="text-center p-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No job applications found for this student.</p>
                  </div>
                )}
              </>
            )}
            
            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Admin Notes</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add private notes about this student. These notes are only visible to administrators.
                </p>
                
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={8}
                  className="w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Add notes about this student..."
                ></textarea>
                
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveNotes}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDetailsModal;