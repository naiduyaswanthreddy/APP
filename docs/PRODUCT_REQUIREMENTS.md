# Product Requirements Document (PRD)

Title: Campus Placement Management System
Owner: Product + Engineering
Last Updated: 2025-08-17
Status: Draft v1

## 1. Overview

The Campus Placement Management System streamlines end-to-end campus recruitment. It connects Students, Admins (T&P office), and Companies to manage job postings, applications, assessments, interviews, and outcomes with real-time updates, analytics, and notifications.

- Purpose: Digitize and centralize placement operations to improve transparency, speed, and outcomes.
- Primary Users: Students, Admins, Companies (HR/recruiters).
- Platform: Web app (React + Firebase). Mobile responsive.

## 2. Goals & Non-Goals

- Goals
  - Increase placement process efficiency and transparency.
  - Provide reliable communications (push + email).
  - Enable data-driven decisions via analytics dashboards.
  - Secure, role-based access to data and actions.
- Non-Goals (v1)
  - Full ATS for external companies beyond core flows.
  - Offline-first mobile apps.
  - Advanced proctoring or plagiarism detection.

## 3. Success Metrics (North Stars)

- 90% reduction in manual email/WhatsApp coordination for placements.
- <2 min median time to publish a job and notify eligible students.
- >70% student profile completeness within 14 days of onboarding.
- >95% delivery rate for notifications (push/email) for critical events.
- Admin task time reduced by 50% for shortlisting and scheduling.

## 4. Personas

- Student: Final/Pre-final year; manages profile, applies, tracks status, prepares.
- Admin (T&P): Manages jobs, eligibility, student lists, communications, schedules.
- Company Recruiter: Posts jobs, reviews candidates, shares results (limited v1).

## 5. Scope Summary (v1)

- Auth with roles (Student/Admin/Company)
- Student profiles and document uploads
- Job postings with eligibility and application management
- Notifications (FCM push + SendGrid email)
- Admin analytics dashboards (Chart.js)
- Event/calendar scheduling (drives reminders)
- Resource library and announcements
- Resume generation/export (PDF), export to Excel (XLSX)
- Gallery for placement activities

## 6. Detailed Features

### 6.1 Authentication & Roles
- Firebase Auth (email/password, OTP optional later)
- Roles: student, admin, company; claims stored in Auth/Firestore
- Session management, password reset, email verification

### 6.2 Student Profile Management
- Personal, academic, skills, projects, certifications, links (GitHub, LinkedIn)
- Documents: Resume(s), transcripts, certificates (Firebase Storage)
- Profile completeness meter and prompts
- Privacy controls (shareable fields to companies)

### 6.3 Job Posting & Application Management
- Admin/Company creates job with title, description, CTC, location, type, deadline
- Eligibility rules: batch, branch, CGPA, backlogs, gender, skills, custom
- Publishing triggers notifications to eligible students
- Students view, bookmark, and apply (single-click; attach selected resume)
- Application status: Applied, Shortlisted, Rejected, On Hold, Offer
- Bulk actions: shortlist/reject, CSV/XLSX export

### 6.4 Scheduling & Events
- Drive campus rounds: Test, GD, Tech Interview, HR Interview
- Create event with date/time/venue/online link; attach candidate list
- Attendance tracking (optional later)
- Reminders and updates via notifications

### 6.5 Notifications & Communication
- Push: Firebase Cloud Messaging (web)
- Email: SendGrid transactional
- Templates for: job published, deadline reminders, status updates, schedule
- In-app inbox/alerts center and read/unread state

### 6.6 Analytics & Reporting (Admin)
- Dashboard KPIs: jobs posted, applications, conversion rate, offers, company mix
- Charts: time-series of applications, branch-wise distribution, CGPA bands
- Downloadable reports (XLSX), printable summaries (PDF)

### 6.7 Resources & Announcements
- Admin posts guides, policies, prep materials; tags and filters
- Announcements with priority and expiry

### 6.8 Gallery
- Albums for placement events; image upload with captions

### 6.9 Company Portal (Limited v1)
- Post/clone jobs, view applicants, basic filters
- Provide outcomes (shortlist/offer) and feedback

## 7. User Flows

### 7.1 Student
1) Sign up/login ➜ complete profile ➜ upload resume
2) Browse eligible jobs ➜ apply/bookmark ➜ track status
3) Receive notifications ➜ attend events ➜ receive offer result

