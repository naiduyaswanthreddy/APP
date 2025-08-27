import React, { useState, useEffect } from 'react';
import { getDocs, collection, query, where, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const PlacedStudents = () => {
  const [placedStudents, setPlacedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
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
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => {
    fetchPlacedStudents();
  }, [filters]);

  const fetchPlacedStudents = async () => {
    try {
      setLoading(true);
      
      // Query for placed students with enhanced data
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
      
      // Combine data from both sources with a unified shape and deduplicate
      let students = [];
      const seenRollNumbers = new Set();
      
      // From students collection (prioritize this source)
      studentsSnapshot.docs.forEach(doc => {
        const studentData = doc.data();
        const rollNumber = studentData.rollNumber || '';
        
        if (rollNumber && !seenRollNumbers.has(rollNumber)) {
          seenRollNumbers.add(rollNumber);
          students.push({
            id: doc.id,
            source: 'students',
            name: studentData.name || '',
            rollNumber: rollNumber,
            batch: studentData.batch || studentData.passoutYear || studentData.graduationYear || '',
            department: studentData.department || '',
            companyName: studentData.placedCompany || '',
            jobTitle: studentData.placedJobTitle || '',
            package: studentData.placedPackage || '',
            location: studentData.placedLocation || '',
            placedAt: studentData.placedAt || null
          });
        }
      });
      
      // From placed_students collection (only add if not already seen)
      placedStudentsSnapshot.docs.forEach(doc => {
        const placedData = doc.data();
        const rollNumber = placedData.rollNumber || '';
        
        if (rollNumber && !seenRollNumbers.has(rollNumber)) {
          seenRollNumbers.add(rollNumber);
          students.push({
            id: doc.id,
            source: 'placed_students',
            name: placedData.name || '',
            rollNumber: rollNumber,
            batch: placedData.batch || placedData.passoutYear || placedData.graduationYear || '',
            department: placedData.department || '',
            companyName: placedData.companyName || '',
            jobTitle: placedData.jobTitle || '',
            package: placedData.package || '',
            location: placedData.location || '',
            placedAt: placedData.acceptedAt || placedData.placedAt || null
          });
        }
      });

      // Apply filters
      let filteredStudents = [...students];
      
      if (filters.batch !== 'all') {
        filteredStudents = filteredStudents.filter(student => student.batch === filters.batch);
      }
      if (filters.department !== 'all') {
        filteredStudents = filteredStudents.filter(student => student.department === filters.department);
      }
      if (filters.company !== 'all') {
        filteredStudents = filteredStudents.filter(student => student.companyName === filters.company);
      }

      // Get unique values for filters
      const uniqueCompanies = [...new Set(students.map(s => s.companyName).filter(Boolean))];
      const uniqueDepartments = [...new Set(students.map(s => s.department).filter(Boolean))];
      const uniqueBatches = [...new Set(students.map(s => s.batch).filter(Boolean))];

      // Compute stats
      const numericPackages = filteredStudents
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

      setPlacedStudents(filteredStudents);
      setCompanies(uniqueCompanies);
      setDepartments(uniqueDepartments);
      setBatches(uniqueBatches);
      setStats({ total: filteredStudents.length, averagePackage });
      setLoading(false);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error fetching placed students:', error);
      setLoading(false);
    }
  };

  const handleEdit = (student) => {
    setEditingStudent({
      ...student,
      acceptedAt: student.placedAt?.toDate ? 
        student.placedAt.toDate().toISOString().split('T')[0] : 
        (student.placedAt ? new Date(student.placedAt).toISOString().split('T')[0] : '')
    });
    setShowEditModal(true);
  };

  const handleDelete = async (studentId, source) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        if (source === 'placed_students') {
          await deleteDoc(doc(db, 'placed_students', studentId));
        } else {
          // For students collection, we might want to update placementStatus instead
          await updateDoc(doc(db, 'students', studentId), {
            placementStatus: 'not_placed',
            placedCompany: '',
            placedJobTitle: '',
            placedPackage: '',
            placedLocation: ''
          });
        }
        fetchPlacedStudents();
      } catch (error) {
        console.error('Error deleting record:', error);
        alert('Failed to delete record');
      }
    }
  };

  const handleUpdate = async () => {
    if (!editingStudent) return;

    try {
      setUpdating(true);
      
      const updateData = {
        name: editingStudent.name,
        rollNumber: editingStudent.rollNumber,
        department: editingStudent.department,
        batch: editingStudent.batch,
        companyName: editingStudent.companyName,
        jobTitle: editingStudent.jobTitle,
        package: editingStudent.package ? parseFloat(editingStudent.package) : '',
        location: editingStudent.location,
        acceptedAt: editingStudent.acceptedAt ? new Date(editingStudent.acceptedAt) : serverTimestamp()
      };

      if (editingStudent.source === 'placed_students') {
        await updateDoc(doc(db, 'placed_students', editingStudent.id), updateData);
      } else {
        // Update students collection
        await updateDoc(doc(db, 'students', editingStudent.id), {
          name: editingStudent.name,
          rollNumber: editingStudent.rollNumber,
          department: editingStudent.department,
          batch: editingStudent.batch,
          passoutYear: editingStudent.batch,
          placedCompany: editingStudent.companyName,
          placedJobTitle: editingStudent.jobTitle,
          placedPackage: editingStudent.package,
          placedLocation: editingStudent.location,
          placedAt: editingStudent.acceptedAt ? new Date(editingStudent.acceptedAt) : serverTimestamp()
        });
      }

      setShowEditModal(false);
      setEditingStudent(null);
      fetchPlacedStudents();
    } catch (error) {
      console.error('Error updating record:', error);
      alert('Failed to update record');
    } finally {
      setUpdating(false);
    }
  };

  const downloadExcel = () => {
    const exportData = placedStudents.map(student => ({
      'Name': student.name,
      'Roll Number': student.rollNumber,
      'Department': student.department,
      'Batch': student.batch,
      'Company': student.companyName,
      'Job Title': student.jobTitle,
      'Package (LPA)': student.package,
      'Location': student.location,
      'Placed Date': student.placedAt?.toDate ? 
        student.placedAt.toDate().toLocaleDateString() : 
        (student.placedAt ? new Date(student.placedAt).toLocaleDateString() : '-')
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Placed Students');
    
    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, Math.max(...exportData.map(row => String(row[key] || '').length)))
    }));
    worksheet['!cols'] = colWidths;
    
    XLSX.writeFile(workbook, `placed-students-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const resetFilters = () => {
    setFilters({
      batch: 'all',
      company: 'all',
      department: 'all'
    });
  };

  // Pagination calculations
  const total = placedStudents.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, total);
  const visibleStudents = placedStudents.slice(startIndex, endIndex);

  return (
    <div className="p-6 space-y-6">
      <div>
        <button
          onClick={() => window.history.back()}
          className="mb-4 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
        >
          ← Back to Analytics
        </button>
      </div>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Placed Students</h1>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">Total: {stats.total}</div>
          <div className="text-sm text-gray-600">Avg Package: ₹{stats.averagePackage.toLocaleString()}</div>
          <button
            onClick={downloadExcel}
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Download Excel
          </button>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              Reset Filters
            </button>
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
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTC/Stipend</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placed Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visibleStudents.map((student) => (
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(student)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(student.id, student.source)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination controls */}
          <div className="flex items-center justify-between px-6 py-3 border-t bg-white">
            <div className="text-sm text-gray-600">
              Showing {total === 0 ? 0 : startIndex + 1}-{endIndex} of {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Add Placed Student</h2>
              <button className="text-gray-500" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Name *</label>
                <input className="w-full border rounded p-2" value={newPlaced.name} onChange={e=>setNewPlaced({...newPlaced,name:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Roll Number *</label>
                <input className="w-full border rounded p-2" value={newPlaced.rollNumber} onChange={e=>setNewPlaced({...newPlaced,rollNumber:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Department *</label>
                <select className="w-full border rounded p-2" value={newPlaced.department} onChange={e=>setNewPlaced({...newPlaced,department:e.target.value})}>
                  <option value="">Select</option>
                  {DEPARTMENTS.map(d=> (<option key={d} value={d}>{d}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Batch *</label>
                <input className="w-full border rounded p-2" placeholder="e.g., 2025" value={newPlaced.batch} onChange={e=>setNewPlaced({...newPlaced,batch:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Company *</label>
                <input className="w-full border rounded p-2" value={newPlaced.companyName} onChange={e=>setNewPlaced({...newPlaced,companyName:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Job Title *</label>
                <input className="w-full border rounded p-2" value={newPlaced.jobTitle} onChange={e=>setNewPlaced({...newPlaced,jobTitle:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Package (annual in LPA)</label>
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

      {/* Edit Modal */}
      {showEditModal && editingStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Edit Placed Student</h2>
              <button className="text-gray-500" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Name *</label>
                <input 
                  className="w-full border rounded p-2" 
                  value={editingStudent.name} 
                  onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Roll Number *</label>
                <input 
                  className="w-full border rounded p-2" 
                  value={editingStudent.rollNumber} 
                  onChange={e => setEditingStudent({...editingStudent, rollNumber: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Department *</label>
                <select 
                  className="w-full border rounded p-2" 
                  value={editingStudent.department} 
                  onChange={e => setEditingStudent({...editingStudent, department: e.target.value})}
                >
                  <option value="">Select</option>
                  {DEPARTMENTS.map(d => (<option key={d} value={d}>{d}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Batch *</label>
                <input 
                  className="w-full border rounded p-2" 
                  placeholder="e.g., 2025" 
                  value={editingStudent.batch} 
                  onChange={e => setEditingStudent({...editingStudent, batch: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Company *</label>
                <input 
                  className="w-full border rounded p-2" 
                  value={editingStudent.companyName} 
                  onChange={e => setEditingStudent({...editingStudent, companyName: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Job Title *</label>
                <input 
                  className="w-full border rounded p-2" 
                  value={editingStudent.jobTitle} 
                  onChange={e => setEditingStudent({...editingStudent, jobTitle: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Package (annual in LPA)</label>
                <input 
                  className="w-full border rounded p-2" 
                  type="number" 
                  step="0.01" 
                  value={editingStudent.package} 
                  onChange={e => setEditingStudent({...editingStudent, package: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Location</label>
                <input 
                  className="w-full border rounded p-2" 
                  value={editingStudent.location} 
                  onChange={e => setEditingStudent({...editingStudent, location: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Placed Date</label>
                <input 
                  className="w-full border rounded p-2" 
                  type="date" 
                  value={editingStudent.acceptedAt} 
                  onChange={e => setEditingStudent({...editingStudent, acceptedAt: e.target.value})} 
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button className="px-4 py-2 border rounded" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button
                disabled={updating}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={handleUpdate}
              >
                {updating ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlacedStudents;
