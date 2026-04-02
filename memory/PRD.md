# TalentOps HRMS SaaS - Product Requirements Document

## Original Problem Statement
Build a production-ready multi-tenant HRMS SaaS application similar to BambooHR with:
- Employee Management, Attendance, Leave Management, Payroll (US), Recruitment ATS
- Timesheet Management with Admin approval, Reports, CSV/PDF export
- Multi-tenant architecture, Role-based access, Dark mode, Calendar integration
- Dashboard analytics with charts (attendance, leave, payroll, recruitment)

## Architecture
- **Frontend**: React + Shadcn UI + Tailwind CSS + Recharts
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT with httpOnly cookies (Google OAuth removed per user request)

## What's Been Implemented

### Core Infrastructure
- [x] Multi-tenant architecture (org_id scoping)
- [x] JWT auth with secure cookies
- [x] Role-based access (super_admin, admin, hr, employee)
- [x] Organization onboarding flow
- [x] Demo accounts on login page

### Employee Management
- [x] CRUD employees with profiles, state_code field

### Attendance & Calendar
- [x] Clock-in/out with attendance history
- [x] Calendar page: month view with attendance + leave overlay
- [x] Summary stats (present, absent, on leave, pending)

### Leave Management
- [x] Leave policies (CL 12, SL 12, PL 15), approval workflow, balance deduction

### US Payroll System (April 2, 2026)
- [x] Federal Income Tax (progressive brackets 10%-37%)
- [x] Social Security (6.2% employee + 6.2% employer, $168,600 wage base)
- [x] Medicare (1.45% + 0.9% additional over $200k)
- [x] State Tax (configurable per employee, 51 states with rates)
- [x] Bulk payroll generation (all employees at once)
- [x] Individual payroll generation
- [x] PDF pay stub download (jsPDF)
- [x] GET /api/payroll/states endpoint for state list

### Recruitment ATS
- [x] Job postings, candidate pipeline (Kanban view)

### Timesheet Management
- [x] Employee weekly entry, Admin approval/rejection, Reports, CSV/PDF export

### Dashboard Analytics (April 2, 2026)
- [x] 4 stat cards (employees, attendance, leaves, positions)
- [x] Attendance trend (bar chart, last 7 days)
- [x] Leave distribution (donut chart)
- [x] Payroll cost trend (line chart, last 6 months)
- [x] Recruitment pipeline (horizontal bar chart)
- [x] Quick action cards

### Dark Mode (April 2, 2026)
- [x] ThemeContext with localStorage persistence
- [x] CSS variables for light/dark themes
- [x] Theme toggle button in sidebar
- [x] All pages support dark mode

### Calendar Integration (April 2, 2026)
- [x] Full month calendar view
- [x] Attendance badges (P=Present, A=Absent)
- [x] Leave badges (CL, SL, PL, pending)
- [x] Today highlight, month navigation
- [x] Summary stat cards

### UI Changes (April 2, 2026)
- [x] Google sign-in button removed from login page

## Prioritized Backlog

### P1 - High Priority
- [ ] File uploads for employee documents and resumes
- [ ] Email notifications (Resend integration)
- [ ] Employee state_code editing in employee detail page
- [ ] Employee org hierarchy view

### P2 - Medium Priority
- [ ] Mocked Razorpay subscription billing
- [ ] Audit logs for all actions
- [ ] Advanced reporting & analytics
- [ ] Employee self-service profile updates

### P3 - Nice to Have
- [ ] Mobile-responsive improvements
- [ ] Slack/Teams notifications
- [ ] Background jobs for payroll processing

## Test Credentials
- Super Admin: admin@talentops.com / admin123
- HR Admin: hr@acmecorp.com / password123
- Employee: john.doe@acmecorp.com / employee123

## API Endpoints
All prefixed with `/api/`:
- `/auth/*` - Authentication
- `/employees/*` - Employee CRUD
- `/attendance/*` - Attendance tracking
- `/leaves/*` - Leave management
- `/payroll/*` - US Payroll (generate, generate-bulk, states, list)
- `/jobs/*` - Job postings
- `/candidates/*` - Candidate management
- `/projects/*` - Project management
- `/timesheets/*` - Timesheet CRUD
- `/dashboard/*` - Stats, employee-stats, analytics
- `/subscription/*` - Subscription billing
