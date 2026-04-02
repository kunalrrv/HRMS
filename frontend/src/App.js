import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";

// Auth Context
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, PublicRoute } from "./components/ProtectedRoute";

// Layout
import DashboardLayout from "./components/layout/DashboardLayout";

// Auth Pages
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/employees/new" element={<EmployeesPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/leaves" element={<LeavesPage />} />
            <Route path="/payroll" element={<PayrollPage />} />
            <Route path="/recruitment" element={<RecruitmentPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/subscription" element={<SubscriptionPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
