# TalentOps HRMS SaaS - Product Requirements Document

## Original Problem Statement
Build a production-ready multi-tenant HRMS SaaS application similar to BambooHR with Employee Management, Attendance, Leave Management, US Payroll, Recruitment ATS, Timesheet Management, Dashboard Analytics, Employee Self-Service Portal, Dark Mode, Calendar Integration, Mobile-Responsive Design, Plan-Based Feature Gating, and Audit Logs.

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

### Subscription & Feature Gating (April 2, 2026)
- [x] 4 plan tiers: Free Trial ($0, 5 emp), Starter ($49, 25 emp), Professional ($99, 100 emp), Enterprise ($199, unlimited)
- [x] FeatureGateMiddleware blocks gated routes with 403 PLAN_UPGRADE_REQUIRED
- [x] Employee limit enforcement on employee creation
- [x] Trial expiry checking (14-day free trial)
- [x] Frontend FeatureGate component shows lock screen with upgrade CTA
- [x] Sidebar lock icons on gated features
- [x] PlanContext provides hasFeature() and canAddEmployee() across app
- [x] Mocked Razorpay payment with instant verification
- [x] Plan cards with USD pricing and correct feature lists

### Feature Access by Plan
| Feature | Free Trial | Starter | Professional | Enterprise |
|---------|-----------|---------|-------------|------------|
| Employees | 5 max | 25 max | 100 max | Unlimited |
| Attendance | Yes | Yes | Yes | Yes |
| Leaves | Yes | Yes | Yes | Yes |
| Calendar | Yes | Yes | Yes | Yes |
| Payroll | No | Yes | Yes | Yes |
| Recruitment | No | No | Yes | Yes |
| Timesheets | No | No | Yes | Yes |
| Projects | No | No | Yes | Yes |
| Bulk Payroll | No | No | Yes | Yes |
| Audit Logs | No | No | No | Yes |

### Audit Logs (Enterprise, April 2, 2026)
- [x] Logs all CRUD actions (employee creation, leave approval, payroll generation, subscription upgrades)
- [x] Admin-only /audit-logs page with filter dropdowns (action, resource type)
- [x] Pagination support
- [x] Color-coded action badges (CREATE, APPROVE, REJECT, UPGRADE, etc.)

### Employee Self-Service Portal
- [x] /profile page with 4 tabs (Profile, Attendance, Leaves, Payroll)
- [x] Editable: phone, address, emergency contact, US state for tax
- [x] Combined history view with pay stub PDF downloads

### US Payroll System
- [x] Federal Tax, Social Security, Medicare, configurable State Tax
- [x] Bulk payroll generation, PDF pay stubs

### Dashboard Analytics
- [x] 4 Recharts charts (attendance, leave, payroll, recruitment)

### Dark Mode & Calendar
- [x] Theme toggle, localStorage persistence
- [x] Calendar month view with attendance/leave overlay

### Mobile-Responsive
- [x] Hamburger sidebar, stacking cards, touch-friendly buttons, responsive tables

## Prioritized Backlog

### P1 - High Priority
- [ ] File uploads for employee documents and resumes
- [ ] Email notifications (Resend integration)
- [ ] Employee org hierarchy view

### P2 - Medium Priority
- [ ] Slack/Teams webhook notifications
- [ ] Background jobs for payroll processing
- [ ] Advanced reporting & analytics

## Test Credentials
- Super Admin: admin@talentops.com / admin123
- HR Admin: hr@acmecorp.com / password123
- Employee: john.doe@acmecorp.com / employee123

## API Endpoints
All prefixed with `/api/`:
- `/auth/*` - Authentication
- `/profile`, `/profile/history` - Employee self-service
- `/employees/*` - Employee CRUD (with limit enforcement)
- `/attendance/*` - Attendance tracking
- `/leaves/*` - Leave management
- `/payroll/*` - US Payroll (gated: Starter+)
- `/jobs/*`, `/candidates/*` - Recruitment (gated: Professional+)
- `/timesheets/*`, `/projects/*` - Timesheet management (gated: Professional+)
- `/audit-logs` - Audit logs (gated: Enterprise)
- `/subscription/*` - Plans, checkout, verify, current
- `/dashboard/*` - Stats, analytics
