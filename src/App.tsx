import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PWAInstallPrompt } from "@/components/ui/pwa-install-prompt";

// Pages
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Admin Pages
import { FlowHRLayout } from "./components/layout/FlowHRLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import EditEmployee from "./pages/admin/EditEmployee";
import NewEmployee from "./pages/admin/NewEmployee";
import Departments from "./pages/admin/Departments";
import Attendance from "./pages/admin/Attendance";
import Salaries from "./pages/admin/Salaries";
import Leave from "./pages/admin/Leave";
import Permissions from "./pages/admin/Permissions";
import Settings from "./pages/admin/Settings";
import Recruitment from "./pages/admin/Recruitment";
import WorkManagement from "./pages/admin/WorkManagement";
import Logs from "./pages/admin/Logs";
import AdminNotificationsPage from "./pages/admin/Notifications";

// Employee Pages
import { EmployeeLayoutNew } from "./components/layout/EmployeeLayoutNew";
import EmployeeDashboard from "./pages/employee/DashboardFinal";
import AttendanceSystem from "./pages/employee/Attendance";
import TasksPage from "./pages/employee/Tasks";
import TeamPage from "./pages/employee/Team";
import SalaryPage from "./pages/employee/Salary";
import NotificationsPage from "./pages/employee/Notifications";
import EmployeeSettings from "./pages/employee/Settings";
import ChatPage from "./pages/employee/Chat";

const queryClient = new QueryClient();

function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  return null;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PWAInstallPrompt />
        <ServiceWorkerRegistration />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <FlowHRLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="employees" element={<Navigate to="/admin/recruitment?tab=employees" replace />} />
              <Route path="employees/new" element={<NewEmployee />} />
              <Route path="employees/:id/edit" element={<EditEmployee />} />
              <Route path="departments" element={<Departments />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="salaries" element={<Salaries />} />
              <Route path="leave" element={<Leave />} />
              <Route path="permissions" element={<Permissions />} />
              <Route path="settings" element={<Settings />} />
              <Route path="recruitment" element={<Recruitment />} />
              <Route path="work" element={<WorkManagement />} />
              <Route path="logs" element={<Logs />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
            </Route>

            {/* Employee routes */}
            <Route
              path="/employee"
              element={
                <ProtectedRoute allowedRoles={['employee']}>
                  <EmployeeLayoutNew />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<EmployeeDashboard />} />
              <Route path="attendance" element={<AttendanceSystem />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="work" element={<TasksPage />} />
              <Route path="salary" element={<SalaryPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="settings" element={<EmployeeSettings />} />
            </Route>

            <Route path="/teams" element={<Navigate to="/employee/work" replace />} />
            <Route path="/teams/*" element={<Navigate to="/employee/work" replace />} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
