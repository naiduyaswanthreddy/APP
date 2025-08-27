import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { validateTaskData } from '../../utils/taskSchema';
import { toast } from 'react-toastify';
import { notifyTaskCreated, scheduleTaskReminders } from '../../utils/taskNotifications';
import { createTaskCalendarEvent, createTaskReminderEvent } from '../../utils/calendarIntegration';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  Users, 
  Settings, 
  FileText, 
  MessageSquare,
  BarChart3,
  BookOpen,
  Upload,
  Clock,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';

const TaskCreation = () => {
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    type: 'feedback',
    startDate: '',
    endDate: '',
    targetType: 'all',
    targetBranches: [],
    targetStudents: [],
    settings: {
      maxMarks: 100,
      weightage: 1,
      attemptLimit: 1,
      timeLimit: 60,
      fullScreenRequired: false,
      randomizeQuestions: false,
      preventCopyPaste: false,
      showResults: true,
      allowedFileTypes: ['pdf', 'doc', 'docx'],
      maxFileSize: 10,
      contentUrl: '',
      minViewTime: 5
    },
    content: {
      questions: []
    }
  });
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  const [students, setStudents] = useState([]);
  const [branches, setBranches] = useState(['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL']);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [collapsedQuestions, setCollapsedQuestions] = useState(new Set());

  useEffect(() => {
    fetchStudents();
  }, []);

  // Filter students based on search query
  const filteredStudents = students.filter(student => {
    const searchLower = studentSearchQuery.toLowerCase();
    return (
      student.name?.toLowerCase().includes(searchLower) ||
      student.rollNumber?.toLowerCase().includes(searchLower) ||
      student.email?.toLowerCase().includes(searchLower) ||
      student.branch?.toLowerCase().includes(searchLower)
    );
  });

  const fetchStudents = async () => {
    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      const studentsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudents(studentsList);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const taskTypes = [
    { value: 'feedback', label: 'Feedback Form', icon: MessageSquare, description: 'Collect feedback from students' },
    { value: 'survey', label: 'Survey', icon: BarChart3, description: 'Multi-question surveys' },
    { value: 'quiz', label: 'Quiz/Test', icon: FileText, description: 'MCQs, True/False, coding tests' },
    { value: 'assignment', label: 'Assignment', icon: Upload, description: 'File upload assignments' },
    { value: 'reading', label: 'Reading/Video', icon: BookOpen, description: 'Content consumption tracking' }
  ];

  const questionTypes = {
    feedback: ['text', 'textarea', 'rating', 'star_rating', 'multiple_choice'],
    survey: ['text', 'textarea', 'rating', 'star_rating', 'multiple_choice', 'checkbox'],
    quiz: ['mcq', 'true_false', 'coding']
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setTaskData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setTaskData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const addQuestion = () => {
    const newQuestion = {
      id: Date.now().toString(),
      type: questionTypes[taskData.type][0],
      question: '',
      options: taskData.type === 'quiz' ? ['', '', '', ''] : [''],
      required: true,
      correctAnswer: taskData.type === 'quiz' ? 0 : null,
      marks: taskData.type === 'quiz' ? 1 : null
    };

    setTaskData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        questions: [...prev.content.questions, newQuestion]
      }
    }));
    
    // Keep new questions expanded by default
    setCollapsedQuestions(prev => new Set([...prev]));
  };

  const toggleQuestionCollapse = (questionId) => {
    setCollapsedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const updateQuestion = (questionId, field, value) => {
    setTaskData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        questions: prev.content.questions.map(q => 
          q.id === questionId ? { ...q, [field]: value } : q
        )
      }
    }));
  };

  const removeQuestion = (questionId) => {
    setTaskData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        questions: prev.content.questions.filter(q => q.id !== questionId)
      }
    }));
  };

  const addOption = (questionId) => {
    setTaskData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        questions: prev.content.questions.map(q => 
          q.id === questionId ? { ...q, options: [...q.options, ''] } : q
        )
      }
    }));
  };

  const updateOption = (questionId, optionIndex, value) => {
    setTaskData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        questions: prev.content.questions.map(q => 
          q.id === questionId ? {
            ...q,
            options: q.options.map((opt, idx) => idx === optionIndex ? value : opt)
          } : q
        )
      }
    }));
  };

  const removeOption = (questionId, optionIndex) => {
    setTaskData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        questions: prev.content.questions.map(q => 
          q.id === questionId ? {
            ...q,
            options: q.options.filter((_, idx) => idx !== optionIndex)
          } : q
        )
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate task data
      validateTaskData(taskData);

      // Prepare task document
      const taskDoc = {
        ...taskData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        startDate: taskData.startDate ? new Date(taskData.startDate) : serverTimestamp(),
        endDate: new Date(taskData.endDate),
        status: 'draft',
        stats: {
          totalAssigned: 0,
          totalSubmitted: 0,
          totalPending: 0,
          averageScore: 0
        },
        createdBy: 'admin', // Replace with actual admin ID
        createdByName: 'Admin' // Replace with actual admin name
      };

      // Add to Firestore
      const taskRef = await addDoc(collection(db, 'tasks'), taskDoc);
      const taskId = taskRef.id;

      // Send notifications to target students
      try {
        let targetStudentIds = [];
        
        if (taskData.targetType === 'all') {
          // Get all student IDs
          targetStudentIds = students.map(student => student.id);
        } else if (taskData.targetType === 'branch') {
          // Get students from selected branches
          targetStudentIds = students
            .filter(student => taskData.targetBranches.includes(student.branch))
            .map(student => student.id);
        } else if (taskData.targetType === 'selected') {
          // Use selected student IDs
          targetStudentIds = taskData.targetStudents;
        }

        // Send new task notifications
        await notifyTaskCreated(taskId);

        // Create calendar event for the task
        await createTaskCalendarEvent(taskId, taskData, targetStudentIds);

        // Schedule deadline reminders (24 hours before deadline)
        const deadlineDate = new Date(taskData.endDate);
        const reminderDate = new Date(deadlineDate.getTime() - 24 * 60 * 60 * 1000);
        
        if (reminderDate > new Date()) {
          // Schedule notification reminders
          await scheduleTaskReminders(taskId);
          
          // Create calendar reminder event
          await createTaskReminderEvent(taskId, taskData, targetStudentIds, reminderDate);
        }

        toast.success(`Task created successfully! Notifications and calendar events created for ${targetStudentIds.length} students.`);
      } catch (notificationError) {
        console.error('Error sending notifications:', notificationError);
        toast.success('Task created successfully, but some notifications may not have been sent.');
      }
      
      // Reset form
      setTaskData({
        title: '',
        description: '',
        type: 'feedback',
        startDate: '',
        endDate: '',
        targetType: 'all',
        targetBranches: [],
        targetStudents: [],
        settings: {
          maxMarks: 100,
          weightage: 1,
          attemptLimit: 1,
          timeLimit: 60,
          fullScreenRequired: false,
          randomizeQuestions: false,
          preventCopyPaste: false,
          showResults: true,
          allowedFileTypes: ['pdf', 'doc', 'docx'],
          maxFileSize: 10,
          contentUrl: '',
          minViewTime: 5
        },
        content: {
          questions: []
        }
      });

    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderQuestionEditor = (question, index) => {
    const isCollapsed = collapsedQuestions.has(question.id);
    
    return (
      <div key={question.id} className="border border-gray-200 rounded-lg mb-4">
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-t-lg">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => toggleQuestionCollapse(question.id)}
              className="mr-3 text-gray-600 hover:text-gray-800"
            >
              {isCollapsed ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <h4 className="font-medium text-gray-900">
              Question {index + 1}
              {question.question && (
                <span className="text-sm text-gray-600 ml-2">
                  - {question.question.substring(0, 50)}{question.question.length > 50 ? '...' : ''}
                </span>
              )}
            </h4>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={addQuestion}
              className="flex items-center px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              <Plus size={14} className="mr-1" />
              Add
            </button>
            <button
              type="button"
              onClick={() => removeQuestion(question.id)}
              className="text-red-600 hover:text-red-800"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        
        {!isCollapsed && (
          <div className="p-4">

        {/* Question Type */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question Type
          </label>
          <select
            value={question.type}
            onChange={(e) => updateQuestion(question.id, 'type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {questionTypes[taskData.type].map(type => (
              <option key={type} value={type}>
                {type.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Question Text */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question
          </label>
          <textarea
            value={question.question}
            onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="2"
            placeholder="Enter your question..."
          />
        </div>

        {/* Options for MCQ/Multiple Choice */}
        {(question.type === 'mcq' || question.type === 'multiple_choice' || question.type === 'checkbox') && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Options
              {(taskData.type === 'quiz' || taskData.type === 'test') && (
                <span className="text-xs text-green-600 ml-2">(Select correct answer)</span>
              )}
            </label>
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center mb-2">
                {(taskData.type === 'quiz' || taskData.type === 'test') && (
                  <div className="flex items-center mr-3">
                    <input
                      type="radio"
                      name={`correct-${question.id}`}
                      checked={question.correctAnswer === optionIndex}
                      onChange={() => updateQuestion(question.id, 'correctAnswer', optionIndex)}
                      className="mr-1"
                    />
                    <span className="text-xs text-green-600">✓</span>
                  </div>
                )}
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                  className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    (taskData.type === 'quiz' || taskData.type === 'test') && question.correctAnswer === optionIndex
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300'
                  }`}
                  placeholder={`Option ${optionIndex + 1}`}
                />
                {question.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(question.id, optionIndex)}
                    className="ml-2 text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addOption(question.id)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              + Add Option
            </button>
          </div>
        )}

        {/* True/False Correct Answer */}
        {question.type === 'true_false' && (taskData.type === 'quiz' || taskData.type === 'test') && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Correct Answer
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name={`correct-tf-${question.id}`}
                  value="true"
                  checked={question.correctAnswer === 'true'}
                  onChange={() => updateQuestion(question.id, 'correctAnswer', 'true')}
                  className="mr-2"
                />
                <span className="text-green-600">True</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name={`correct-tf-${question.id}`}
                  value="false"
                  checked={question.correctAnswer === 'false'}
                  onChange={() => updateQuestion(question.id, 'correctAnswer', 'false')}
                  className="mr-2"
                />
                <span className="text-green-600">False</span>
              </label>
            </div>
          </div>
        )}

        {/* Star Rating Configuration */}
        {question.type === 'star_rating' && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Star Rating Configuration
            </label>
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max Stars</label>
                <select
                  value={question.maxStars || 5}
                  onChange={(e) => updateQuestion(question.id, 'maxStars', parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={3}>3 Stars</option>
                  <option value={5}>5 Stars</option>
                  <option value={10}>10 Stars</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Labels (Optional)</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Poor"
                    value={question.minLabel || ''}
                    onChange={(e) => updateQuestion(question.id, 'minLabel', e.target.value)}
                    className="w-20 px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                  <span className="text-gray-400 self-center">to</span>
                  <input
                    type="text"
                    placeholder="Excellent"
                    value={question.maxLabel || ''}
                    onChange={(e) => updateQuestion(question.id, 'maxLabel', e.target.value)}
                    className="w-20 px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>
            <div className="mt-2 p-2 bg-gray-50 rounded">
              <div className="text-xs text-gray-600 mb-1">Preview:</div>
              <div className="flex items-center space-x-1">
                {Array.from({ length: question.maxStars || 5 }, (_, i) => (
                  <span key={i} className="text-yellow-400 text-lg">★</span>
                ))}
                <span className="text-xs text-gray-500 ml-2">
                  {question.minLabel && `${question.minLabel} - `}
                  {question.maxLabel || 'Rating'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Marks for Quiz */}
        {taskData.type === 'quiz' && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Marks
            </label>
            <input
              type="number"
              value={question.marks || 1}
              onChange={(e) => updateQuestion(question.id, 'marks', parseInt(e.target.value))}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
            />
          </div>
        )}

        {/* Required Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id={`required-${question.id}`}
            checked={question.required}
            onChange={(e) => updateQuestion(question.id, 'required', e.target.checked)}
            className="mr-2"
          />
          <label htmlFor={`required-${question.id}`} className="text-sm text-gray-700">
            Required
          </label>
        </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Create New Task</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create feedback forms, surveys, quizzes, assignments, and reading tasks
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Title *
              </label>
              <input
                type="text"
                value={taskData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter task title..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Type *
              </label>
              <select
                value={taskData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {taskTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={taskData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="Describe the task..."
            />
          </div>

          {/* Scheduling */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Start Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={taskData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Deadline *
              </label>
              <input
                type="datetime-local"
                value={taskData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Target Audience */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="inline w-4 h-4 mr-1" />
              Target Audience *
            </label>
            <select
              value={taskData.targetType}
              onChange={(e) => handleInputChange('targetType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            >
              <option value="all">All Students</option>
              <option value="branch">Specific Branches</option>
              <option value="selected">Selected Students</option>
            </select>

            {taskData.targetType === 'branch' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Branches
                </label>
                <div className="flex flex-wrap gap-2">
                  {branches.map(branch => (
                    <label key={branch} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={taskData.targetBranches.includes(branch)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleInputChange('targetBranches', [...taskData.targetBranches, branch]);
                          } else {
                            handleInputChange('targetBranches', taskData.targetBranches.filter(b => b !== branch));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{branch}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {taskData.targetType === 'selected' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Students
                </label>
                
                {/* Search Input */}
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Search students by name or roll number..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Selected Students Display */}
                {taskData.targetStudents.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Selected Students ({taskData.targetStudents.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {taskData.targetStudents.map(studentId => {
                        const student = students.find(s => s.id === studentId);
                        return student ? (
                          <span
                            key={studentId}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {student.name} ({student.rollNumber})
                            <button
                              type="button"
                              onClick={() => {
                                handleInputChange('targetStudents', taskData.targetStudents.filter(id => id !== studentId));
                              }}
                              className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Student List with Search */}
                <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <div className="p-3 text-center text-gray-500">
                      {studentSearchQuery ? 'No students found matching your search' : 'No students available'}
                    </div>
                  ) : (
                    filteredStudents.map(student => (
                      <label
                        key={student.id}
                        className="flex items-center p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={taskData.targetStudents.includes(student.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleInputChange('targetStudents', [...taskData.targetStudents, student.id]);
                            } else {
                              handleInputChange('targetStudents', taskData.targetStudents.filter(id => id !== student.id));
                            }
                          }}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{student.name}</div>
                          <div className="text-xs text-gray-500">
                            {student.rollNumber} • {student.branch} • {student.email}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                
                <div className="mt-2 flex justify-between items-center">
                  <p className="text-xs text-gray-500">
                    {taskData.targetStudents.length} of {students.length} students selected
                  </p>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={() => handleInputChange('targetStudents', filteredStudents.map(s => s.id))}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Select All Visible
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInputChange('targetStudents', [])}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Advanced Settings Toggle */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              <Settings className="w-4 h-4 mr-2" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
              {showAdvanced ? <EyeOff className="w-4 h-4 ml-2" /> : <Eye className="w-4 h-4 ml-2" />}
            </button>
          </div>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-gray-900 mb-4">Advanced Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* General Settings */}
                {(taskData.type === 'quiz' || taskData.type === 'survey') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Marks
                      </label>
                      <input
                        type="number"
                        value={taskData.settings.maxMarks}
                        onChange={(e) => handleInputChange('settings.maxMarks', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Attempt Limit
                      </label>
                      <input
                        type="number"
                        value={taskData.settings.attemptLimit}
                        onChange={(e) => handleInputChange('settings.attemptLimit', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                      />
                    </div>
                  </>
                )}

                {/* Quiz-specific Settings */}
                {taskData.type === 'quiz' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Clock className="inline w-4 h-4 mr-1" />
                        Time Limit (minutes)
                      </label>
                      <input
                        type="number"
                        value={taskData.settings.timeLimit}
                        onChange={(e) => handleInputChange('settings.timeLimit', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={taskData.settings.fullScreenRequired}
                          onChange={(e) => handleInputChange('settings.fullScreenRequired', e.target.checked)}
                          className="mr-2"
                        />
                        <Shield className="w-4 h-4 mr-1" />
                        <span className="text-sm">Require Full Screen</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={taskData.settings.randomizeQuestions}
                          onChange={(e) => handleInputChange('settings.randomizeQuestions', e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm">Randomize Questions</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={taskData.settings.preventCopyPaste}
                          onChange={(e) => handleInputChange('settings.preventCopyPaste', e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm">Prevent Copy/Paste</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={taskData.settings.showResults}
                          onChange={(e) => handleInputChange('settings.showResults', e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm">Show Results Immediately</span>
                      </label>
                    </div>
                  </>
                )}

                {/* Assignment Settings */}
                {taskData.type === 'assignment' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max File Size (MB)
                      </label>
                      <input
                        type="number"
                        value={taskData.settings.maxFileSize}
                        onChange={(e) => handleInputChange('settings.maxFileSize', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Allowed File Types
                      </label>
                      <input
                        type="text"
                        value={taskData.settings.allowedFileTypes.join(', ')}
                        onChange={(e) => handleInputChange('settings.allowedFileTypes', e.target.value.split(', '))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="pdf, doc, docx"
                      />
                    </div>
                  </>
                )}

                {/* Reading/Video Settings */}
                {taskData.type === 'reading' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Content URL
                      </label>
                      <input
                        type="url"
                        value={taskData.settings.contentUrl}
                        onChange={(e) => handleInputChange('settings.contentUrl', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min View Time (minutes)
                      </label>
                      <input
                        type="number"
                        value={taskData.settings.minViewTime}
                        onChange={(e) => handleInputChange('settings.minViewTime', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Content Creation */}
          {(taskData.type === 'feedback' || taskData.type === 'survey' || taskData.type === 'quiz') && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-900">Questions</h3>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus size={16} className="mr-2" />
                  Add Question
                </button>
              </div>

              {taskData.content.questions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No questions added yet. Click "Add Question" to get started.</p>
                </div>
              ) : (
                <div>
                  {taskData.content.questions.map((question, index) => 
                    renderQuestionEditor(question, index)
                  )}
                </div>
              )}
            </div>
          )}

          {/* Assignment Instructions */}
          {taskData.type === 'assignment' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assignment Instructions
              </label>
              <textarea
                value={taskData.content.instructions || ''}
                onChange={(e) => handleInputChange('content.instructions', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="4"
                placeholder="Provide detailed instructions for the assignment..."
              />
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskCreation;
