import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import { 
  Eye, 
  EyeOff,
  Edit, 
  Trash2, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  Download,
  Send,
  Filter,
  Search,
  MoreVertical,
  Play,
  Pause,
  Plus,
  Archive
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { sendTaskReminders } from '../../utils/taskNotifications';

const TaskManagement = () => {
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: ''
  });

  useEffect(() => {
    fetchTasks();
    fetchSubmissions();
  }, []);

  const fetchTasks = async () => {
    try {
      const tasksRef = collection(db, 'tasks');
      const q = query(tasksRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setTasks(tasksData);
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
      const snapshot = await getDocs(submissionsRef);
      
      const submissionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSubmissions(submissionsData);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        status: newStatus,
        updatedAt: new Date()
      });
      
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
      
      toast.success(`Task ${newStatus} successfully`);
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Failed to update task status');
    }
  };

  const publishResults = async (taskId) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        resultsPublished: true,
        resultsPublishedAt: new Date(),
        updatedAt: new Date()
      });
      
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, resultsPublished: true, resultsPublishedAt: new Date() } : task
      ));
      
      toast.success('Results published successfully! Students can now view their results.');
    } catch (error) {
      console.error('Error publishing results:', error);
      toast.error('Failed to publish results');
    }
  };

  const unpublishResults = async (taskId) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        resultsPublished: false,
        updatedAt: new Date()
      });
      
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, resultsPublished: false } : task
      ));
      
      toast.success('Results unpublished successfully');
    } catch (error) {
      console.error('Error unpublishing results:', error);
      toast.error('Failed to unpublish results');
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      setTasks(prev => prev.filter(task => task.id !== taskId));
      toast.success('Task deleted successfully');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const exportResults = async (task) => {
    try {
      const taskSubmissions = submissions.filter(sub => sub.taskId === task.id);
      
      if (taskSubmissions.length === 0) {
        toast.warning('No submissions found for this task');
        return;
      }

      const exportData = taskSubmissions.map(submission => {
        const baseData = {
          'Student Name': submission.studentName,
          'Roll Number': submission.studentRoll,
          'Submitted At': submission.submittedAt?.toDate?.()?.toLocaleString() || 'N/A',
          'Status': submission.status,
          'Time Spent (mins)': submission.timeSpent || 0
        };

        if (task.type === 'quiz') {
          return {
            ...baseData,
            'Total Marks': submission.totalMarks || 0,
            'Marks Obtained': submission.marksObtained || 0,
            'Percentage': submission.percentage || 0,
            'Grade': submission.grade || 'N/A'
          };
        } else if (task.type === 'assignment') {
          return {
            ...baseData,
            'Files Submitted': submission.submission?.files?.length || 0,
            'Feedback': submission.feedback || 'Not graded'
          };
        } else {
          return {
            ...baseData,
            'Response Count': submission.submission?.answers?.length || 0
          };
        }
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Results');
      
      const fileName = `${task.title.replace(/[^a-zA-Z0-9]/g, '_')}_results.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success('Results exported successfully');
    } catch (error) {
      console.error('Error exporting results:', error);
      toast.error('Failed to export results');
    }
  };

  const sendReminders = async (taskId) => {
    try {
      const result = await sendTaskReminders(taskId, 'deadline');
      if (result.success) {
        toast.success(`Reminders sent to ${result.sentCount} students`);
      } else {
        toast.error(result.message || 'Failed to send reminders');
      }
    } catch (error) {
      console.error('Error sending reminders:', error);
      toast.error('Failed to send reminders');
    }
  };

  const getTaskStats = (task) => {
    const taskSubmissions = submissions.filter(sub => sub.taskId === task.id);
    const completed = taskSubmissions.filter(sub => sub.status === 'submitted' || sub.status === 'completed').length;
    const total = task.stats?.totalAssigned || task.assignedTo?.length || taskSubmissions.length || 0;
    const pending = Math.max(0, total - completed);
    
    return {
      total,
      completed,
      pending,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  };

  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filters.status === 'all' || task.status === filters.status;
    const matchesType = filters.type === 'all' || task.type === filters.type;
    const matchesSearch = filters.search === '' || 
      task.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      task.description?.toLowerCase().includes(filters.search.toLowerCase());
    
    return matchesStatus && matchesType && matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'archived': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'feedback': return '📝';
      case 'survey': return '📊';
      case 'quiz': return '📋';
      case 'assignment': return '📎';
      case 'reading': return '📖';
      default: return '📄';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Task Management</h1>
          <p className="text-gray-600">Manage and monitor all tasks and assessments</p>
        </div>
        <Link
          to="/admin/tasks/create"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Create Task
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
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

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: 'all', type: 'all', search: '' })}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-lg shadow-sm border">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Calendar size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {filters.search || filters.status !== 'all' || filters.type !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first task to get started'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Task
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Deadline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTasks.map((task) => {
                  const stats = getTaskStats(task);
                  const isOverdue = task.endDate?.toDate?.() < new Date() && task.status === 'active';
                  
                  return (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {task.title}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {task.description}
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="mr-2">{getTypeIcon(task.type)}</span>
                          <span className="text-sm text-gray-900 capitalize">
                            {task.type}
                          </span>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                        {isOverdue && (
                          <div className="flex items-center mt-1 text-red-600">
                            <AlertCircle size={12} className="mr-1" />
                            <span className="text-xs">Overdue</span>
                          </div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Calendar size={14} className="mr-2 text-gray-400" />
                          {task.endDate?.toDate?.()?.toLocaleDateString() || 'No deadline'}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-1">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>{stats.completed}/{stats.total}</span>
                              <span>{stats.completionRate}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${stats.completionRate}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setShowSubmissions(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Submissions"
                          >
                            <Eye size={16} />
                          </button>
                          
                          <button
                            onClick={() => exportResults(task)}
                            className="text-green-600 hover:text-green-900"
                            title="Export Results"
                          >
                            <Download size={16} />
                          </button>
                          
                          <button
                            onClick={() => sendReminders(task.id)}
                            className="text-yellow-600 hover:text-yellow-900"
                            title="Send Reminders"
                          >
                            <Send size={16} />
                          </button>
                          
                          {task.status === 'draft' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'active')}
                              className="text-green-600 hover:text-green-900"
                              title="Activate Task"
                            >
                              <Play size={16} />
                            </button>
                          )}
                          
                          {task.status === 'active' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'completed')}
                              className="text-blue-600 hover:text-blue-900"
                              title="Mark Complete"
                            >
                              <CheckCircle size={16} />
                            </button>
                          )}
                          
                          {/* Publish/Unpublish Results for Quiz/Test types */}
                          {(task.type === 'quiz' || task.type === 'test') && task.status === 'completed' && (
                            task.resultsPublished ? (
                              <button
                                onClick={() => unpublishResults(task.id)}
                                className="text-orange-600 hover:text-orange-900"
                                title="Unpublish Results"
                              >
                                <EyeOff size={16} />
                              </button>
                            ) : (
                              <button
                                onClick={() => publishResults(task.id)}
                                className="text-green-600 hover:text-green-900"
                                title="Publish Results"
                              >
                                <Eye size={16} />
                              </button>
                            )
                          )}
                          
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Task"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submissions Modal */}
      {showSubmissions && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                Submissions: {selectedTask.title}
              </h2>
              <button
                onClick={() => setShowSubmissions(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {submissions.filter(sub => sub.taskId === selectedTask.id).length === 0 ? (
                <div className="text-center py-8">
                  <Users size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No submissions yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions
                    .filter(sub => sub.taskId === selectedTask.id)
                    .map(submission => (
                      <div key={submission.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {submission.studentName}
                            </h4>
                            <p className="text-sm text-gray-600">
                              Roll: {submission.studentRoll}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              submission.status === 'submitted' 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {submission.status}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {submission.submittedAt?.toDate?.()?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        
                        {selectedTask.type === 'quiz' && (
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Score:</span>
                              <span className="ml-2 font-medium">
                                {submission.marksObtained || 0}/{submission.totalMarks || 0}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Percentage:</span>
                              <span className="ml-2 font-medium">
                                {submission.percentage || 0}%
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Grade:</span>
                              <span className="ml-2 font-medium">
                                {submission.grade || 'N/A'}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {selectedTask.type === 'assignment' && (
                          <div className="text-sm">
                            <span className="text-gray-600">Files:</span>
                            <span className="ml-2 font-medium">
                              {submission.submission?.files?.length || 0} file(s) uploaded
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManagement;