### 7.2 Admin
1) Login ➜ create job with eligibility ➜ publish
2) Monitor applications ➜ shortlist/reject (bulk) ➜ schedule rounds
3) Send communications ➜ finalize outcomes ➜ analytics/reporting

### 7.3 Company
1) Login ➜ post job ➜ review candidates ➜ share results

## 8. Information Architecture & Data Model (Firestore)

Collections (indicative; exact sub-collections may vary):

- users
  - id, role, email, name, phone, claims, createdAt, lastLogin
- studentProfiles
  - userId, personal, academics(CGPA, backlogs), skills, projects, links
  - resumes: [storagePath, label, updatedAt]
  - completeness: number
- jobs
  - id, title, description, company, ctc, location, type, deadline, createdBy
  - eligibility: batch, branches[], minCgpa, maxBacklogs, skills[], customRules
  - status: draft|published|closed, createdAt, updatedAt
- applications
  - id, jobId, studentId, status, resumeRef, timestamps
- events
  - id, jobId, roundType, dateTime, venue, link, candidateIds[], notes
- notifications
  - id, toUserId or segment, type, payload, sentAt, readAt
- resources
  - id, title, content/url, tags[], visibility, createdAt
- announcements
  - id, title, body, priority, expiresAt
- gallery
  - id, album, images[{storagePath, caption, createdAt}]
- auditLogs (optional later)

Storage
- path: resumes/{userId}/{filename}
- path: gallery/{albumId}/{image}

Security Rules
- Role-based access control on collections
- Document-level rules for ownership (students only read/write own profile)
- Validation for job edit permissions (admin/company only)

## 9. Non-Functional Requirements

- Performance: p95 page load < 2.5s on 4G; cache with SW and query caching
- Availability: 99.5% monthly (Firebase SLA)
- Security: Firebase Auth + Firestore rules; least-privilege; audit trail later
- Privacy: consent for sharing profile; data retention policy
- Accessibility: WCAG AA targets; keyboard and screen-reader friendly
- Internationalization: English v1; extensible for i18n
- Scalability: Firestore sub-collection strategy; indexed queries; pagination

## 10. Integrations

- Firebase: Auth, Firestore, Functions, Storage, Messaging
- SendGrid: transactional emails (API key required in `.env`)
- Chart.js: analytics visuals
- jsPDF / @react-pdf/renderer: resume and report export
- xlsx: admin exports

## 11. System Architecture (High-Level)

- Frontend: React 18, Material-UI, Tailwind, React Router
- Backend: Firebase Cloud Functions (Node.js) for triggers and secure ops
- Data: Firestore (NoSQL), Storage for files
- Messaging: FCM service worker at `public/firebase-messaging-sw.js`

Key Flows via Functions
- On job publish ➜ resolve eligible students ➜ send notifications (push+email)
- On application status change ➜ notify student
- Daily cron ➜ deadline reminders, event reminders

## 12. Roles & Permissions Matrix (v1)

- Student
  - Read: own profile, eligible jobs, announcements, resources
  - Write: own profile, applications
- Admin
  - Read/Write: jobs, applications, events, resources, announcements, gallery
  - Manage: eligibility, status, communications, analytics
- Company
  - Read/Write: own jobs; read applicants to own jobs; update outcomes

## 13. UX & UI Notes

- Navigation: role-based menus; clear status badges; mobile responsive
- Tables with server-side pagination for large lists
- Empty states and inline guidance to improve profile completeness
- Confirmation modals for destructive actions

## 14. Analytics Events (examples)

- profile_completed, job_published, application_submitted, shortlist_action
- event_created, notification_sent, offer_marked

## 15. Release Plan

- MVP (v1)
  - Auth + roles, profiles, job posting, apply, notifications, basic analytics
- v1.1
  - Scheduling UI, exports, announcements, gallery
- v2
  - Company self-service enhancements, interview feedback forms, audit logs

## 16. Risks & Mitigations

- Data model complexity ➜ document conventions, indexes, tests
- Notification deliverability ➜ fallback to email, bounce monitoring
- Access control errors ➜ strict rules + automated tests

## 17. Open Questions

- Eligibility rule builder: do we need a visual rule composer in v1?
- Multi-resume support policies per job (e.g., resume slotting)?
- Company onboarding flow: self-signup or admin-provisioned?
- Placement drives versus individual job postings linkage?

## 18. Appendices

- Env & Keys
  - Firebase config (client), service account (functions), SendGrid API key
- Compliance
  - Student consent for data sharing; archival after graduation window
