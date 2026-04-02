# TalentOps HRMS SaaS - Product Requirements Document

## Original Problem Statement
Build a production-ready multi-tenant HRMS SaaS application similar to BambooHR with Employee Management, Attendance, Leave Management, US Payroll, Recruitment ATS, Timesheet Management, Dashboard Analytics, Employee Self-Service Portal, Dark Mode, Calendar Integration, and Mobile-Responsive Design.

## Architecture
- **Frontend**: React + Shadcn UI + Tailwind CSS + Recharts
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT with httpOnly cookies (secure, samesite=none)

## What's Been Implemented

### Core Infrastructure
- [x] Multi-tenant architecture (org_id scoping)
- [x] JWT auth with secure cookies
- [x] Role-based access (super_admin, admin, hr, employee)
- [x] Organization onboarding flow
- [x] Demo accounts on login page

### Employee Management
- [x] CRUD employees with profiles, state_code field for US tax

### Employee Self-Service Portal (April 2, 2026)
- [x] /profile page with header card (name, designation, department, employee code, state badge)
- [x] Profile tab: Edit phone, address, emergency contact, state (dropdown with all 51 US states)
- [x] Attendance tab: Attendance history table (date, clock in/out, hours)
- [x] Leaves tab: Leave balance cards + leave history table
- [x] Payroll tab: Pay stubs table with PDF download
- [x] "My Profile" sidebar nav for employees
- [x] Backend: GET /api/profile, PUT /api/profile, GET /api/profile/history

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
- [x] PDF pay stub download (jsPDF)

### Recruitment ATS
- [x] Job postings, candidate pipeline (Kanban view)

### Timesheet Management
- [x] Employee weekly entry, Admin approval/rejection, Reports, CSV/PDF export

### Dashboard Analytics (April 2, 2026)
- [x] 4 stat cards + 4 Recharts charts (attendance, leave, payroll, recruitment)
- [x] Quick action cards

### Dark Mode (April 2, 2026)
- [x] ThemeContext with localStorage persistence
- [x] CSS variables for light/dark themes across all pages

### Mobile-Responsive (April 2, 2026)
- [x] Hamburger menu sidebar with overlay
- [x] Cards stack vertically on mobile
- [x] Touch-friendly button sizing (min-height: 40px)
- [x] Responsive tables with horizontal scroll
- [x] Calendar grid adapts to mobile viewports

### UI Changes
- [x] Google sign-in button removed from login page
- [x] Currency changed from ₹ (INR) to $ (USD) across all pages

## Prioritized Backlog

### P1 - High Priority
- [ ] File uploads for employee documents and resumes
- [ ] Email notifications (Resend integration)
- [ ] Employee org hierarchy view

### P2 - Medium Priority
- [ ] Mocked Razorpay subscription billing
- [ ] Audit logs for all actions
- [ ] Advanced reporting & analytics
- [ ] Slack/Teams webhook notifications
- [ ] Background jobs for payroll processing

## Test Credentials
- Super Admin: admin@talentops.com / admin123
- HR Admin: hr@acmecorp.com / password123
- Employee: john.doe@acmecorp.com / employee123

## API Endpoints
All prefixed with `/api/`:
- `/auth/*` - Authentication
- `/profile`, `/profile/history` - Employee self-service
- `/employees/*` - Employee CRUD
- `/attendance/*` - Attendance tracking
- `/leaves/*` - Leave management
- `/payroll/*` - US Payroll (generate, generate-bulk, states, list)
- `/jobs/*`, `/candidates/*` - Recruitment
- `/projects/*`, `/timesheets/*` - Timesheet management
- `/dashboard/*` - Stats, analytics
- `/subscription/*` - Subscription billing
