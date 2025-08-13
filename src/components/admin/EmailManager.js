import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';
import { retryFailedEmails } from '../../firebase';
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Eye, 
  Clock, 
  AlertTriangle,
  Send,
  Users,
  BarChart3
} from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';

const EmailManager = () => {
  const [emailLogs, setEmailLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0
  });

  useEffect(() => {
    const fetchEmailLogs = async () => {
      try {
        setLoading(true);
        
        // Set up real-time listener for email logs
        let baseQuery = query(collection(db, 'emailLogs'), orderBy('sentAt', 'desc'));
        
        if (filter !== 'all') {
          baseQuery = query(baseQuery, where('status', '==', filter));
        }

        const unsubscribe = onSnapshot(baseQuery, (snapshot) => {
          const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            sentAt: doc.data().sentAt?.toDate() || new Date()
          }));

          setEmailLogs(logs);

          // Calculate stats
          const total = logs.length;
          const sent = logs.filter(log => log.status === 'sent').length;
          const failed = logs.filter(log => log.status === 'failed').length;
          const pending = logs.filter(log => log.status === 'pending').length;

          setStats({ total, sent, failed, pending });
          setLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error fetching email logs:', error);
        setLoading(false);
      }
    };

    fetchEmailLogs();
  }, [filter]);

  const handleRetryFailedEmail = async (emailLogId) => {
    try {
      await retryFailedEmails({ emailLogId });
      toast.success('Email retry initiated successfully');
    } catch (error) {
      console.error('Error retrying email:', error);
      toast.error('Failed to retry email');
    }
  };

  const handleRetryAllFailedEmails = async () => {
    try {
      const failedEmails = emailLogs.filter(log => log.status === 'failed');
      
      for (const email of failedEmails) {
        await retryFailedEmails({ emailLogId: email.id });
      }
      
      toast.success(`Retry initiated for ${failedEmails.length} failed emails`);
    } catch (error) {
      console.error('Error retrying all failed emails:', error);
      toast.error('Failed to retry some emails');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'failed':
        return <XCircle size={16} className="text-red-500" />;
      case 'pending':
        return <Clock size={16} className="text-yellow-500" />;
      default:
        return <AlertTriangle size={16} className="text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full";
    switch (status) {
      case 'sent':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const truncateText = (text, maxLength = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Notification Manager</h1>
        <p className="text-gray-600">Monitor and manage email notifications sent to students and admins</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Emails</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Sent Successfully</p>
              <p className="text-2xl font-semibold text-green-600">{stats.sent}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-semibold text-red-600">{stats.failed}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-semibold text-yellow-600">{stats.pending}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                filter === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setFilter('sent')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                filter === 'sent' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sent ({stats.sent})
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                filter === 'failed' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Failed ({stats.failed})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                filter === 'pending' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending ({stats.pending})
            </button>
          </div>

          {stats.failed > 0 && (
            <button
              onClick={handleRetryAllFailedEmails}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium flex items-center"
            >
              <RefreshCw size={16} className="mr-2" />
              Retry All Failed
            </button>
          )}
        </div>
      </div>

      {/* Email Logs Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recipient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attempts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {emailLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(log.status)}
                      <span className={`ml-2 ${getStatusBadge(log.status)}`}>
                        {log.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {log.recipientEmail}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {log.notificationType}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs">
                      {truncateText(log.subject, 60)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(log.sentAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {log.attempts || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          // Show email details modal
                          console.log('Email details:', log);
                        }}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      
                      {log.status === 'failed' && (
                        <button
                          onClick={() => handleRetryFailedEmail(log.id)}
                          className="text-green-600 hover:text-green-900 p-1"
                          title="Retry Email"
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {emailLogs.length === 0 && (
          <div className="text-center py-12">
            <Mail className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No email logs found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'all' 
                ? 'No emails have been sent yet.' 
                : `No emails found with status "${filter}".`
              }
            </p>
          </div>
        )}
      </div>

      {/* Email Templates Section */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Email Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { type: 'job_application', name: 'Job Application', icon: Send },
            { type: 'status_update', name: 'Status Update', icon: CheckCircle },
            { type: 'interview', name: 'Interview Scheduled', icon: Clock },
            { type: 'selection', name: 'Selection', icon: Users },
            { type: 'announcement', name: 'Announcement', icon: AlertTriangle },
            { type: 'deadline_reminder', name: 'Deadline Reminder', icon: Clock }
          ].map((template) => (
            <div key={template.type} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex items-center">
                <template.icon size={20} className="text-blue-600 mr-3" />
                <div>
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  <p className="text-sm text-gray-500">{template.type}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmailManager;
