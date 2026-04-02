# TalentOps HRMS SaaS - Product Requirements Document

## Original Problem Statement
Build a production-ready multi-tenant HRMS SaaS application similar to BambooHR with:
- Employee Management (CRUD, profiles, org hierarchy)
- Attendance System (Clock-in/out, shift management, logs)
- Leave Management (Policies CL/SL/PL, approval workflow, balance tracking)
- Payroll System (India-specific: PF, ESI, TDS, payslip PDF)
- Recruitment ATS (Job postings, candidate pipeline, resume upload)
- Multi-tenant architecture with organization-based data isolation
- Subscription billing (mocked Razorpay)

## User Choices
- Tech Stack: React + FastAPI + MongoDB (existing stack)
- Authentication: JWT-based custom auth with role-based access control
- Payment: Mocked Razorpay flow
- Storage: Built-in object storage (Emergent)
- PDF: Client-side generation with jsPDF

## Architecture
### Backend (FastAPI + MongoDB)
- `/app/backend/server.py` - Main API with all routes
- Collections: users, organizations, employees, attendance, leaves, leave_balances, leave_policies, payroll, jobs, candidates, files, subscription_logs, login_attempts
- Multi-tenant: All queries scoped by org_id
- Auth: JWT with httpOnly cookies (secure, samesite=none for cross-origin)

### Frontend (React + Shadcn UI)
- Auth: Login, Register, Onboarding pages
- Dashboard: Admin dashboard with stats, Employee dashboard
- Modules: Employees, Attendance, Leaves, Payroll, Recruitment, Settings, Subscription
- Components: Reusable Shadcn UI components from /app/frontend/src/components/ui/

## User Personas
1. **Super Admin** - Platform administrator, multi-tenant management
2. **Admin** - Organization administrator, full access to org features
3. **HR** - HR operations, manage employees, payroll, recruitment
4. **Employee** - Self-service portal (attendance, leaves, payslips)

## What's Been Implemented (April 2, 2026)
### Authentication & Authorization
- [x] JWT-based login/register with secure cookies
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

### Leave Management
- [x] Leave policies (CL 12, SL 12, PL 15)
- [x] Leave application workflow
- [x] Multi-level approval (admin/HR)
- [x] Leave balance tracking

### Payroll System (India)
- [x] Salary structure management
- [x] PF calculation (12% of basic, max ₹15,000 ceiling)
- [x] ESI calculation (0.75% employee, 3.25% employer, if gross ≤ ₹21,000)
- [x] Professional Tax (Karnataka rates)
- [x] TDS calculation (new tax regime)
- [x] Client-side PDF payslip generation with jsPDF

### Recruitment (ATS)
- [x] Job postings with details
- [x] Candidate pipeline (Kanban view)
- [x] Stage management (applied → screening → interview → offer → hired)

### SaaS Features
- [x] Multi-tenant architecture (orgId in all collections)
- [x] Subscription plans (Free Trial, Starter, Professional, Enterprise)
- [x] Mocked Razorpay payment flow
- [x] Plan-based pricing display

### UI/UX
- [x] Modern SaaS UI (Shadcn components)
- [x] Sidebar navigation
- [x] Responsive design
- [x] Toast notifications (Sonner)

## Prioritized Backlog

### P0 - Critical (Not Started)
- [ ] File uploads for employee documents and resumes (Object storage ready)
- [ ] Email notifications (Resend integration ready)

### P1 - High Priority
- [ ] Shift management for attendance
- [ ] Employee org hierarchy view
- [ ] Bulk payroll generation
- [ ] Audit logs for all actions

### P2 - Medium Priority
- [ ] Background jobs (email, payroll processing)
- [ ] Advanced reporting & analytics
- [ ] Employee self-service profile updates
- [ ] Rate limiting on APIs

### P3 - Nice to Have
- [ ] Mobile-responsive improvements
- [ ] Dark mode theme
- [ ] Calendar integration
- [ ] Slack/Teams notifications

## Test Credentials
- Super Admin: admin@talentops.com / admin123
- HR Admin: hr@acmecorp.com / password123 (Acme Corporation)

## API Endpoints
See `/app/backend/server.py` for full API documentation.
All routes prefixed with `/api/`:
- `/auth/*` - Authentication
- `/organizations/*` - Organization management
- `/employees/*` - Employee CRUD
- `/attendance/*` - Attendance tracking
- `/leaves/*` - Leave management
- `/payroll/*` - Payroll processing
- `/jobs/*` - Job postings
- `/candidates/*` - Candidate management
- `/subscription/*` - Subscription billing

## Next Tasks
1. Implement file uploads for documents/resumes
2. Set up email notifications for leave approvals
3. Add employee org hierarchy visualization
4. Implement bulk payroll generation
5. Add audit logging
