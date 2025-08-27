import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { toast } from 'react-toastify';
import { 
  AlertTriangle, 
  User, 
  Calendar, 
  Clock, 
  Search, 
  Filter,
  Download,
  Unlock,
  Eye,
  X
} from 'lucide-react';
import { unfreezeStudents } from '../../utils/freezeService';

const FrozenStudents = ({ isOpen, onClose }) => {
  const [frozenStudents, setFrozenStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchFrozenStudents = async () => {
    setLoading(true);
    try {
      const studentsRef = collection(db, 'students');
      const q = query(studentsRef, where('freezed.active', '==', true));
      const snapshot = await getDocs(q);
      
      const students = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        students.push({
          id: doc.id,
          ...data,
          freezed: data.freezed || {}
        });
      });

      // Sort by freeze date (most recent first)
      students.sort((a, b) => {
        const aDate = a.freezed.from?.toDate() || new Date(0);
        const bDate = b.freezed.from?.toDate() || new Date(0);
        return bDate - aDate;
      });

      setFrozenStudents(students);
    } catch (error) {
      console.error('Error fetching frozen students:', error);
      toast.error('Failed to fetch frozen students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFrozenStudents();
    }
  }, [isOpen]);

  const handleUnfreeze = async (student) => {
    try {
      const reason = prompt('Please provide a reason for unfreezing:');
      if (!reason || !reason.trim()) return;

      // Build a minimal student object expected by unfreezeStudents()
      const studentPayload = [{
        id: student.id,
        rollNumber: student.rollNumber || 'UNKNOWN',
        batch: student.batch || '',
        department: student.department || '',
        currentFreeze: {
          active: true,
          freezeHistory: student.freezeHistory || []
        }
      }];

      await unfreezeStudents(studentPayload, { reason: reason.trim() }, { push: true });

      toast.success(`${student.name} has been unfrozen successfully`);
      fetchFrozenStudents(); // Refresh the list
    } catch (error) {
      console.error('Error unfreezing student:', error);
      toast.error('Failed to unfreeze student: ' + error.message);
    }
  };

  const exportToCSV = () => {
    const csvData = filteredStudents.map(student => ({
      'Roll Number': student.rollNumber || 'N/A',
      'Name': student.name || 'N/A',
      'Email': student.email || 'N/A',
      'Reason': student.freezed.reason || 'N/A',
      'Category': student.freezed.category || 'N/A',
      'Frozen By': student.freezed.byName || 'N/A',
      'Frozen Date': student.freezed.from ? new Date(student.freezed.from.toDate()).toLocaleDateString() : 'N/A',
      'Until Date': student.freezed.until ? new Date(student.freezed.until.toDate()).toLocaleDateString() : 'Indefinite',
      'Notes': student.freezed.notes || 'N/A'
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frozen-students-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredStudents = frozenStudents.filter(student => {
    const matchesSearch = !searchTerm || 
      student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || 
      student.freezed.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(frozenStudents.map(s => s.freezed.category).filter(Boolean))];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-red-600" size={24} />
              <h2 className="text-xl font-semibold text-red-800">
                Frozen Students ({filteredStudents.length})
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              <X size={20} />
            </button>
          </div>

          {/* Search and Filters */}
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by name, roll number, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
            <button
              onClick={exportToCSV}
              disabled={filteredStudents.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              <span className="ml-3 text-gray-600">Loading frozen students...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                {frozenStudents.length === 0 ? 'No Frozen Students' : 'No Results Found'}
              </h3>
              <p className="text-gray-500">
                {frozenStudents.length === 0 
                  ? 'All students are currently active and can apply for jobs.'
                  : 'Try adjusting your search or filter criteria.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStudents.map(student => (
                <div key={student.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="text-red-600" size={16} />
                        <h3 className="font-semibold text-gray-900">
                          {student.name || 'Unknown Name'}
                        </h3>
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                          {student.freezed.category || 'General'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600">Roll Number:</span>
                          <div className="text-gray-800">{student.rollNumber || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Email:</span>
                          <div className="text-gray-800">{student.email || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Reason:</span>
                          <div className="text-gray-800">{student.freezed.reason}</div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Frozen By:</span>
                          <div className="text-gray-800">{student.freezed.byName}</div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Frozen Date:</span>
                          <div className="text-gray-800">
                            {student.freezed.from ? new Date(student.freezed.from.toDate()).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Until:</span>
                          <div className="text-gray-800">
                            {student.freezed.until ? new Date(student.freezed.until.toDate()).toLocaleDateString() : 'Indefinite'}
                          </div>
                        </div>
                      </div>

                      {student.freezed.notes && (
                        <div className="mt-3 p-3 bg-white border border-red-200 rounded">
                          <span className="font-medium text-gray-600">Notes:</span>
                          <div className="text-gray-800 mt-1">{student.freezed.notes}</div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowDetails(true);
                        }}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 flex items-center gap-1"
                      >
                        <Eye size={14} />
                        Details
                      </button>
                      <button
                        onClick={() => handleUnfreeze(student)}
                        className="px-3 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 flex items-center gap-1"
                      >
                        <Unlock size={14} />
                        Unfreeze
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Student Details Modal */}
      {showDetails && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-blue-800">
                  Student Details - {selectedStudent.name}
                </h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-600">Name:</span>
                    <div className="text-gray-800">{selectedStudent.name || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Roll Number:</span>
                    <div className="text-gray-800">{selectedStudent.rollNumber || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Email:</span>
                    <div className="text-gray-800">{selectedStudent.email || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Batch:</span>
                    <div className="text-gray-800">{selectedStudent.batch || 'N/A'}</div>
                  </div>
                </div>

                {/* Freeze History */}
                {selectedStudent.freezeHistory && selectedStudent.freezeHistory.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-800 mb-3">Freeze History</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {selectedStudent.freezeHistory.slice().reverse().map((entry, index) => (
                        <div key={index} className="bg-gray-50 border rounded-lg p-3 text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              entry.action === 'freeze' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {entry.action.toUpperCase()}
                            </span>
                            <span className="text-gray-500">
                              {entry.at ? new Date(entry.at.toDate()).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="font-medium text-gray-600">Reason:</span>
                              <div className="text-gray-800">{entry.reason}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">By:</span>
                              <div className="text-gray-800">{entry.byName}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FrozenStudents;
