import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { FlowMathRoute } from "@/components/auth/FlowMathRoute";
import { FlowPayRoute } from "@/components/auth/FlowPayRoute";
import { PWAInstallPrompt } from "@/components/ui/pwa-install-prompt";
import { AppShell } from "@/components/shell/AppShell";
import { PageSkeleton } from "@/components/shell/PageSkeleton";

// Route-level code splitting: each page loads only when visited.
const page = <T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(async () => ({ default: (await loader())[name] as ComponentType }));

// Public
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicInvoicePay = lazy(() => import("./pages/flowpay/PublicInvoicePay"));

// Workspace (new modules)
const ChatPage = lazy(() => import("./features/chat/ChatPage"));
const ProjectsHome = lazy(() => import("./features/projects/ProjectsHome"));
const MyTasksPage = lazy(() => import("./features/projects/MyTasksPage"));
const ProjectPage = lazy(() => import("./features/projects/ProjectPage"));

// Admin / manager
const HomePage = lazy(() => import("./features/home/HomePage"));
const EditEmployee = lazy(() => import("./pages/admin/EditEmployee"));
const NewEmployee = lazy(() => import("./pages/admin/NewEmployee"));
const Departments = lazy(() => import("./pages/admin/Departments"));
const Attendance = lazy(() => import("./pages/admin/Attendance"));
const Salaries = lazy(() => import("./pages/admin/Salaries"));
const Leave = lazy(() => import("./pages/admin/Leave"));
const Permissions = lazy(() => import("./pages/admin/Permissions"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const Recruitment = lazy(() => import("./pages/admin/Recruitment"));
const WorkManagement = lazy(() => import("./pages/admin/WorkManagement"));
const Logs = lazy(() => import("./pages/admin/Logs"));
const AdminNotificationsPage = lazy(() => import("./pages/admin/Notifications"));

// Everyone

const AttendanceSystem = lazy(() => import("./pages/employee/Attendance"));
const TasksPage = lazy(() => import("./pages/employee/Tasks"));
const TeamPage = lazy(() => import("./pages/employee/Team"));
const SalaryPage = lazy(() => import("./pages/employee/Salary"));
const NotificationsPage = lazy(() => import("./pages/employee/Notifications"));
const EmployeeSettings = lazy(() => import("./pages/employee/Settings"));

// FlowMath / FlowPay keep their own layouts for now
const FlowMathLayout = page(() => import("./components/layout/FlowMathLayout"), "FlowMathLayout");
const FlowPayLayout = page(() => import("./components/layout/FlowPayLayout"), "FlowPayLayout");
const flowMath = () => import("./pages/flowmath/FlowMathPages");
const FlowMathAccountsPage = page(flowMath, "FlowMathAccountsPage");
const FlowMathBillsPage = page(flowMath, "FlowMathBillsPage");
const FlowMathCustomersPage = page(flowMath, "FlowMathCustomersPage");
const FlowMathDashboardPage = page(flowMath, "FlowMathDashboardPage");
const FlowMathExpensesPage = page(flowMath, "FlowMathExpensesPage");
const FlowMathInvoicesPage = page(flowMath, "FlowMathInvoicesPage");
const FlowMathJournalPage = page(flowMath, "FlowMathJournalPage");
const FlowMathLedgerPage = page(flowMath, "FlowMathLedgerPage");
const FlowMathPayrollPage = page(flowMath, "FlowMathPayrollPage");
const FlowMathReportsPage = page(flowMath, "FlowMathReportsPage");
const FlowMathSettingsPage = page(flowMath, "FlowMathSettingsPage");
const FlowMathVendorsPage = page(flowMath, "FlowMathVendorsPage");
const flowPay = () => import("./pages/flowpay/FlowPayPages");
const FlowPayClientsPage = page(flowPay, "FlowPayClientsPage");
const FlowPayCompaniesPage = page(flowPay, "FlowPayCompaniesPage");
const FlowPayClientPreviewPage = page(flowPay, "FlowPayClientPreviewPage");
const FlowPayDashboardPage = page(flowPay, "FlowPayDashboardPage");
const FlowPayInvoicesPage = page(flowPay, "FlowPayInvoicesPage");
const FlowPaySettingsPage = page(flowPay, "FlowPaySettingsPage");
const FlowPayTerminalPage = page(flowPay, "FlowPayTerminalPage");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);
  return null;
}

