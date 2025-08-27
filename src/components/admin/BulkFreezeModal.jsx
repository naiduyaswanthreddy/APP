import React, { useState, useRef } from 'react';
import { X, Upload, Users, AlertTriangle, Check, Clock, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import { parseRolls, parseCSVRolls } from '../../utils/parseRolls';
import { resolveStudentsByRoll, freezeStudents, unfreezeStudents } from '../../utils/freezeService';

const BulkFreezeModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1); // 1: Input, 2: Preview, 3: Action, 4: Results
  const [rollInput, setRollInput] = useState('');
  const [students, setStudents] = useState({ found: [], missing: [], duplicates: [] });
  const [action, setAction] = useState('freeze'); // 'freeze' or 'unfreeze'
  const [formData, setFormData] = useState({
    reason: '',
    category: 'other',
    notes: '',
    from: new Date().toISOString().slice(0, 16),
    until: '',
    notifyPush: true,
    notifyEmail: false
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);

  const categories = [
    { value: 'discipline', label: 'Discipline' },
    { value: 'documents', label: 'Documents' },
    { value: 'attendance', label: 'Attendance' },
    { value: 'fee', label: 'Fee' },
    { value: 'other', label: 'Other' }
  ];

  const reasonPresets = [
    'Pending document submission',
    'Disciplinary action',
    'Fee payment pending',
    'Attendance below minimum',
    'Academic performance',
    'Administrative hold'
  ];

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvContent = e.target.result;
        const rolls = parseCSVRolls(csvContent, true);
        setRollInput(rolls.join('\n'));
      } catch (error) {
        toast.error('Error reading CSV file');
      }
    };
    reader.readAsText(file);
  };

  const handleResolveStudents = async () => {
    if (!rollInput.trim()) {
      toast.error('Please enter roll numbers');
      return;
    }

    setLoading(true);
    try {
      const rolls = parseRolls(rollInput);
      const resolved = await resolveStudentsByRoll(rolls);
      setStudents(resolved);
      setStep(2);
    } catch (error) {
      toast.error('Error resolving students');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const removeStudent = (rollNumber) => {
    setStudents(prev => ({
      ...prev,
      found: prev.found.filter(s => s.rollNumber !== rollNumber)
    }));
  };

  const addRollNumber = (roll) => {
    if (roll && !students.found.some(s => s.rollNumber === roll)) {
      setRollInput(prev => prev + '\n' + roll);
    }
  };

  const handleExecute = async () => {
    if (!formData.reason.trim()) {
      toast.error('Reason is required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        reason: formData.reason,
        category: formData.category,
        notes: formData.notes,
        from: new Date(formData.from),
        until: formData.until ? new Date(formData.until) : null,
        updateExisting: true
      };

      const notifyOpts = {
        push: formData.notifyPush,
        email: formData.notifyEmail
      };

      let result;
      if (action === 'freeze') {
        result = await freezeStudents(students.found, payload, notifyOpts);
      } else {
        result = await unfreezeStudents(students.found, payload, notifyOpts);
      }

      setResults(result);
      setStep(4);
      toast.success(`${action === 'freeze' ? 'Freeze' : 'Unfreeze'} operation completed`);
    } catch (error) {
      toast.error(`Error during ${action} operation`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportResults = () => {
    if (!results) return;

    const csvContent = [
      ['Roll Number', 'Name', 'Status', 'Message'].join(','),
      ...results.results.map(r => [
        r.rollNumber,
        students.found.find(s => s.rollNumber === r.rollNumber)?.name || 'Unknown',
        r.status,
        r.message
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_${action}_results_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStep(1);
    setRollInput('');
    setStudents({ found: [], missing: [], duplicates: [] });
    setAction('freeze');
    setFormData({
      reason: '',
      category: 'other',
      notes: '',
      from: new Date().toISOString().slice(0, 16),
      until: '',
      notifyPush: true,
      notifyEmail: false
    });
    setResults(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Bulk Freeze/Unfreeze Students</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* Step Indicator */}
          <div className="flex items-center mb-6">
            {[1, 2, 3, 4].map(num => (
              <div key={num} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= num ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {num}
                </div>
                {num < 4 && <div className={`w-12 h-0.5 ${step > num ? 'bg-blue-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Input */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Enter Roll Numbers</h3>
              
              <div className="space-y-2">
                <textarea
                  value={rollInput}
                  onChange={(e) => setRollInput(e.target.value)}
                  placeholder="Enter roll numbers (space or comma separated)"
                  className="w-full h-32 p-3 border rounded-lg resize-none"
                />
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                  >
                    <Upload size={16} />
                    Upload CSV
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <button
                onClick={handleResolveStudents}
                disabled={loading || !rollInput.trim()}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Resolving...' : 'Resolve Students'}
              </button>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Student Preview</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-green-800 font-medium">Found: {students.found.length}</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-red-800 font-medium">Missing: {students.missing.length}</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="text-yellow-800 font-medium">Duplicates: {students.duplicates.length}</div>
                </div>
              </div>

              {students.found.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Roll</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Dept</th>
                        <th className="px-4 py-2 text-left">Batch</th>
                        <th className="px-4 py-2 text-left">Current Freeze</th>
                        <th className="px-4 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.found.map(student => (
                        <tr key={student.id} className="border-t">
                          <td className="px-4 py-2">{student.rollNumber}</td>
                          <td className="px-4 py-2">{student.name}</td>
                          <td className="px-4 py-2">{student.department}</td>
                          <td className="px-4 py-2">{student.batch}</td>
                          <td className="px-4 py-2">
                            {student.currentFreeze?.active ? (
                              <span className="text-red-600">Yes - {student.currentFreeze.reason}</span>
                            ) : (
                              <span className="text-green-600">No</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => removeStudent(student.rollNumber)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={students.found.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Action */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Configure Action</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Action</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="freeze"
                        checked={action === 'freeze'}
                        onChange={(e) => setAction(e.target.value)}
                        className="mr-2"
                      />
                      Freeze
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="unfreeze"
                        checked={action === 'unfreeze'}
                        onChange={(e) => setAction(e.target.value)}
                        className="mr-2"
                      />
                      Unfreeze
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Reason *</label>
                  <div className="space-y-2">
                    <select
                      value={formData.reason}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                      className="w-full p-2 border rounded-lg"
                    >
                      <option value="">Select preset or type custom...</option>
                      {reasonPresets.map(preset => (
                        <option key={preset} value={preset}>{preset}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={formData.reason}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Custom reason"
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>

                {action === 'freeze' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full p-2 border rounded-lg"
                      >
                        {categories.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">From</label>
                        <input
                          type="datetime-local"
                          value={formData.from}
                          onChange={(e) => setFormData(prev => ({ ...prev, from: e.target.value }))}
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Until (optional)</label>
                        <input
                          type="datetime-local"
                          value={formData.until}
                          onChange={(e) => setFormData(prev => ({ ...prev, until: e.target.value }))}
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full p-2 border rounded-lg h-20 resize-none"
                    placeholder="Additional notes..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Notifications</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.notifyPush}
                        onChange={(e) => setFormData(prev => ({ ...prev, notifyPush: e.target.checked }))}
                        className="mr-2"
                      />
                      Send push notification
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.notifyEmail}
                        onChange={(e) => setFormData(prev => ({ ...prev, notifyEmail: e.target.checked }))}
                        className="mr-2"
                      />
                      Send email notification
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Summary</h4>
                <p>{students.found.length} students will be {action}d</p>
                {students.missing.length > 0 && (
                  <p className="text-red-600">{students.missing.length} roll numbers not found</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleExecute}
                  disabled={loading || !formData.reason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : `${action === 'freeze' ? 'Freeze' : 'Unfreeze'} Students`}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Results */}
          {step === 4 && results && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Operation Results</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Check className="text-green-600" size={20} />
                    <span className="text-green-800 font-medium">Successful: {results.successful}</span>
                  </div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-red-600" size={20} />
                    <span className="text-red-800 font-medium">Failed: {results.failed}</span>
                  </div>
                </div>
              </div>

              {results.results.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Roll Number</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.results.map((result, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-4 py-2">{result.rollNumber}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              result.status === 'success' ? 'bg-green-100 text-green-800' :
                              result.status === 'error' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {result.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">{result.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={exportResults}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Download size={16} />
                  Export CSV
                </button>
                <button
                  onClick={reset}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  New Operation
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkFreezeModal;
