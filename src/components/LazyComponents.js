import { lazy } from 'react';

// Lazy load all major components for code splitting
export const LazyJobCards = lazy(() => import('./student/OptimizedJobCards'));
export const LazyJobDetails = lazy(() => import('./student/JobDetails'));
export const LazyAnalytics = lazy(() => import('./admin/Analytics'));
export const LazyDashboard = lazy(() => import('./admin/Dashboard'));
export const LazyStudents = lazy(() => import('./admin/Students'));
export const LazyJobPost = lazy(() => import('./admin/JobPost'));
export const LazyApplications = lazy(() => import('./admin/Applications'));
export const LazyReports = lazy(() => import('./admin/Reports'));
export const LazyCalendar = lazy(() => import('./admin/Calendar'));
export const LazyCompanies = lazy(() => import('./admin/Companies'));
export const LazyResources = lazy(() => import('./admin/Resources'));
export const LazyGallery = lazy(() => import('./admin/Gallery'));
export const LazyNotifications = lazy(() => import('./admin/Notifications'));
export const LazyTaskManagement = lazy(() => import('./admin/TaskManagement'));

// Student components
export const LazyStudentDashboard = lazy(() => import('./student/Dashboard'));
export const LazyStudentApplications = lazy(() => import('./student/Applications'));
export const LazyStudentProfile = lazy(() => import('./student/Profile'));
export const LazyStudentCalendar = lazy(() => import('./student/Calendar'));
export const LazyStudentResources = lazy(() => import('./student/Resources'));
export const LazyStudentGallery = lazy(() => import('./student/Gallery'));
export const LazyStudentNotifications = lazy(() => import('./student/Notifications'));
export const LazyStudentTasks = lazy(() => import('./student/TasksPage'));

// Profile components
export const LazyProfileBasic = lazy(() => import('./student/ProfileBasic'));
export const LazyProfileAcademics = lazy(() => import('./student/ProfileAcademics'));
export const LazyProfileCareer = lazy(() => import('./student/ProfileCareer'));
