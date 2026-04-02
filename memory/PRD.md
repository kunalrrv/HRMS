# TalentOps HRMS SaaS - Product Requirements Document

## Original Problem Statement
Build a production-ready multi-tenant HRMS SaaS application similar to BambooHR with:
- Employee Management (CRUD, profiles, org hierarchy)
- Attendance System (Clock-in/out, shift management, logs)
- Leave Management (Policies CL/SL/PL, approval workflow, balance tracking)
- Payroll System (India-specific: PF, ESI, TDS, payslip PDF)
- Recruitment ATS (Job postings, candidate pipeline, resume upload)
- Timesheet Management (Employee entry, Admin approval, Reports, CSV/PDF export)
- Multi-tenant architecture with organization-based data isolation
- Subscription billing (mocked Razorpay)

## User Choices
- Tech Stack: React + FastAPI + MongoDB (existing stack)
- Authentication: JWT-based custom auth + Emergent Google OAuth
- Payment: Mocked Razorpay flow
- Storage: Built-in object storage (Emergent)
- PDF: Client-side generation with jsPDF

## Architecture
### Backend (FastAPI + MongoDB)
- `/app/backend/server.py` - Main API with all routes (~1956 lines)
- Collections: users, organizations, employees, attendance, leaves, leave_balances, leave_policies, payroll, jobs, candidates, projects, timesheets, files, subscription_logs, login_attempts
- Multi-tenant: All queries scoped by org_id
- Auth: JWT with httpOnly cookies (secure, samesite=none for cross-origin)

### Frontend (React + Shadcn UI)
- Auth: Login, Register, Onboarding pages
- Dashboard: Admin dashboard with stats, Employee dashboard
- Modules: Employees, Attendance, Leaves, Payroll, Recruitment, Timesheet, Projects, Settings, Subscription
- Components: Reusable Shadcn UI components from /app/frontend/src/components/ui/

## User Personas
1. **Super Admin** - Platform administrator, multi-tenant management
2. **Admin/HR** - Organization administrator, full access to org features
3. **Employee** - Self-service portal (attendance, leaves, timesheets, payslips)

## What's Been Implemented

### Authentication & Authorization (April 2, 2026)
- [x] JWT-based login/register with secure cookies
- [x] Emergent Google OAuth integration
- [x] Role-based access control (super_admin, admin, hr, employee)
- [x] Organization-level user management
- [x] Brute force protection (5 attempts, 15-min lockout)

### Organization Management
- [x] Organization creation with 14-day free trial
- [x] Onboarding flow for new users
- [x] Organization settings (name, domain, industry)

### Employee Management
- [x] CRUD employees with profiles
- [x] Department and designation management
- [x] Salary structure (basic, HRA, allowances)

### Attendance System
- [x] Clock-in / Clock-out functionality
- [x] Attendance calendar view
- [x] Attendance history with filters

### Leave Management (Validated April 2, 2026)
- [x] Leave policies (CL 12, SL 12, PL 15)
- [x] Leave application workflow with balance checking
- [x] Admin approval with balance deduction
- [x] Leave rejection
- [x] Leave balance tracking per year

### Payroll System - India (Validated April 2, 2026)
- [x] Salary structure management (Basic + HRA + Allowances)
- [x] PF calculation (12% of basic, max 15,000 ceiling)
- [x] ESI calculation (0.75% employee, 3.25% employer, if gross <= 21,000)
- [x] Professional Tax (Karnataka rates)
- [x] TDS calculation (new tax regime slabs)
- [x] Client-side PDF payslip generation with jsPDF
- [x] Payroll listing with filters

### Recruitment (ATS) (Validated April 2, 2026)
- [x] Job postings with details (title, dept, location, type)
- [x] Candidate pipeline (Kanban view)
- [x] Stage management (applied -> screening -> interview -> offer -> hired)
- [x] Add/manage candidates per job

### Timesheet Management (Validated April 2, 2026)
- [x] Employee weekly timesheet entry by project
- [x] Week navigation (prev/next/today)
- [x] Add/remove projects from weekly timesheet
- [x] Save, submit, delete entries
- [x] Admin project management (create projects)
- [x] Admin timesheet approval/rejection with feedback
- [x] Admin timesheet history with filters
- [x] Admin reports dashboard (date range, summary cards, project breakdown)
- [x] CSV export (employee & admin)
- [x] PDF export with branded layout (employee & admin)

### SaaS Features
- [x] Multi-tenant architecture (org_id in all collections)
- [x] Subscription plans (Free Trial, Starter, Professional, Enterprise)
- [x] Mocked Razorpay payment flow
- [x] Plan-based pricing display

### UI/UX
- [x] Modern SaaS UI (Shadcn components, Tailwind CSS)
- [x] Sidebar navigation with role-based menu items
- [x] Responsive design
- [x] Toast notifications (Sonner)
- [x] Demo credentials shown on login page

## Prioritized Backlog

### P0 - Critical
- [ ] File uploads for employee documents and resumes (Object storage ready)

### P1 - High Priority
- [ ] Email notifications via Resend (leave approvals, timesheet status)
- [ ] Shift management for attendance
- [ ] Employee org hierarchy view
- [ ] Bulk payroll generation (all employees at once)

### P2 - Medium Priority
- [ ] Audit logs for all actions
- [ ] Background jobs (email, payroll processing)
- [ ] Advanced reporting & analytics dashboard
- [ ] Employee self-service profile updates
- [ ] Rate limiting on APIs

### P3 - Nice to Have
- [ ] Mobile-responsive improvements
- [ ] Dark mode theme
- [ ] Calendar integration
- [ ] Slack/Teams notifications

## Test Credentials
- Super Admin: admin@talentops.com / admin123 (Test Organization)
- HR Admin: hr@acmecorp.com / password123 (Acme Corporation)
- Employee: john.doe@acmecorp.com / employee123 (Acme Corporation)

## API Endpoints
All routes prefixed with `/api/`:
- `/auth/*` - Authentication (login, register, logout, me, refresh, google)
- `/organizations/*` - Organization management
- `/employees/*` - Employee CRUD
- `/attendance/*` - Attendance tracking
- `/leaves/*` - Leave management (apply, approve, reject, balance)
- `/payroll/*` - Payroll processing (generate, list, get)
- `/jobs/*` - Job postings
- `/candidates/*` - Candidate management
- `/projects/*` - Project management
- `/timesheets/*` - Timesheet CRUD, submit, status update
- `/subscription/*` - Subscription billing
- `/upload` - File upload
