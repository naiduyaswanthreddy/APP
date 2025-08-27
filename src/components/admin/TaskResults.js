import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { 
  Download, 
  Eye, 
  Filter, 
  Search, 
  BarChart3,
  Users,
  Award,
  Clock,
  FileText,
  TrendingUp,
  Edit3,
  Save,
  X
} from 'lucide-react';

const TaskResults = ({ taskId, task }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    search: ''
  });
  const [analytics, setAnalytics] = useState({
    totalSubmissions: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0,
    completionRate: 0,
    averageTime: 0
  });
  const [gradingMode, setGradingMode] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [manualGrades, setManualGrades] = useState({});

  useEffect(() => {
    if (taskId) {
      fetchSubmissions();
    }
  }, [taskId]);

  useEffect(() => {
    calculateAnalytics();
  }, [submissions]);

  const fetchSubmissions = async () => {
    try {
      const submissionsRef = collection(db, 'task_submissions');
      const q = query(submissionsRef, where('taskId', '==', taskId));
      const snapshot = await getDocs(q);
      
      const submissionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSubmissions(submissionsData);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Failed to fetch submissions');
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = () => {
    if (submissions.length === 0) {
      setAnalytics({
        totalSubmissions: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        completionRate: 0,
        averageTime: 0
      });
      return;
    }

    const completedSubmissions = submissions.filter(sub => sub.status === 'submitted');
    const scores = completedSubmissions
      .map(sub => sub.percentage || 0)
      .filter(score => score > 0);
    
    const times = completedSubmissions
      .map(sub => sub.timeSpent || 0)
      .filter(time => time > 0);

    setAnalytics({
      totalSubmissions: completedSubmissions.length,
      averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      completionRate: task?.stats?.totalAssigned > 0 ? 
        Math.round((completedSubmissions.length / task.stats.totalAssigned) * 100) : 0,
      averageTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
    });
  };

  const exportToExcel = () => {
    try {
      const exportData = filteredSubmissions.map(submission => {
        const baseData = {
          'Student Name': submission.studentName,
          'Roll Number': submission.studentRoll,
          'Submitted At': submission.submittedAt?.toDate?.()?.toLocaleString() || 'N/A',
          'Status': submission.status,
          'Time Spent (mins)': submission.timeSpent || 0,
          'Attempt Number': submission.attemptNumber || 1
        };

        if (task?.type === 'quiz') {
          return {
            ...baseData,
            'Total Marks': submission.totalMarks || 0,
            'Marks Obtained': submission.marksObtained || 0,
            'Percentage': submission.percentage || 0,
            'Grade': submission.grade || 'N/A'
          };
        } else if (task?.type === 'assignment') {
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
      
      const fileName = `${task?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'task'}_results.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success('Results exported successfully');
    } catch (error) {
      console.error('Error exporting results:', error);
      toast.error('Failed to export results');
    }
  };

  const saveManualGrade = async (submissionId, questionId, marks, feedback = '') => {
    try {
      const submissionRef = doc(db, 'task_submissions', submissionId);
      const submission = submissions.find(s => s.id === submissionId);
      
      if (!submission) return;

      // Update the specific answer with manual grading
      const updatedAnswers = submission.answers.map(answer => {
        if (answer.questionId === questionId) {
          return {
            ...answer,
            manualMarks: marks,
            manualFeedback: feedback,
            manuallyGraded: true
          };
        }
        return answer;
      });

      // Recalculate total score
      const totalScore = updatedAnswers.reduce((sum, answer) => {
        return sum + (answer.manualMarks !== undefined ? answer.manualMarks : (answer.isCorrect ? (answer.marks || 1) : 0));
      }, 0);

      await updateDoc(submissionRef, {
        answers: updatedAnswers,
        totalScore: totalScore,
        manuallyGraded: true,
        gradedAt: new Date()
      });

      // Update local state
      setSubmissions(prev => prev.map(sub => 
        sub.id === submissionId 
          ? { ...sub, answers: updatedAnswers, totalScore, manuallyGraded: true }
          : sub
      ));

      toast.success('Grade saved successfully');
    } catch (error) {
      console.error('Error saving manual grade:', error);
      toast.error('Failed to save grade');
    }
  };

  const exportDetailedReport = () => {
    if (submissions.length === 0) {
      toast.error('No submissions to export');
      return;
    }

    const workbook = XLSX.utils.book_new();
    
    // Summary Sheet
    const summaryData = submissions.map(submission => ({
      'Student Name': submission.studentName || 'Unknown',
      'Roll Number': submission.rollNumber || 'N/A',
      'Email': submission.email || 'N/A',
      'Submission Time': submission.submittedAt?.toDate?.()?.toLocaleString() || 'N/A',
      'Status': submission.status || 'submitted',
      'Total Score': submission.totalScore || 0,
      'Max Score': task?.content?.questions?.reduce((sum, q) => sum + (q.marks || 1), 0) || 0,
      'Percentage': submission.totalScore && task?.content?.questions ? 
        Math.round((submission.totalScore / task.content.questions.reduce((sum, q) => sum + (q.marks || 1), 0)) * 100) : 0,
      'Manually Graded': submission.manuallyGraded ? 'Yes' : 'No'
    }));

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Detailed Sheet with individual answers
    if (task?.content?.questions) {
      const detailedData = submissions.map(submission => {
        const baseData = {
          'Student Name': submission.studentName || 'Unknown',
          'Roll Number': submission.rollNumber || 'N/A',
          'Email': submission.email || 'N/A',
          'Submission Time': submission.submittedAt?.toDate?.()?.toLocaleString() || 'N/A',
          'Total Score': submission.totalScore || 0
        };

        // Add each question and answer
        task.content.questions.forEach((question, index) => {
          const qNum = index + 1;
          const studentAnswer = submission.answers?.find(ans => ans.questionId === question.id);
          
          baseData[`${qNum} - Question`] = question.question;
          baseData[`${qNum} - Student Answer`] = studentAnswer?.answer || 'No Answer';
          
          // Add correct answer and grading for quiz questions
          if (task.type === 'quiz' || task.type === 'test') {
            if (question.type === 'mcq' && question.options && question.correctAnswer !== undefined) {
              const correctOption = question.options[question.correctAnswer];
              baseData[`${qNum} - Correct Answer`] = correctOption || 'Not Set';
              baseData[`${qNum} - Is Correct`] = studentAnswer?.isCorrect ? 'Yes' : 'No';
              baseData[`${qNum} - Marks`] = studentAnswer?.manualMarks !== undefined ? studentAnswer.manualMarks : (studentAnswer?.isCorrect ? (question.marks || 1) : 0);
            } else if (question.type === 'true_false' && question.correctAnswer !== undefined) {
              baseData[`${qNum} - Correct Answer`] = question.correctAnswer;
              baseData[`${qNum} - Is Correct`] = studentAnswer?.isCorrect ? 'Yes' : 'No';
              baseData[`${qNum} - Marks`] = studentAnswer?.manualMarks !== undefined ? studentAnswer.manualMarks : (studentAnswer?.isCorrect ? (question.marks || 1) : 0);
            } else {
              baseData[`${qNum} - Marks`] = studentAnswer?.manualMarks || 0;
            }
            
            if (studentAnswer?.manualFeedback) {
              baseData[`${qNum} - Feedback`] = studentAnswer.manualFeedback;
            }
          }
        });

        return baseData;
      });

      const detailedSheet = XLSX.utils.json_to_sheet(detailedData);
      XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Detailed Answers');
    }

    // Export
    const fileName = `${task?.title || 'Task'}_Results_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success('Report exported successfully');
  };

  const getGradeDistribution = () => {
    const grades = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
    submissions.forEach(sub => {
      if (sub.grade && grades.hasOwnProperty(sub.grade)) {
        grades[sub.grade]++;
      }
    });
    return grades;
  };

  const filteredSubmissions = submissions.filter(submission => {
    const matchesStatus = filters.status === 'all' || submission.status === filters.status;
    const matchesSearch = filters.search === '' || 
      submission.studentName?.toLowerCase().includes(filters.search.toLowerCase()) ||
      submission.studentRoll?.toLowerCase().includes(filters.search.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{analytics.totalSubmissions}</div>
              <div className="text-sm text-gray-600">Submissions</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{analytics.completionRate}%</div>
              <div className="text-sm text-gray-600">Completion Rate</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Award className="h-8 w-8 text-yellow-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{analytics.averageScore}%</div>
              <div className="text-sm text-gray-600">Average Score</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{analytics.averageTime}</div>
              <div className="text-sm text-gray-600">Avg Time (mins)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grade Distribution for Quizzes */}
      {task?.type === 'quiz' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Grade Distribution</h3>
          <div className="grid grid-cols-6 gap-4">
            {Object.entries(getGradeDistribution()).map(([grade, count]) => (
              <div key={grade} className="text-center">
                <div className={`text-2xl font-bold ${
                  grade === 'A+' ? 'text-green-600' :
                  grade === 'A' ? 'text-blue-600' :
                  grade === 'B' ? 'text-yellow-600' :
                  grade === 'C' ? 'text-orange-600' :
                  'text-red-600'
                }`}>
                  {count}
                </div>
                <div className="text-sm text-gray-600">Grade {grade}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Export Results</h3>
          <div className="flex space-x-3">
            <button
              onClick={exportToExcel}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </button>
            <button
              onClick={exportDetailedReport}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Detailed Report
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Search className="inline w-4 h-4 mr-1" />
              Search Students
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search by name or roll number..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Filter className="inline w-4 h-4 mr-1" />
              Status Filter
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="in_progress">In Progress</option>
              <option value="graded">Graded</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Student Results</h3>
        </div>
        
        {filteredSubmissions.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No submissions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time Spent
                  </th>
                  {task?.type === 'quiz' && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Grade
                      </th>
                    </>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSubmissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {submission.studentName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {submission.studentRoll}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {submission.submittedAt?.toDate?.()?.toLocaleString() || 'N/A'}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {submission.timeSpent || 0} mins
                    </td>
                    
                    {task?.type === 'quiz' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {submission.marksObtained || 0}/{submission.totalMarks || 0}
                          <span className="ml-2 text-gray-500">
                            ({submission.percentage || 0}%)
                          </span>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            submission.grade === 'A+' || submission.grade === 'A' ? 'bg-green-100 text-green-800' :
                            submission.grade === 'B' || submission.grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {submission.grade || 'N/A'}
                          </span>
                        </td>
                      </>
                    )}
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        submission.status === 'submitted' ? 'bg-green-100 text-green-800' :
                        submission.status === 'graded' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {submission.status}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedSubmission(submission)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {(task?.type === 'quiz' || task?.type === 'test' || task?.type === 'assignment') && (
                          <button
                            onClick={() => {
                              setSelectedSubmission(submission);
                              setGradingMode(true);
                            }}
                            className="text-green-600 hover:text-green-900"
                            title="Manual Grade"
                          >
                            <Edit3 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Grading Modal */}
      {gradingMode && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                Manual Grading - {selectedSubmission.studentName}
              </h2>
              <button
                onClick={() => {
                  setGradingMode(false);
                  setSelectedSubmission(null);
                  setManualGrades({});
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {task?.content?.questions?.map((question, index) => {
                const studentAnswer = selectedSubmission.answers?.find(ans => ans.questionId === question.id);
                const currentGrade = manualGrades[question.id] || {
                  marks: studentAnswer?.manualMarks !== undefined ? studentAnswer.manualMarks : (studentAnswer?.isCorrect ? (question.marks || 1) : 0),
                  feedback: studentAnswer?.manualFeedback || ''
                };

                return (
                  <div key={question.id} className="mb-6 p-4 border border-gray-200 rounded-lg">
                    <div className="mb-3">
                      <h3 className="font-medium text-gray-900">
                        Question {index + 1} ({question.marks || 1} marks)
                      </h3>
                      <p className="text-gray-700 mt-1">{question.question}</p>
                    </div>

                    {/* Show correct answer for quiz questions */}
                    {(task.type === 'quiz' || task.type === 'test') && question.correctAnswer !== undefined && (
                      <div className="mb-3 p-2 bg-green-50 rounded">
                        <span className="text-sm font-medium text-green-800">Correct Answer: </span>
                        <span className="text-sm text-green-700">
                          {question.type === 'mcq' && question.options 
                            ? question.options[question.correctAnswer]
                            : question.correctAnswer}
                        </span>
                      </div>
                    )}

                    <div className="mb-3 p-2 bg-blue-50 rounded">
                      <span className="text-sm font-medium text-blue-800">Student Answer: </span>
                      <span className="text-sm text-blue-700">
                        {question.type === 'mcq' && question.options && studentAnswer?.answer !== undefined
                          ? question.options[studentAnswer.answer]
                          : studentAnswer?.answer || 'No Answer'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Marks
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={question.marks || 1}
                          value={currentGrade.marks}
                          onChange={(e) => setManualGrades(prev => ({
                            ...prev,
                            [question.id]: {
                              ...currentGrade,
                              marks: parseFloat(e.target.value) || 0
                            }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Feedback (Optional)
                        </label>
                        <textarea
                          value={currentGrade.feedback}
                          onChange={(e) => setManualGrades(prev => ({
                            ...prev,
                            [question.id]: {
                              ...currentGrade,
                              feedback: e.target.value
                            }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows="2"
                          placeholder="Add feedback for the student..."
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setGradingMode(false);
                  setSelectedSubmission(null);
                  setManualGrades({});
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  // Save all manual grades
                  for (const [questionId, grade] of Object.entries(manualGrades)) {
                    await saveManualGrade(selectedSubmission.id, questionId, grade.marks, grade.feedback);
                  }
                  setGradingMode(false);
                  setSelectedSubmission(null);
                  setManualGrades({});
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                <Save size={16} className="inline mr-2" />
                Save Grades
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Submission Modal */}
      {selectedSubmission && !gradingMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                Submission Details - {selectedSubmission.studentName}
              </h2>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Student:</span> {selectedSubmission.studentName}
                  </div>
                  <div>
                    <span className="font-medium">Roll Number:</span> {selectedSubmission.rollNumber || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Submitted At:</span> {selectedSubmission.submittedAt?.toDate?.()?.toLocaleString() || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Time Spent:</span> {selectedSubmission.timeSpent || 0} mins
                  </div>
                  {selectedSubmission.totalScore !== undefined && (
                    <div>
                      <span className="font-medium">Score:</span> {selectedSubmission.totalScore}/{task?.content?.questions?.reduce((sum, q) => sum + (q.marks || 1), 0) || 0}
                    </div>
                  )}
                </div>
              </div>

              {task?.content?.questions?.map((question, index) => {
                const studentAnswer = selectedSubmission.answers?.find(ans => ans.questionId === question.id);
                return (
                  <div key={question.id} className="mb-6 p-4 border border-gray-200 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">
                      Question {index + 1}
                    </h3>
                    <p className="text-gray-700 mb-3">{question.question}</p>
                    
                    <div className="bg-blue-50 p-3 rounded">
                      <span className="font-medium text-blue-800">Answer: </span>
                      <span className="text-blue-700">
                        {question.type === 'mcq' && question.options && studentAnswer?.answer !== undefined
                          ? question.options[studentAnswer.answer]
                          : studentAnswer?.answer || 'No Answer'}
                      </span>
                    </div>

                    {studentAnswer?.manualFeedback && (
                      <div className="mt-2 bg-yellow-50 p-3 rounded">
                        <span className="font-medium text-yellow-800">Feedback: </span>
                        <span className="text-yellow-700">{studentAnswer.manualFeedback}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskResults;
