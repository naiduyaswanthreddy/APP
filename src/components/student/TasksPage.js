import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { toast } from 'react-toastify';
import { 
  Calendar, 
  Clock, 
  Filter, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  MessageSquare,
  BarChart3,
  BookOpen,
  Upload,
  Play,
  Eye
} from 'lucide-react';

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: ''
  });

  useEffect(() => {
    if (auth.currentUser) {
      fetchTasks();
      fetchSubmissions();
    }
  }, []);

  const fetchTasks = async () => {
    try {
      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef, 
        where('status', '==', 'active'),
        orderBy('endDate', 'asc')
      );
      const snapshot = await getDocs(q);
      
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter tasks based on target audience
      const userTasks = tasksData.filter(task => {
        if (task.targetType === 'all') return true;
        
        // Get current user data (you might need to fetch this from user profile)
        // For now, we'll assume all tasks are visible
        return true;
      });
      
      setTasks(userTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const submissionsRef = collection(db, 'task_submissions');
      const q = query(
        submissionsRef,
        where('studentId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      
      const submissionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSubmissions(submissionsData);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  const getTaskStatus = (task) => {
    const submission = submissions.find(sub => sub.taskId === task.id);
    const now = new Date();
    const deadline = task.endDate?.toDate?.() || new Date(task.endDate);
    
    if (submission) {
      return submission.status === 'submitted' ? 'completed' : 'in_progress';
    } else if (deadline < now) {
      return 'overdue';
    } else {
      return 'pending';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} className="text-green-600" />;
      case 'in_progress': return <Clock size={16} className="text-blue-600" />;
      case 'overdue': return <AlertTriangle size={16} className="text-red-600" />;
      case 'pending': return <Clock size={16} className="text-yellow-600" />;
      default: return <Clock size={16} className="text-gray-600" />;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'feedback': return <MessageSquare size={20} className="text-blue-600" />;
      case 'survey': return <BarChart3 size={20} className="text-green-600" />;
      case 'quiz': return <FileText size={20} className="text-purple-600" />;
      case 'assignment': return <Upload size={20} className="text-orange-600" />;
      case 'reading': return <BookOpen size={20} className="text-indigo-600" />;
      default: return <FileText size={20} className="text-gray-600" />;
    }
  };

  const getTimeRemaining = (deadline) => {
    const now = new Date();
    const deadlineDate = deadline?.toDate?.() || new Date(deadline);
    const diff = deadlineDate - now;
    
    if (diff < 0) return 'Overdue';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;
    return 'Due soon';
  };

  const handleTaskClick = (task) => {
    const status = getTaskStatus(task);
    
    if (status === 'completed') {
      // Show results or submission details
      toast.info('Task already completed');
      return;
    }
    
    if (status === 'overdue') {
      toast.warning('This task is overdue');
      return;
    }
    
    // Navigate to task attempt page based on type
    const taskUrl = `/student/tasks/${task.id}/attempt`;
    window.location.href = taskUrl;
  };

  const filteredTasks = tasks.filter(task => {
    const status = getTaskStatus(task);
    const matchesStatus = filters.status === 'all' || status === filters.status;
    const matchesType = filters.type === 'all' || task.type === filters.type;
    const matchesSearch = filters.search === '' || 
      task.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      task.description?.toLowerCase().includes(filters.search.toLowerCase());
    
    return matchesStatus && matchesType && matchesSearch;
  });

  const taskCounts = {
    all: tasks.length,
    pending: tasks.filter(task => getTaskStatus(task) === 'pending').length,
    in_progress: tasks.filter(task => getTaskStatus(task) === 'in_progress').length,
    completed: tasks.filter(task => getTaskStatus(task) === 'completed').length,
    overdue: tasks.filter(task => getTaskStatus(task) === 'overdue').length
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-2">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Tasks & Assessments</h1>
        <p className="text-gray-600">Complete your assigned tasks and assessments</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-2xl font-bold text-gray-900">{taskCounts.all}</div>
          <div className="text-sm text-gray-600">Total Tasks</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-2xl font-bold text-yellow-600">{taskCounts.pending}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-2xl font-bold text-blue-600">{taskCounts.in_progress}</div>
          <div className="text-sm text-gray-600">In Progress</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-2xl font-bold text-green-600">{taskCounts.completed}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-2xl font-bold text-red-600">{taskCounts.overdue}</div>
          <div className="text-sm text-gray-600">Overdue</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Search className="inline w-4 h-4 mr-1" />
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search tasks..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Filter className="inline w-4 h-4 mr-1" />
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="feedback">Feedback</option>
              <option value="survey">Survey</option>
              <option value="quiz">Quiz/Test</option>
              <option value="assignment">Assignment</option>
              <option value="reading">Reading/Video</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <div className="text-gray-400 mb-4">
              <FileText size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
            <p className="text-gray-500">
              {filters.search || filters.status !== 'all' || filters.type !== 'all'
                ? 'Try adjusting your filters'
                : 'No tasks have been assigned yet'
              }
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const status = getTaskStatus(task);
            const submission = submissions.find(sub => sub.taskId === task.id);
            
            return (
              <div
                key={task.id}
                className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleTaskClick(task)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {getTypeIcon(task.type)}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 mb-1">
                          {task.title}
                        </h3>
                        <p className="text-gray-600 text-sm mb-2">
                          {task.description}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="capitalize">{task.type}</span>
                          {task.type === 'quiz' && task.settings?.timeLimit && (
                            <span>⏱️ {task.settings.timeLimit} mins</span>
                          )}
                          {task.settings?.maxMarks && (
                            <span>📊 {task.settings.maxMarks} marks</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
                        {getStatusIcon(status)}
                        <span className="ml-1 capitalize">{status.replace('_', ' ')}</span>
                      </span>
                      
                      <div className="text-right">
                        <div className="flex items-center text-sm text-gray-500 mb-1">
                          <Calendar size={14} className="mr-1" />
                          {task.endDate?.toDate?.()?.toLocaleDateString() || 'No deadline'}
                        </div>
                        <div className={`text-xs font-medium ${
                          status === 'overdue' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {getTimeRemaining(task.endDate)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submission Info */}
                  {submission && (
                    <div className="bg-gray-50 rounded-lg p-3 mt-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          {submission.status === 'submitted' ? 'Submitted' : 'In Progress'}
                        </span>
                        <span className="text-gray-500">
                          {submission.submittedAt?.toDate?.()?.toLocaleString() || 
                           submission.startedAt?.toDate?.()?.toLocaleString()}
                        </span>
                      </div>
                      
                      {task.type === 'quiz' && submission.status === 'submitted' && (
                        <div className="mt-2 flex justify-between items-center">
                          <span className="text-sm text-gray-600">Score:</span>
                          <span className="font-medium">
                            {submission.marksObtained || 0}/{submission.totalMarks || 0} 
                            ({submission.percentage || 0}%)
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="mt-4 flex justify-end">
                    <button
                      className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                        status === 'completed'
                          ? 'bg-gray-100 text-gray-600 cursor-default'
                          : status === 'overdue'
                          ? 'bg-red-100 text-red-700 cursor-default'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      disabled={status === 'completed' || status === 'overdue'}
                    >
                      {status === 'completed' ? (
                        <>
                          <Eye size={16} className="mr-2" />
                          View Results
                        </>
                      ) : status === 'overdue' ? (
                        <>
                          <AlertTriangle size={16} className="mr-2" />
                          Overdue
                        </>
                      ) : status === 'in_progress' ? (
                        <>
                          <Play size={16} className="mr-2" />
                          Continue
                        </>
                      ) : (
                        <>
                          <Play size={16} className="mr-2" />
                          Start Task
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TasksPage;
