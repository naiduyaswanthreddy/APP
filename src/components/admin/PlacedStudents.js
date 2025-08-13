import React, { useState, useEffect } from 'react';
import { getDocs, collection, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate } from 'react-router-dom';

const PlacedStudents = () => {
  const [placedStudents, setPlacedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newPlaced, setNewPlaced] = useState({
    name: '',
    rollNumber: '',
    department: '',
    batch: '',
    companyName: '',
    jobTitle: '',
    package: '',
    location: '',
    acceptedAt: ''
  });
  const [filters, setFilters] = useState({
    batch: 'all',
    company: 'all',
    department: 'all'
  });
  const DEPARTMENTS = ['CSE','CCE','AIE','EEE','ECE','ME','CE','CHE','MBA','IT'];
  const [stats, setStats] = useState({ total: 0, averagePackage: 0 });

  useEffect(() => {
    fetchPlacedStudents();
  }, [filters]);

  const fetchPlacedStudents = async () => {
    try {
      setLoading(true);
      
      // Query for placed students with enhanced data
      // Note: This query requires a composite index in Firestore:
      // Collection: students
      // Fields: placementStatus (ASC), placedAt (DESC)
      // Create at: https://console.firebase.google.com/project/trail-f142f/firestore/indexes
      const studentsQuery = query(
        collection(db, 'students'),
        where('placementStatus', '==', 'placed'),
        orderBy('placedAt', 'desc')
      );
      
      const placedStudentsQuery = query(
        collection(db, 'placed_students'),
        orderBy('acceptedAt', 'desc')
      );
      
      const [studentsSnapshot, placedStudentsSnapshot] = await Promise.all([
        getDocs(studentsQuery),
        getDocs(placedStudentsQuery)
      ]);
      
      // Combine data from both sources with a unified shape
      let students = [];
      
      // From students collection
      studentsSnapshot.docs.forEach(doc => {
        const studentData = doc.data();
        students.push({
          id: doc.id,
          source: 'students',
          name: studentData.name || '',
          rollNumber: studentData.rollNumber || '',
          batch: studentData.batch || '',
          department: studentData.department || '',
          companyName: studentData.placedCompany || '',
          jobTitle: studentData.placedJobTitle || '',
          package: studentData.placedPackage || '',
          location: studentData.placedLocation || '',
          placedAt: studentData.placedAt || null
        });
      });
      
      // From placed_students collection
      placedStudentsSnapshot.docs.forEach(doc => {
        const placedData = doc.data();
        students.push({
          id: doc.id,
          source: 'placed_students',
          name: placedData.name || '',
          rollNumber: placedData.rollNumber || '',
          batch: placedData.batch || '',
          department: placedData.department || '',
          companyName: placedData.companyName || '',
          jobTitle: placedData.jobTitle || '',
          package: placedData.package || '',
          location: placedData.location || '',
          placedAt: placedData.acceptedAt || placedData.placedAt || null
        });
      });

      // Apply filters
      if (filters.batch !== 'all') {
        students = students.filter(student => student.batch === filters.batch);
      }
      if (filters.department !== 'all') {
        students = students.filter(student => student.department === filters.department);
      }
      if (filters.company !== 'all') {
        students = students.filter(student => student.companyName === filters.company);
      }

      // Get unique companies for filter
      const companies = [...new Set(students.map(s => s.companyName).filter(Boolean))];
      const departments = [...new Set(students.map(s => s.department).filter(Boolean))];
      const batches = [...new Set(students.map(s => s.batch).filter(Boolean))];

      // Compute stats (total and average package)
      const numericPackages = students
        .map(s => {
          if (typeof s.package === 'number') return s.package;
          if (typeof s.package === 'string') {
            const match = s.package.replace(/[,₹]/g, '').match(/\d+(\.\d+)?/);
            return match ? parseFloat(match[0]) : 0;
          }
          return 0;
        })
        .filter(n => !isNaN(n) && n > 0);
      const averagePackage = numericPackages.length
        ? Math.round((numericPackages.reduce((a, b) => a + b, 0) / numericPackages.length) * 100) / 100
        : 0;

      setPlacedStudents(students);
      setCompanies(companies);
      setDepartments(departments);
      setBatches(batches);
      setStats({ total: students.length, averagePackage });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching placed students:', error);
      setLoading(false);
    }
  };

  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Placed Students</h1>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">Total: {stats.total}</div>
          <div className="text-sm text-gray-600">Avg Package: ₹{stats.averagePackage.toLocaleString()}</div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Placed Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Batch</label>
            <select
              value={filters.batch}
              onChange={(e) => setFilters({...filters, batch: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="all">All Batches</option>
              {batches.map(batch => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Company</label>
            <select
              value={filters.company}
              onChange={(e) => setFilters({...filters, company: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="all">All Companies</option>
              {companies.map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Department</label>
            <select
              value={filters.department}
              onChange={(e) => setFilters({...filters, department: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTC/Stipend</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placed Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {placedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.rollNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.department}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.batch}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.jobTitle}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.companyName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.package}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.placedAt?.toDate ? student.placedAt.toDate().toLocaleDateString() : (student.placedAt ? new Date(student.placedAt).toLocaleDateString() : '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Add Placed Student</h2>
              <button className="text-gray-500" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input className="w-full border rounded p-2" value={newPlaced.name} onChange={e=>setNewPlaced({...newPlaced,name:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Roll Number</label>
                <input className="w-full border rounded p-2" value={newPlaced.rollNumber} onChange={e=>setNewPlaced({...newPlaced,rollNumber:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Department</label>
                <select className="w-full border rounded p-2" value={newPlaced.department} onChange={e=>setNewPlaced({...newPlaced,department:e.target.value})}>
                  <option value="">Select</option>
                  {DEPARTMENTS.map(d=> (<option key={d} value={d}>{d}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Batch</label>
                <input className="w-full border rounded p-2" placeholder="e.g., 2025" value={newPlaced.batch} onChange={e=>setNewPlaced({...newPlaced,batch:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Company</label>
                <input className="w-full border rounded p-2" value={newPlaced.companyName} onChange={e=>setNewPlaced({...newPlaced,companyName:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Job Title</label>
                <input className="w-full border rounded p-2" value={newPlaced.jobTitle} onChange={e=>setNewPlaced({...newPlaced,jobTitle:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Package (annual)</label>
                <input className="w-full border rounded p-2" type="number" step="0.01" value={newPlaced.package} onChange={e=>setNewPlaced({...newPlaced,package:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Location</label>
                <input className="w-full border rounded p-2" value={newPlaced.location} onChange={e=>setNewPlaced({...newPlaced,location:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Placed Date</label>
                <input className="w-full border rounded p-2" type="date" value={newPlaced.acceptedAt} onChange={e=>setNewPlaced({...newPlaced,acceptedAt:e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button className="px-4 py-2 border rounded" onClick={()=>setShowAddModal(false)}>Cancel</button>
              <button
                disabled={adding}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={async ()=>{
                  if(!newPlaced.name||!newPlaced.rollNumber||!newPlaced.department||!newPlaced.batch||!newPlaced.companyName||!newPlaced.jobTitle){
                    alert('Please fill all required fields');
                    return;
                  }
                  try{
                    setAdding(true);
                    await addDoc(collection(db,'placed_students'),{
                      ...newPlaced,
                      package: newPlaced.package ? parseFloat(newPlaced.package) : '',
                      acceptedAt: newPlaced.acceptedAt ? new Date(newPlaced.acceptedAt) : serverTimestamp(),
                      status: 'active',
                      source: 'manual',
                      createdAt: serverTimestamp()
                    });
                    setShowAddModal(false);
                    setNewPlaced({ name:'', rollNumber:'', department:'', batch:'', companyName:'', jobTitle:'', package:'', location:'', acceptedAt:''});
                    fetchPlacedStudents();
                  }catch(err){
                    console.error('Error adding placed student', err);
                    alert('Failed to add placed student');
                  }finally{
                    setAdding(false);
                  }
                }}
              >
                {adding? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlacedStudents;
