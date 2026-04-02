import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";

// Auth Context
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PlanProvider } from "./contexts/PlanContext";
import { ProtectedRoute, PublicRoute } from "./components/ProtectedRoute";

// Layout
import DashboardLayout from "./components/layout/DashboardLayout";

// Auth Pages
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import AuthCallback from "./pages/auth/AuthCallback";
import OnboardingPage from "./pages/OnboardingPage";

// Dashboard Pages
import DashboardPage from "./pages/dashboard/DashboardPage";
import EmployeesPage from "./pages/employees/EmployeesPage";
import EmployeeDetailPage from "./pages/employees/EmployeeDetailPage";
import AttendancePage from "./pages/attendance/AttendancePage";
import LeavesPage from "./pages/leaves/LeavesPage";
import PayrollPage from "./pages/payroll/PayrollPage";
import RecruitmentPage from "./pages/recruitment/RecruitmentPage";
import SettingsPage from "./pages/settings/SettingsPage";
import SubscriptionPage from "./pages/subscription/SubscriptionPage";
import TimesheetPage from "./pages/timesheet/TimesheetPage";
import TimesheetAdminPage from "./pages/timesheet/TimesheetAdminPage";
import ProjectsPage from "./pages/projects/ProjectsPage";
import CalendarPage from "./pages/calendar/CalendarPage";
import ProfilePage from "./pages/profile/ProfilePage";
import AuditLogsPage from "./pages/audit/AuditLogsPage";
import { FeatureGate } from "./components/FeatureGate";

// Router wrapper to handle OAuth callback synchronously
function AppRouter() {
  const location = useLocation();
  
  // Check URL fragment for session_id synchronously during render
  // This prevents race conditions by processing OAuth callback FIRST
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute>
          <RegisterPage />
        </PublicRoute>
      } />
      
      {/* Auth Callback Route */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Onboarding */}
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <OnboardingPage />
        </ProtectedRoute>
      } />

      {/* Protected Dashboard Routes */}
      <Route element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/employees/new" element={<EmployeesPage />} />
        <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/leaves" element={<LeavesPage />} />
        <Route path="/payroll" element={<FeatureGate feature="payroll" fallbackTitle="Payroll"><PayrollPage /></FeatureGate>} />
        <Route path="/recruitment" element={<FeatureGate feature="recruitment" fallbackTitle="Recruitment"><RecruitmentPage /></FeatureGate>} />
        <Route path="/timesheet" element={<FeatureGate feature="timesheets" fallbackTitle="Timesheets"><TimesheetPage /></FeatureGate>} />
        <Route path="/timesheet/admin" element={<FeatureGate feature="timesheets" fallbackTitle="Timesheet Management"><TimesheetAdminPage /></FeatureGate>} />
        <Route path="/projects" element={<FeatureGate feature="projects" fallbackTitle="Projects"><ProjectsPage /></FeatureGate>} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/audit-logs" element={<FeatureGate feature="audit_logs" fallbackTitle="Audit Logs"><AuditLogsPage /></FeatureGate>} />
        <Route path="/subscription" element={<SubscriptionPage />} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PlanProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
          <Toaster position="top-right" />
        </PlanProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
