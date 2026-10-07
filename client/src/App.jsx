import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Layouts
import PublicLayout from '@/layouts/PublicLayout.jsx';
import StudentLayout from '@/layouts/StudentLayout.jsx';
import EmployerLayout from '@/layouts/EmployerLayout.jsx';
import AdminLayout from '@/layouts/AdminLayout.jsx';

// Route Guards
import {
  RequireAuth,
  RequireRole,
  RedirectIfAuthenticated,
  PendingRouteEnforcer,
  RequirePending,
} from '@/components/RouteGuard.jsx';

// Public Pages
const HomePage = lazy(() => import('@/pages/public/HomePage.jsx'));
const JobListPage = lazy(() => import('@/pages/public/JobListPage.jsx'));
const JobDetailPage = lazy(() => import('@/pages/public/JobDetailPage.jsx'));
const LoginPage = lazy(() => import('@/pages/public/LoginPage.jsx'));
const ResetPasswordPage = lazy(() => import('@/pages/public/ResetPasswordPage.jsx'));
const RegisterPage = lazy(() => import('@/pages/public/RegisterPage.jsx'));
import NotFoundPage from '@/pages/public/NotFoundPage.jsx';
const BlogListPage = lazy(() => import('@/pages/public/BlogListPage.jsx'));
const BlogDetailPage = lazy(() => import('@/pages/public/BlogDetailPage.jsx'));
const MicroTasksPage = lazy(() => import('@/pages/public/MicroTasksPage.jsx'));
const CreateMicroTaskPage = lazy(() => import('@/pages/public/CreateMicroTaskPage.jsx'));
const VerifyAccountPage = lazy(() => import('@/pages/public/VerifyAccountPage.jsx'));

// Student Pages
const StudentDashboard = lazy(() => import('@/pages/student/DashboardPage.jsx'));
const StudentProfilePage = lazy(() => import('@/pages/student/ProfilePage.jsx'));
const SavedJobsPage = lazy(() => import('@/pages/student/SavedJobsPage.jsx'));
const ApplicationsPage = lazy(() => import('@/pages/student/ApplicationsPage.jsx'));
const StudentShiftsPage = lazy(() => import('@/pages/student/ShiftsPage.jsx'));
const StudentReviewsPage = lazy(() => import('@/pages/student/ReviewsPage.jsx'));
const StudentQuickShiftsPage = lazy(() => import('@/pages/student/QuickShiftsPage.jsx'));
const JobAlertsPage = lazy(() => import('@/pages/student/JobAlertsPage.jsx'));

// Employer Pages
const EmployerDashboardPage = lazy(() => import('@/pages/employer/EmployerDashboardPage.jsx'));
const StoreProfilePage = lazy(() => import('@/pages/employer/StoreProfilePage.jsx'));
const EmployerJobsPage = lazy(() => import('@/pages/employer/EmployerJobsPage.jsx'));
const EmployerJobFormPage = lazy(() => import('@/pages/employer/EmployerJobFormPage.jsx'));
const EmployerApplicationsPage = lazy(() => import('@/pages/employer/EmployerApplicationsPage.jsx'));
const EmployerEmployeesPage = lazy(() => import('@/pages/employer/EmployerEmployeesPage.jsx'));
const EmployerShiftsPage = lazy(() => import('@/pages/employer/EmployerShiftsPage.jsx'));
const EmployerQuickShiftsPage = lazy(() => import('@/pages/employer/EmployerQuickShiftsPage.jsx'));

// Admin Pages
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage.jsx'));
const AdminVerificationPage = lazy(() => import('@/pages/admin/AdminVerificationPage.jsx'));
const AdminJobsPage = lazy(() => import('@/pages/admin/AdminJobsPage.jsx'));
const AdminBlogsPage = lazy(() => import('@/pages/admin/AdminBlogsPage.jsx'));
const AdminReportsPage = lazy(() => import('@/pages/admin/AdminReportsPage.jsx'));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage.jsx'));