/** Gives pages written for the old layouts the same padding they had before. */
function LegacyPageFrame() {
  return (
    <div className="page">
      <Outlet />
    </div>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PWAInstallPrompt />
        <ServiceWorkerRegistration />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                {/* Public */}
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/pay/:invoiceId" element={<PublicInvoicePay />} />

                {/* Signed-in workspace: one shell for every role */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/chat/:channelId?" element={<ProtectedRoute require="chat.use"><ChatPage /></ProtectedRoute>} />
                  <Route path="/projects" element={<ProtectedRoute require="projects.use"><ProjectsHome /></ProtectedRoute>} />
                  <Route path="/projects/my-tasks" element={<ProtectedRoute require="projects.use"><MyTasksPage /></ProtectedRoute>} />
                  <Route path="/projects/:projectId" element={<ProtectedRoute require="projects.use"><ProjectPage /></ProtectedRoute>} />

                  <Route element={<LegacyPageFrame />}>
                    {/* Admins and managers */}
                    <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><Outlet /></ProtectedRoute>}>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<HomePage />} />
                      <Route path="employees" element={<Navigate to="/admin/recruitment?tab=employees" replace />} />
                      <Route path="employees/new" element={<ProtectedRoute require="people.manage"><NewEmployee /></ProtectedRoute>} />
                      <Route path="employees/:id/edit" element={<EditEmployee />} />
                      <Route path="departments" element={<ProtectedRoute require="departments.manage"><Departments /></ProtectedRoute>} />
                      <Route path="attendance" element={<ProtectedRoute require="attendance.team"><Attendance /></ProtectedRoute>} />
                      <Route path="salaries" element={<ProtectedRoute require="salaries.view"><Salaries /></ProtectedRoute>} />
                      <Route path="leave" element={<Leave />} />
                      <Route path="permissions" element={<ProtectedRoute require="permissions.manage"><Permissions /></ProtectedRoute>} />
                      <Route path="settings" element={<ProtectedRoute require="settings.manage"><Settings /></ProtectedRoute>} />
                      <Route path="recruitment" element={<ProtectedRoute require="people.view"><Recruitment /></ProtectedRoute>} />
                      <Route path="work" element={<WorkManagement />} />
                      <Route path="logs" element={<ProtectedRoute require="logs.view"><Logs /></ProtectedRoute>} />
                      <Route path="notifications" element={<AdminNotificationsPage />} />
                    </Route>

                    {/* Everyone signed in */}
                    <Route path="/employee">
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<HomePage />} />
                      <Route path="attendance" element={<AttendanceSystem />} />
                      <Route path="tasks" element={<TasksPage />} />
                      <Route path="team" element={<TeamPage />} />
                      <Route path="work" element={<TasksPage />} />
                      <Route path="salary" element={<SalaryPage />} />
                      <Route path="notifications" element={<NotificationsPage />} />
                      <Route path="settings" element={<EmployeeSettings />} />
                    </Route>
                  </Route>
                </Route>

                {/* FlowMath accounts */}
                <Route path="/flowmath" element={<FlowMathRoute><FlowMathLayout /></FlowMathRoute>}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<FlowMathDashboardPage />} />
                  <Route path="accounts" element={<FlowMathAccountsPage />} />
                  <Route path="journal" element={<FlowMathJournalPage />} />
                  <Route path="ledger" element={<FlowMathLedgerPage />} />
                  <Route path="payroll" element={<FlowMathPayrollPage />} />
                  <Route path="vendors" element={<FlowMathVendorsPage />} />
                  <Route path="customers" element={<FlowMathCustomersPage />} />
                  <Route path="expenses" element={<FlowMathExpensesPage />} />
                  <Route path="invoices" element={<FlowMathInvoicesPage />} />
                  <Route path="bills" element={<FlowMathBillsPage />} />
                  <Route path="reports" element={<FlowMathReportsPage />} />
                  <Route path="settings" element={<FlowMathSettingsPage />} />
                </Route>

                {/* FlowPay payments and invoices */}
                <Route path="/flowpay" element={<FlowPayRoute><FlowPayLayout /></FlowPayRoute>}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<FlowPayDashboardPage />} />
                  <Route path="invoices" element={<FlowPayInvoicesPage />} />
                  <Route path="clients" element={<FlowPayClientsPage />} />
                  <Route path="companies" element={<FlowPayCompaniesPage />} />
                  <Route path="terminal" element={<FlowPayTerminalPage />} />
                  <Route path="settings" element={<FlowPaySettingsPage />} />
                  <Route path="client-preview/:invoiceId" element={<FlowPayClientPreviewPage />} />
                </Route>

                <Route path="/teams/*" element={<Navigate to="/projects" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
