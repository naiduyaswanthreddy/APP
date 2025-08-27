import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { toast } from 'react-toastify';
import { 
  Clock, 
  AlertTriangle, 
  Shield, 
  Send, 
  Upload,
  Play,
  CheckCircle,
  XCircle
} from 'lucide-react';

const TaskAttempt = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attempting, setAttempting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answers, setAnswers] = useState({});
  const [warningCount, setWarningCount] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [attemptId, setAttemptId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerRef = useRef(null);
  const containerRef = useRef(null);
  const maxWarnings = 2;

  // Security event tracking
  const logSecurityEvent = useCallback((type, details = '') => {
    const event = { type, timestamp: new Date(), details };
    setSecurityEvents(prev => [...prev, event]);
    
    if (['tab_switch', 'window_blur', 'fullscreen_exit'].includes(type)) {
      setWarningCount(prev => {
        const newCount = prev + 1;
        if (newCount >= maxWarnings) {
          toast.error('Maximum warnings reached. Test will be auto-submitted.');
          setTimeout(() => handleSubmit(true), 2000);
        } else {
          toast.warning(`Warning ${newCount}/${maxWarnings}: Suspicious activity detected`);
        }
        return newCount;
      });
    }
  }, []);

  // Security event listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (attempting && document.hidden) {
        logSecurityEvent('tab_switch', 'User switched tabs or minimized window');
      }
    };

    const handleWindowBlur = () => {
      if (attempting) {
        logSecurityEvent('window_blur', 'Window lost focus');
      }
    };

    const handleFullScreenChange = () => {
      const isCurrentlyFullScreen = !!document.fullscreenElement;
      setIsFullScreen(isCurrentlyFullScreen);
      
      if (attempting && task?.settings?.fullScreenRequired && !isCurrentlyFullScreen) {
        logSecurityEvent('fullscreen_exit', 'User exited fullscreen mode');
      }
    };

    const handleKeyDown = (e) => {
      if (attempting && task?.settings?.preventCopyPaste) {
        if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
          e.preventDefault();
          logSecurityEvent('copy_attempt', `Attempted ${e.key.toUpperCase()} shortcut`);
        }
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
          e.preventDefault();
          logSecurityEvent('dev_tools_attempt', 'Attempted to open developer tools');
        }
      }
    };

    const handleContextMenu = (e) => {
      if (attempting && task?.settings?.preventCopyPaste) {
        e.preventDefault();
        logSecurityEvent('right_click', 'Right-click attempted');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [attempting, task, logSecurityEvent]);

  // Timer management
  useEffect(() => {
    if (attempting && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSubmit(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [attempting, timeLeft]);

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  const fetchTask = async () => {
    try {
      const taskDoc = await getDoc(doc(db, 'tasks', taskId));
      if (taskDoc.exists()) {
        const taskData = { id: taskDoc.id, ...taskDoc.data() };
        setTask(taskData);
        
        if (taskData.type === 'quiz' && taskData.settings?.timeLimit) {
          setTimeLeft(taskData.settings.timeLimit * 60);
        }
        
        if (taskData.settings?.randomizeQuestions && taskData.content?.questions) {
          const shuffled = [...taskData.content.questions].sort(() => Math.random() - 0.5);
          setTask(prev => ({
            ...prev,
            content: { ...prev.content, questions: shuffled }
          }));
        }
      } else {
        toast.error('Task not found');
        navigate('/student/tasks');
      }
    } catch (error) {
      console.error('Error fetching task:', error);
      toast.error('Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  const startAttempt = async () => {
    try {
      if (task.settings?.fullScreenRequired) {
        if (containerRef.current && containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
          setIsFullScreen(true);
        }
      }

      const attemptData = {
        taskId: task.id,
        studentId: auth.currentUser.uid,
        startedAt: serverTimestamp(),
        status: 'in_progress',
        securityEvents: [],
        browserInfo: {
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        warningCount: 0,
        maxWarningsReached: false
      };

      const attemptRef = await addDoc(collection(db, 'task_attempts'), attemptData);
      setAttemptId(attemptRef.id);
      setStartTime(new Date());
      setAttempting(true);
      
      toast.success('Task started successfully');
    } catch (error) {
      console.error('Error starting attempt:', error);
      toast.error('Failed to start task');
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = (task.settings?.maxFileSize || 10) * 1024 * 1024;
    const allowedTypes = task.settings?.allowedFileTypes || ['pdf', 'doc', 'docx'];
    
    files.forEach(file => {
      if (file.size > maxSize) {
        toast.error(`File ${file.name} is too large`);
        return;
      }
      
      const fileExtension = file.name.split('.').pop().toLowerCase();
      if (!allowedTypes.includes(fileExtension)) {
        toast.error(`File type .${fileExtension} not allowed`);
        return;
      }
      
      setUploadedFiles(prev => [...prev, {
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date()
      }]);
    });
  };

  const calculateScore = () => {
    if (task.type !== 'quiz') return { totalMarks: 0, marksObtained: 0, percentage: 0 };
    
    let totalMarks = 0;
    let marksObtained = 0;
    
    task.content.questions.forEach(question => {
      totalMarks += question.marks || 1;
      const userAnswer = answers[question.id];
      
      if (question.type === 'mcq' && userAnswer === question.correctAnswer) {
        marksObtained += question.marks || 1;
      } else if (question.type === 'true_false' && userAnswer === question.correctAnswer) {
        marksObtained += question.marks || 1;
      }
    });
    
    const percentage = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0;
    return { totalMarks, marksObtained, percentage };
  };

  const getGrade = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      if (attemptId) {
        await updateDoc(doc(db, 'task_attempts', attemptId), {
          endedAt: serverTimestamp(),
          status: autoSubmit ? 'terminated' : 'completed',
          securityEvents,
          warningCount,
          maxWarningsReached: warningCount >= maxWarnings
        });
      }

      const scoreData = calculateScore();
      
      // Fetch student's roll number from their profile
      let studentRoll = localStorage.getItem('rollNumber') || '';
      if (!studentRoll) {
        try {
          const studentDoc = await getDoc(doc(db, 'students', auth.currentUser.uid));
          if (studentDoc.exists()) {
            studentRoll = studentDoc.data().rollNumber || '';
            if (studentRoll) {
              localStorage.setItem('rollNumber', studentRoll);
            }
          }
        } catch (error) {
          console.warn('Could not fetch student roll number:', error);
        }
      }
      
      const submissionData = {
        taskId: task.id,
        studentId: auth.currentUser.uid,
        studentName: auth.currentUser.displayName || 'Student',
        studentRoll: studentRoll,
        submittedAt: serverTimestamp(),
        startedAt: startTime,
        timeSpent: Math.floor((new Date() - startTime) / 60000),
        status: 'submitted',
        attemptNumber: 1,
        submission: {
          answers: Object.entries(answers).map(([questionId, answer]) => ({
            questionId,
            answer,
            isCorrect: task.type === 'quiz' ? 
              task.content.questions.find(q => q.id === questionId)?.correctAnswer === answer : null
          })),
          files: uploadedFiles
        },
        ...scoreData,
        grade: task.type === 'quiz' ? getGrade(scoreData.percentage) : null
      };

      await addDoc(collection(db, 'task_submissions'), submissionData);
      
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      
      toast.success(autoSubmit ? 'Task auto-submitted due to security violation' : 'Task submitted successfully');
      navigate('/student/tasks');
      
    } catch (error) {
      console.error('Error submitting task:', error);
      toast.error('Failed to submit task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderQuestion = (question, index) => {
    const userAnswer = answers[question.id];
    
    return (
      <div key={question.id} className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Question {index + 1}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </h3>
          {task.type === 'quiz' && (
            <span className="text-sm text-gray-500">
              {question.marks || 1} mark{(question.marks || 1) > 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        <p className="text-gray-700 mb-4">{question.question}</p>
        
        {/* MCQ */}
        {question.type === 'mcq' && (
          <div className="space-y-2">
            {question.options.map((option, optionIndex) => (
              <label key={optionIndex} className="flex items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value={optionIndex}
                  checked={userAnswer === optionIndex}
                  onChange={(e) => handleAnswerChange(question.id, parseInt(e.target.value))}
                  className="mr-3"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        )}
        
        {/* True/False */}
        {question.type === 'true_false' && (
          <div className="space-y-2">
            <label className="flex items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                value="true"
                checked={userAnswer === 'true'}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                className="mr-3"
              />
              <span>True</span>
            </label>
            <label className="flex items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                value="false"
                checked={userAnswer === 'false'}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                className="mr-3"
              />
              <span>False</span>
            </label>
          </div>
        )}
        
        {/* Text Input */}
        {(question.type === 'text' || question.type === 'textarea') && (
          <div>
            {question.type === 'text' ? (
              <input
                type="text"
                value={userAnswer || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your answer..."
              />
            ) : (
              <textarea
                value={userAnswer || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="4"
                placeholder="Enter your answer..."
              />
            )}
          </div>
        )}

        {/* Rating */}
        {question.type === 'rating' && (
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5].map(rating => (
              <button
                key={rating}
                type="button"
                onClick={() => handleAnswerChange(question.id, rating)}
                className={`w-10 h-10 rounded-full border-2 ${
                  userAnswer === rating
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 text-gray-600 hover:border-blue-400'
                }`}
              >
                {rating}
              </button>
            ))}
          </div>
        )}

        {/* Star Rating */}
        {question.type === 'star_rating' && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              {Array.from({ length: question.maxStars || 5 }, (_, index) => {
                const starValue = index + 1;
                return (
                  <button
                    key={starValue}
                    type="button"
                    onClick={() => handleAnswerChange(question.id, starValue)}
                    className={`text-2xl transition-colors ${
                      userAnswer >= starValue
                        ? 'text-yellow-400 hover:text-yellow-500'
                        : 'text-gray-300 hover:text-yellow-300'
                    }`}
                  >
                    ★
                  </button>
                );
              })}
              {userAnswer && (
                <span className="ml-3 text-sm text-gray-600">
                  {userAnswer} out of {question.maxStars || 5} stars
                </span>
              )}
            </div>
            {question.labels && question.labels.length > 0 && (
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>{question.labels[0]}</span>
                {question.labels[1] && <span>{question.labels[1]}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Task Not Found</h2>
        <p className="text-gray-600">The requested task could not be found.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-gray-50">
      {/* Security Warning Bar */}
      {attempting && warningCount > 0 && (
        <div className="bg-red-100 border-b border-red-200 px-4 py-2">
          <div className="flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
            <span className="text-sm text-red-800">
              Warning {warningCount}/{maxWarnings}: Suspicious activity detected. 
              {warningCount >= maxWarnings ? ' Test will be auto-submitted.' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{task.title}</h1>
              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
            </div>
            
            {attempting && (
              <div className="flex items-center space-x-4">
                {task.type === 'quiz' && task.settings?.timeLimit && (
                  <div className={`flex items-center px-3 py-2 rounded-md ${
                    timeLeft <= 300 ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    <Clock className="h-4 w-4 mr-2" />
                    <span className="font-mono text-sm">{formatTime(timeLeft)}</span>
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  {task.settings?.fullScreenRequired && (
                    <div className={`p-2 rounded-md ${
                      isFullScreen ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      <Shield className="h-4 w-4" />
                    </div>
                  )}
                  
                  {warningCount > 0 && (
                    <div className="bg-red-100 text-red-800 px-2 py-1 rounded-md text-xs">
                      {warningCount}/{maxWarnings} warnings
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {!attempting ? (
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Start?</h2>
              <p className="text-gray-600 mb-6">
                Please review the instructions below before starting the task.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Task Details</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>Type: {task.type.charAt(0).toUpperCase() + task.type.slice(1)}</li>
                  {task.type === 'quiz' && task.settings?.timeLimit && (
                    <li>Time Limit: {task.settings.timeLimit} minutes</li>
                  )}
                  {task.settings?.maxMarks && (
                    <li>Total Marks: {task.settings.maxMarks}</li>
                  )}
                  {task.content?.questions && (
                    <li>Questions: {task.content.questions.length}</li>
                  )}
                </ul>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Security Settings</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  {task.settings?.fullScreenRequired && (
                    <li className="flex items-center">
                      <Shield className="h-3 w-3 mr-1" />
                      Full-screen required
                    </li>
                  )}
                  {task.settings?.preventCopyPaste && (
                    <li className="flex items-center">
                      <XCircle className="h-3 w-3 mr-1" />
                      Copy/paste disabled
                    </li>
                  )}
                  <li>Attempt limit: {task.settings?.attemptLimit || 1}</li>
                </ul>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={startAttempt}
                className="flex items-center justify-center px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium mx-auto"
              >
                <Play className="h-5 w-5 mr-2" />
                Start Task
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6">
              {(task.type === 'quiz' || task.type === 'feedback' || task.type === 'survey') && task.content?.questions && (
                <div>
                  {task.content.questions.map((question, index) => 
                    renderQuestion(question, index)
                  )}
                </div>
              )}

              {task.type === 'assignment' && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Assignment</h3>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">Upload your assignment files</p>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                  
                  {uploadedFiles.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-gray-900 mb-2">Uploaded Files:</h4>
                      <ul className="space-y-2">
                        {uploadedFiles.map((file, index) => (
                          <li key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm">{file.name}</span>
                            <span className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  {Object.keys(answers).length} of {task.content?.questions?.length || 0} answered
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={isSubmitting}
                    className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Submitting...' : 'Submit Task'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskAttempt;
