import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// Replace StudentDetailsModal import with Profile import
import Profile from './Student_Profile/Profile';
import Loader from '../../loading'; // Add this import at the top


const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      const studentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        skills: doc.data().skills || [], // Ensure skills is always an array
        applications: doc.data().applications || [], // Also add applications array for the modal
        notes: doc.data().notes || '' // Add notes field for the modal
      }));
      setStudents(studentsData);
    } catch (error) {
      toast.error('Failed to fetch students');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = departmentFilter === 'all' || student.department === departmentFilter;
    
    return matchesSearch && matchesDepartment;
  });

  // Updated handleStudentClick function to fetch applications and analytics
  const handleStudentClick = async (student) => {
    // Make sure skills is always an array before setting the selected student
    const studentWithValidSkills = {
      ...student,
      skills: Array.isArray(student.skills) ? student.skills : [],
      // Ensure these fields exist with proper names
      mobile: student.mobile || student.phone || '',
      historyArrears: student.historyArrears || student.history_arrears || '0',
      currentArrears: student.currentArrears || student.current_arrears || '0'
    };
    
    try {
      // Fetch all applications for this student
      const applicationsRef = collection(db, "applications");
      // Prefer rollNumber if available
      const q = student.rollNumber
        ? query(applicationsRef, where("student_rollNumber", "==", student.rollNumber))
        : query(applicationsRef, where("student_id", "==", student.id));
      const querySnapshot = await getDocs(q);
      
      const studentApplications = [];
      
      // Process each application and get job details
      await Promise.all(querySnapshot.docs.map(async (appDoc) => {
        const appData = { id: appDoc.id, ...appDoc.data() };
        
        // Fetch job details for this application
        try {
          const jobId = appData.jobId || appData.job_id;
          if (jobId) {
            const jobRef = doc(db, "jobs", jobId);
            const jobSnap = await getDoc(jobRef);
            
            if (jobSnap.exists()) {
              appData.job = {
                id: jobSnap.id,
                ...jobSnap.data()
              };
            }
          }
        } catch (error) {
          console.error("Error fetching job details:", error);
        }
        
        studentApplications.push(appData);
      }));
      
      // Add applications data and analytics to student object
      studentWithValidSkills.applications = studentApplications;
      
      // Calculate analytics
      const statusCounts = studentApplications.reduce((acc, app) => {
        const status = app.status || 'pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      
      studentWithValidSkills.analytics = {
        totalApplications: studentApplications.length,
        statusCounts
      };
      
      setSelectedStudent(studentWithValidSkills);
    } catch (error) {
      console.error("Error fetching student applications:", error);
      toast.error("Failed to load student application data");
      setSelectedStudent(studentWithValidSkills);
    }
  };

  return (
    <div className="p-6">
      <ToastContainer />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Students Directory</h1>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by name, roll number, or email"
            className="p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="all">All Departments</option>
            <option value="CSE">CSE</option>
            <option value="IT">IT</option>
            <option value="ECE">ECE</option>
            <option value="EEE">EEE</option>
            <option value="ME">ME</option>
            <option value="CE">CE</option>
            <option value="CHE">CHE</option>
            <option value="AIE">AIE</option>
            <option value="CCE">CCE</option>
            <option value="MBA">MBA</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="fixed top-0 left-[20%] right-0 bottom-0 bg-gray-200 bg-opacity-10 flex items-center justify-center z-50">
        <Loader />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-teal-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                    onClick={() => handleStudentClick(student)}
                  >
                    {student.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.rollNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.department}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.passoutYear}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.mobile}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Replace StudentDetailsModal with Profile */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-end p-4">
              <button 
                onClick={() => setSelectedStudent(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <Profile studentData={selectedStudent} isAdminView={true} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;
