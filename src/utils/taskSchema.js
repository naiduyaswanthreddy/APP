/**
 * Database Schema Design for Tasks & Assessments Module
 * 
 * Collections:
 * 1. tasks - Main task collection
 * 2. task_submissions - Student submissions
 * 3. task_attempts - Track test attempts and security events
 */

// Task Document Structure
export const taskSchema = {
  // Basic Information
  id: "auto-generated",
  title: "string",
  description: "string",
  type: "feedback|survey|quiz|assignment|reading", // Task types
  
  // Scheduling
  createdAt: "timestamp",
  updatedAt: "timestamp",
  startDate: "timestamp", // When task becomes visible
  endDate: "timestamp", // Deadline
  
  // Target Audience
  targetType: "all|branch|selected", // Targeting type
  targetBranches: ["CSE", "ECE"], // If branch-specific
  targetStudents: ["studentId1", "studentId2"], // If student-specific
  
  // Task Configuration
  settings: {
    // General Settings
    maxMarks: "number", // For quizzes/tests
    weightage: "number", // Importance weight
    attemptLimit: "number", // Max attempts allowed
    
    // Test-Specific Settings
    timeLimit: "number", // Minutes for tests
    fullScreenRequired: "boolean",
    randomizeQuestions: "boolean",
    preventCopyPaste: "boolean",
    showResults: "boolean", // Show results immediately
    
    // Assignment Settings
    allowedFileTypes: ["pdf", "doc", "docx"],
    maxFileSize: "number", // MB
    
    // Reading/Video Settings
    contentUrl: "string",
    minViewTime: "number" // Minimum time to spend
  },
  
  // Content (varies by type)
  content: {
    // For Feedback Forms
    questions: [
      {
        id: "string",
        type: "text|textarea|rating|multiple_choice",
        question: "string",
        options: ["option1", "option2"], // For multiple choice
        required: "boolean"
      }
    ],
    
    // For Quizzes
    questions: [
      {
        id: "string",
        type: "mcq|true_false|coding",
        question: "string",
        options: ["A", "B", "C", "D"], // For MCQ
        correctAnswer: "string|number",
        marks: "number",
        explanation: "string"
      }
    ],
    
    // For Assignments
    instructions: "string",
    rubric: "string",
    
    // For Reading/Video
    contentType: "url|embed|file",
    contentData: "string"
  },
  
  // Status and Stats
  status: "draft|active|completed|archived",
  stats: {
    totalAssigned: "number",
    totalSubmitted: "number",
    totalPending: "number",
    averageScore: "number"
  },
  
  // Creator Info
  createdBy: "adminId",
  createdByName: "string"
};

// Task Submission Document Structure
export const submissionSchema = {
  id: "auto-generated",
  taskId: "string",
  studentId: "string",
  studentName: "string",
  studentRoll: "string",
  
  // Submission Data
  submittedAt: "timestamp",
  startedAt: "timestamp",
  timeSpent: "number", // Minutes
  
  // Content (varies by task type)
  submission: {
    // For Feedback/Survey
    answers: [
      {
        questionId: "string",
        answer: "string|number|array"
      }
    ],
    
    // For Quiz/Test
    answers: [
      {
        questionId: "string",
        selectedAnswer: "string",
        isCorrect: "boolean",
        marksAwarded: "number"
      }
    ],
    
    // For Assignment
    files: [
      {
        fileName: "string",
        fileUrl: "string",
        fileSize: "number",
        uploadedAt: "timestamp"
      }
    ],
    
    // For Reading/Video
    viewTime: "number",
    completed: "boolean"
  },
  
  // Scoring
  totalMarks: "number",
  marksObtained: "number",
  percentage: "number",
  grade: "string", // A, B, C, D, F
  
  // Status
  status: "in_progress|submitted|graded|late",
  attemptNumber: "number",
  
  // Feedback
  feedback: "string",
  gradedBy: "string",
  gradedAt: "timestamp"
};

// Task Attempt Document Structure (for security tracking)
export const attemptSchema = {
  id: "auto-generated",
  taskId: "string",
  studentId: "string",
  submissionId: "string",
  
  // Attempt Info
  startedAt: "timestamp",
  endedAt: "timestamp",
  status: "in_progress|completed|terminated|abandoned",
  
  // Security Events
  securityEvents: [
    {
      type: "tab_switch|window_blur|fullscreen_exit|copy_attempt|paste_attempt|right_click",
      timestamp: "timestamp",
      details: "string"
    }
  ],
  
  // Browser Info
  browserInfo: {
    userAgent: "string",
    screenResolution: "string",
    timezone: "string"
  },
  
  // Warnings
  warningCount: "number",
  maxWarningsReached: "boolean"
};

// Helper functions for schema validation
export const validateTaskData = (taskData) => {
  const required = ['title', 'type', 'endDate', 'targetType'];
  const missing = required.filter(field => !taskData[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  
  // Validate task type
  const validTypes = ['feedback', 'survey', 'quiz', 'assignment', 'reading'];
  if (!validTypes.includes(taskData.type)) {
    throw new Error(`Invalid task type: ${taskData.type}`);
  }
  
  // Validate dates
  if (taskData.startDate && taskData.endDate && taskData.startDate >= taskData.endDate) {
    throw new Error('Start date must be before end date');
  }
  
  return true;
};

export const validateSubmissionData = (submissionData, taskType) => {
  const required = ['taskId', 'studentId'];
  const missing = required.filter(field => !submissionData[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  
  // Type-specific validation
  switch (taskType) {
    case 'quiz':
      if (!submissionData.submission?.answers?.length) {
        throw new Error('Quiz submission must have answers');
      }
      break;
    case 'assignment':
      if (!submissionData.submission?.files?.length) {
        throw new Error('Assignment submission must have files');
      }
      break;
  }
  
  return true;
};
