import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Send, User, MessageSquare, Pin, Download, Filter, Search, X } from 'lucide-react';
import jsPDF from 'jspdf';
import { CSVLink } from 'react-csv';

const AdminChat = ({ jobId: propJobId, onClose }) => {
  const { jobId: paramJobId } = useParams();
  const jobId = propJobId || paramJobId;
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);
  const [viewAllChats, setViewAllChats] = useState(true); // Default to all chats
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [messageFilter, setMessageFilter] = useState('all');
  const [messageSearch, setMessageSearch] = useState('');
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    console.log('AdminChat mounted with jobId:', jobId);
    if (jobId) {
      fetchStudentsWithChats();
      fetchApplications();
      fetchPinnedMessages();
    } else {
      setLoading(false);
      setError('No job ID provided. Please select a job.');
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [jobId]);

  // Toggle between single-student chat and all chats
  const handleViewModeChange = (mode) => {
    if (!selectedJob) return;
    const nextIsAll = mode === 'all';
    setViewAllChats(nextIsAll);
    if (nextIsAll) {
      // Switching to All: clear selected student and load all messages
      setSelectedStudent(null);
      loadMessages(selectedJob.id, null);
    } else {
      // Switching to Single: keep current selected student if any
      loadMessages(selectedJob.id, selectedStudent?.id || null);
    }
  };

  useEffect(() => {
    if (jobId && jobs.length > 0) {
      const job = jobs.find(j => j.id === jobId);
      setSelectedJob(job);
      loadMessages(jobId, null); // Load all messages for the job
    }
  }, [jobId, jobs]);

  const fetchApplications = async () => {
    if (!jobId) return;
    try {
      const applicationsRef = collection(db, 'applications');
      const q = query(applicationsRef, where('jobId', '==', jobId));
      const snapshot = await getDocs(q);
      const applicationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setApplications(applicationsData);
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  const fetchPinnedMessages = async () => {
    if (!jobId) return;
    try {
      const pinnedRef = collection(db, 'pinnedMessages');
      const q = query(pinnedRef, where('jobId', '==', jobId));
      const snapshot = await getDocs(q);
      const pinnedData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPinnedMessages(pinnedData);
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
    }
  };

  const fetchStudentsWithChats = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching students with chats for jobId:', jobId);

      if (!jobId) {
        throw new Error('No job ID provided');
      }

      // Fetch all chat messages for the current job
      const messagesRef = collection(db, 'jobChats');
      const q = query(messagesRef, where('jobId', '==', jobId));
      const messagesSnapshot = await getDocs(q);
      console.log('Messages snapshot size:', messagesSnapshot.size);

      const studentIds = new Set();
      const jobIds = new Set();

      messagesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.studentId) studentIds.add(data.studentId);
        if (data.jobId) jobIds.add(data.jobId);
      });

      console.log('Found student IDs:', Array.from(studentIds));
      console.log('Found job IDs:', Array.from(jobIds));

      const studentsData = [];
      const jobsData = new Map();

      if (studentIds.size === 0) {
        console.log('No students found in messages, checking applications...');
        const applicationsRef = collection(db, 'applications');
        const appQuery = query(applicationsRef, where('jobId', '==', jobId));
        const appSnapshot = await getDocs(appQuery);

        appSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.studentId) studentIds.add(data.studentId);
        });

        console.log('Found student IDs from applications:', Array.from(studentIds));
      }

      if (jobId) jobIds.add(jobId);

      for (const studentId of studentIds) {
        try {
          const studentRef = doc(db, 'students', studentId);
          const studentSnap = await getDoc(studentRef);

          if (studentSnap.exists()) {
            const studentData = studentSnap.data();
            studentsData.push({
              id: studentId,
              name: studentData.name || 'Unknown Student',
              email: studentData.email || '',
              rollNumber: studentData.rollNumber || '',
              jobId: jobId,
              hasUnreadMessages: false
            });
          } else {
            console.log('Student document does not exist for ID:', studentId);
          }
        } catch (studentError) {
          console.error('Error fetching student data:', studentError);
        }
      }

      for (const jobId of jobIds) {
        try {
          const jobRef = doc(db, 'jobs', jobId);
          const jobSnap = await getDoc(jobRef);

          if (jobSnap.exists()) {
            const jobData = jobSnap.data();
            jobsData.set(jobId, {
              id: jobId,
              ...jobData,
              position: jobData.position || 'Unknown Position',
              company: jobData.company || 'Unknown Company'
            });
          } else {
            console.log('Job document does not exist for ID:', jobId);
            jobsData.set(jobId, {
              id: jobId,
              position: 'Unknown Position',
              company: 'Unknown Company'
            });
          }
        } catch (jobError) {
          console.error('Error fetching job data:', jobError);
        }
      }

      console.log('Setting students:', studentsData);
      console.log('Setting jobs:', Array.from(jobsData.values()));

      setStudents(studentsData);
      setJobs(Array.from(jobsData.values()));

      if (studentsData.length === 0) {
        setError('No students found with chats for this job.');
      }
    } catch (error) {
      console.error('Error fetching students with chats:', error);
      setError('Failed to load chat data: ' + error.message);
      toast.error('Failed to load chat data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const selectStudentAndJob = (student) => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    setSelectedStudent(student);
    const job = jobs.find(j => j.id === student.jobId);
    setSelectedJob(job);
    setViewAllChats(false); // Switch to single chat mode
    loadMessages(student.jobId, student.id);
  };

  const loadMessages = (jobId, studentId) => {
    try {
      console.log('Loading messages for jobId:', jobId, 'studentId:', studentId);

      if (!jobId) {
        console.error('Missing jobId for loading messages');
        return;
      }

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      const messagesRef = collection(db, 'jobChats');
      let q;

      if (viewAllChats || !studentId) {
        q = query(
          messagesRef,
          where('jobId', '==', jobId),
          orderBy('timestamp', 'asc')
        );
      } else {
        q = query(
          messagesRef,
          where('jobId', '==', jobId),
          where('studentId', '==', studentId),
          orderBy('timestamp', 'asc')
        );
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesData = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          console.log('Message data:', data);
          messagesData.push({ id: doc.id, ...data });
        });
        console.log('Total messages loaded:', messagesData.length);
        setMessages(messagesData);

        if (selectedStudent && selectedStudent.hasUnreadMessages && studentId) {
          updateDoc(doc(db, 'applications', selectedStudent.applicationId), {
            hasUnreadMessages: false
          });
        }
      }, (error) => {
        console.error('Error in messages listener:', error);
        toast.error('Error loading messages: ' + error.message);
      });

      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages: ' + error.message);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedStudent || !selectedJob) {
      console.log('Cannot send message:', {
        messageEmpty: !newMessage.trim(),
        studentMissing: !selectedStudent,
        jobMissing: !selectedJob
      });
      toast.error('Please select a student and type a message.');
      return;
    }

    try {
      console.log('Sending message to student:', selectedStudent.id, 'for job:', selectedJob.id);
      const messagesRef = collection(db, 'jobChats');
      const messageData = {
        jobId: selectedJob.id,
        studentId: selectedStudent.id,
        senderName: 'Admin',
        senderRole: 'admin',
        message: newMessage.trim(),
        timestamp: serverTimestamp(),
        isRead: false
      };
      console.log('Message data to send:', messageData);

      await addDoc(messagesRef, messageData);
      console.log('Message sent successfully');

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message: ' + error.message);
    }
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFilteredMessages = () => {
    let filtered = messages;
    if (messageFilter === 'admin') {
      filtered = filtered.filter(m => m.senderRole === 'admin');
    } else if (messageFilter === 'student') {
      filtered = filtered.filter(m => m.senderRole !== 'admin');
    }
    if (messageSearch.trim()) {
      const term = messageSearch.toLowerCase();
      filtered = filtered.filter(m =>
        (m.message || '').toLowerCase().includes(term) ||
        (m.senderName || '').toLowerCase().includes(term)
      );
    }
    return filtered;
  };

  const exportToPDF = () => {
    try {
      const docPdf = new jsPDF();
      const data = getFilteredMessages();
      docPdf.setFontSize(14);
      docPdf.text(`Job Chats Report${selectedJob ? ` - ${selectedJob.position} @ ${selectedJob.company}` : ''}`, 10, 15);
      docPdf.setFontSize(10);
      let y = 25;
      if (data.length === 0) {
        docPdf.text('No messages for current filters.', 10, y);
      } else {
        data.forEach((m, idx) => {
          const timeStr = m.timestamp?.seconds ? new Date(m.timestamp.seconds * 1000).toLocaleString() : 'Pending';
          const sender = m.senderRole === 'admin' ? 'Admin' : (m.senderName || 'Student');
          const row = `${idx + 1}. [${timeStr}] ${sender}: ${m.message || ''}`;
          const lines = docPdf.splitTextToSize(row, 180);
          if (y + lines.length * 6 > 280) {
            docPdf.addPage();
            y = 20;
          }
          docPdf.text(lines, 10, y);
          y += lines.length * 6 + 2;
        });
      }
      docPdf.save('job-chats.pdf');
    } catch (e) {
      toast.error('Failed to export PDF');
    }
  };

  const filteredMessages = useMemo(() => getFilteredMessages(), [messages, messageFilter, messageSearch]);
  const csvData = useMemo(() => filteredMessages.map(m => ({
    timestamp: m.timestamp?.seconds ? new Date(m.timestamp.seconds * 1000).toISOString() : '',
    senderRole: m.senderRole || '',
    senderName: m.senderName || '',
    studentId: m.studentId || '',
    message: m.message || ''
  })), [filteredMessages]);

  return (
    <div className="p-4">
      <ToastContainer />
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Job Application Chats</h1>
        {selectedJob && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-500" />
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={messageFilter}
                onChange={(e) => setMessageFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="admin">Admin</option>
                <option value="student">Students</option>
              </select>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="pl-7 pr-7 py-1 border rounded-md text-sm w-56"
                placeholder="Search messages..."
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
              />
              {messageSearch && (
                <button
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                  onClick={() => setMessageSearch('')}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={exportToPDF}
              className="inline-flex items-center gap-1 bg-white border px-2 py-1 rounded-md text-sm hover:bg-gray-50"
            >
              <Download size={16} /> PDF
            </button>
            <CSVLink
              data={csvData}
              filename={'job-chats.csv'}
              className="inline-flex items-center gap-1 bg-white border px-2 py-1 rounded-md text-sm hover:bg-gray-50"
            >
              <Download size={16} /> CSV
            </CSVLink>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
          <button
            onClick={fetchStudentsWithChats}
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex h-[calc(100vh-200px)] bg-white rounded-lg shadow-md overflow-hidden">
        {/* Students List */}
        <div className="w-1/5 border-r">
          <div className="p-3 border-b flex items-center space-x-2">
            <Search size={18} className="text-gray-500" />
            <input
              type="text"
              placeholder="Search students..."
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto h-[calc(100%-56px)]">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-gray-500">Loading chats for job: {jobId}</p>
                </div>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center p-4 text-gray-500">
                No students with active chats found
              </div>
            ) : (
              filteredStudents.map(student => (
                <div
                  key={`${student.id}-${student.jobId}`}
                  className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                    selectedStudent && selectedStudent.id === student.id && selectedStudent.jobId === student.jobId && !viewAllChats
                      ? 'bg-blue-50'
                      : ''
                  }`}
                  onClick={() => selectStudentAndJob(student)}
                >
                  <div className="flex items-center">
                    <div className="bg-gray-200 rounded-full p-2 mr-3">
                      <User size={20} className="text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h3 className="font-medium text-gray-800">{student.name}</h3>
                        {student.hasUnreadMessages && (
                          <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                            New
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-gray-500">{student.rollNumber}</p>
                        {(() => {
                          const app = applications.find(a => a.studentId === student.id);
                          if (!app?.status) return null;
                          return (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(app.status)}`}>
                              {app.status}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {jobs.find(j => j.id === student.jobId)?.position || 'Unknown Position'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedJob ? (
            <>
              <div className="p-3 border-b bg-gray-50">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="font-medium text-lg">
                      {viewAllChats ? 'All Chats' : selectedStudent ? selectedStudent.name : 'Select a student'}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedJob ? `${selectedJob.position} at ${selectedJob.company}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Segmented control: Single | All */}
                    <div className="inline-flex rounded-full border bg-white p-1">
                      <button
                        type="button"
                        onClick={() => handleViewModeChange('single')}
                        className={`px-3 py-1 text-sm rounded-full transition-colors ${!viewAllChats ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                        aria-pressed={!viewAllChats}
                      >
                        Single
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewModeChange('all')}
                        className={`px-3 py-1 text-sm rounded-full transition-colors ${viewAllChats ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                        aria-pressed={viewAllChats}
                      >
                        All
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
                {/* Pinned section */}
                {pinnedMessages.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <Pin size={16} />
                      <span className="text-sm font-medium">Pinned ({pinnedMessages.length})</span>
                    </div>
                    <div className="space-y-2">
                      {pinnedMessages.map(pm => (
                        <div key={pm.id} className="bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-2 text-sm">
                          <div className="font-medium">{pm.title || 'Pinned'}</div>
                          <div>{pm.content || pm.message || ''}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <MessageSquare size={48} className="mb-2 opacity-50" />
                    <p>No messages found for current filters</p>
                  </div>
                ) : (
                  filteredMessages.map(msg => {
                    console.log('Rendering message:', msg);
                    let displayName = msg.senderName || 'Unknown';
                    if (viewAllChats && msg.senderRole !== 'admin') {
                      const student = students.find(s => s.id === msg.studentId);
                      if (student) {
                        displayName = `${student.name} (${student.rollNumber || 'No Roll Number'})`;
                      }
                    }
                    return (
                      <div
                        key={msg.id}
                        className={`mb-4 max-w-[80%] ${
                          msg.senderRole === 'admin'
                            ? 'ml-auto bg-blue-500 text-white rounded-tl-lg rounded-tr-lg rounded-bl-lg'
                            : 'mr-auto bg-gray-200 text-gray-800 rounded-tl-lg rounded-tr-lg rounded-br-lg'
                        } p-3 shadow-sm`}
                      >
                        <div className="text-sm font-medium mb-1">{displayName}</div>
                        <div>{msg.message}</div>
                        <div className="text-xs mt-1 opacity-70">
                          {msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleString() : 'Sending...'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="p-3 border-t bg-white">
                {viewAllChats || (!viewAllChats && !selectedStudent) ? (
                  <div className="text-center text-gray-500">
                    {viewAllChats
                      ? 'Switch to Single to send a message to a student.'
                      : 'Please select a student to send a message.'}
                  </div>
                ) : (
                  <div className="flex">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      className="flex-1 p-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200 disabled:cursor-not-allowed"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      disabled={viewAllChats || (!viewAllChats && !selectedStudent)}
                    />
                    <button
                      className="bg-blue-500 text-white p-2 rounded-r-md hover:bg-blue-600 transition-colors disabled:bg-gray-400"
                      onClick={sendMessage}
                      disabled={viewAllChats || (!viewAllChats && !selectedStudent)}
                    >
                      <Send size={20} />
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-100">
              <MessageSquare size={64} className="mb-4 opacity-50" />
              <p className="text-xl">Select a job to view conversations</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case 'shortlisted':
      return 'bg-green-100 text-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    case 'withdrawn':
      return 'bg-gray-100 text-gray-800';
    case 'interviewed':
      return 'bg-purple-100 text-purple-800';
    case 'offered':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
}

export default AdminChat;