// Common Account Pages
const AccountInfoPage = lazy(() => import('@/pages/common/AccountInfoPage.jsx'));
const MessagesPage = lazy(() => import('@/pages/common/MessagesPage.jsx'));
const ShiftSwapsPage = lazy(() => import('@/pages/common/ShiftSwapsPage.jsx'));
const ChangePasswordPage = lazy(() => import('@/pages/common/ChangePasswordPage.jsx'));

// Geolocation Bootstrap
import { LocationPermissionBootstrap } from '@/components/LocationPermissionBootstrap.jsx';
import { ErrorBoundary } from '@/components/ErrorBoundary.jsx';

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-text-muted" role="status">
      Đang tải...
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <LocationPermissionBootstrap />
      <PendingRouteEnforcer />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route
              path="/"
              element={
                <RedirectIfAuthenticated>
                  <HomePage />
                </RedirectIfAuthenticated>
              }
            />
            <Route path="/jobs" element={<JobListPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/tasks" element={<MicroTasksPage />} />
            <Route
              path="/tasks/create"
              element={
                <RequireAuth>
                  <CreateMicroTaskPage />
                </RequireAuth>
              }
            />
            <Route path="/blogs" element={<BlogListPage />} />
            <Route path="/blogs/:id" element={<BlogDetailPage />} />
            <Route
              path="/login"
              element={
                <RedirectIfAuthenticated>
                  <LoginPage />
                </RedirectIfAuthenticated>
              }
            />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/register"
              element={
                <RedirectIfAuthenticated>
                  <RegisterPage />
                </RedirectIfAuthenticated>
              }
            />
            <Route
              path="/verify-account"
              element={
                <RequirePending>
                  <VerifyAccountPage />
                </RequirePending>
              }
            />
          </Route>

          {/* Student Portal */}
          <Route
            path="/student"
            element={
              <RequireRole role="student">
                <StudentLayout />
              </RequireRole>
            }
          >
            <Route index element={<StudentDashboard />} />
            <Route path="profile" element={<StudentProfilePage />} />
            <Route path="account" element={<AccountInfoPage />} />
            <Route path="change-password" element={<ChangePasswordPage />} />
            <Route path="jobs" element={<JobListPage />} />
            <Route path="jobs/:id" element={<JobDetailPage />} />
            <Route path="tasks" element={<MicroTasksPage />} />
            <Route path="tasks/create" element={<CreateMicroTaskPage />} />
            <Route path="saved" element={<SavedJobsPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="shifts" element={<StudentShiftsPage />} />
            <Route path="reviews" element={<StudentReviewsPage />} />
            <Route path="quick-shifts" element={<StudentQuickShiftsPage />} />
            <Route path="messages" element={<MessagesPage />} />
          <Route path="swaps" element={<ShiftSwapsPage />} />
            <Route path="alerts" element={<JobAlertsPage />} />
            <Route path="swaps" element={<ShiftSwapsPage />} />
          </Route>

        {/* Employer Portal */}
        <Route
          path="/employer"
          element={
            <RequireRole role="employer">
              <EmployerLayout />
            </RequireRole>
          }
        >
          <Route index element={<EmployerDashboardPage />} />
          <Route path="profile" element={<StoreProfilePage />} />
          <Route path="account" element={<AccountInfoPage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="jobs" element={<EmployerJobsPage />} />
          <Route path="jobs/create" element={<EmployerJobFormPage />} />
          <Route path="jobs/:id/edit" element={<EmployerJobFormPage />} />
          <Route path="applications" element={<EmployerApplicationsPage />} />
          <Route path="employees" element={<EmployerEmployeesPage />} />
          <Route path="shifts" element={<EmployerShiftsPage />} />
          <Route path="quick-shifts" element={<EmployerQuickShiftsPage />} />
          <Route path="messages" element={<MessagesPage />} />
        </Route>

        {/* Admin Portal */}
        <Route
          path="/admin"
          element={
            <RequireRole role="admin">
              <AdminLayout />
            </RequireRole>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="account" element={<AccountInfoPage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="verification" element={<AdminVerificationPage />} />
          <Route path="jobs" element={<AdminJobsPage />} />
          <Route path="blogs" element={<AdminBlogsPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
        </Route>

        {/* Fallback 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
        </Suspense>
      </ErrorBoundary>
    </Router>
  );
}
