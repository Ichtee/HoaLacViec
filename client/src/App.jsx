import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

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
import HomePage from '@/pages/public/HomePage.jsx';
import JobListPage from '@/pages/public/JobListPage.jsx';
import JobDetailPage from '@/pages/public/JobDetailPage.jsx';
import LoginPage from '@/pages/public/LoginPage.jsx';
import RegisterPage from '@/pages/public/RegisterPage.jsx';
import NotFoundPage from '@/pages/public/NotFoundPage.jsx';
import BlogListPage from '@/pages/public/BlogListPage.jsx';
import BlogDetailPage from '@/pages/public/BlogDetailPage.jsx';
import MicroTasksPage from '@/pages/public/MicroTasksPage.jsx';
import VerifyAccountPage from '@/pages/public/VerifyAccountPage.jsx';

// Student Pages
import StudentDashboard from '@/pages/student/DashboardPage.jsx';
import StudentProfilePage from '@/pages/student/ProfilePage.jsx';
import SavedJobsPage from '@/pages/student/SavedJobsPage.jsx';
import ApplicationsPage from '@/pages/student/ApplicationsPage.jsx';
import StudentShiftsPage from '@/pages/student/ShiftsPage.jsx';
import StudentReviewsPage from '@/pages/student/ReviewsPage.jsx';

// Employer Pages
import EmployerDashboardPage from '@/pages/employer/EmployerDashboardPage.jsx';
import StoreProfilePage from '@/pages/employer/StoreProfilePage.jsx';
import EmployerJobsPage from '@/pages/employer/EmployerJobsPage.jsx';
import EmployerApplicationsPage from '@/pages/employer/EmployerApplicationsPage.jsx';
import EmployerShiftsPage from '@/pages/employer/EmployerShiftsPage.jsx';

// Admin Pages
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage.jsx';
import AdminVerificationPage from '@/pages/admin/AdminVerificationPage.jsx';
import AdminJobsPage from '@/pages/admin/AdminJobsPage.jsx';
import AdminReportsPage from '@/pages/admin/AdminReportsPage.jsx';
import AdminUsersPage from '@/pages/admin/AdminUsersPage.jsx';

// Common Account Pages
import AccountInfoPage from '@/pages/common/AccountInfoPage.jsx';
import ChangePasswordPage from '@/pages/common/ChangePasswordPage.jsx';

// Geolocation Bootstrap
import { LocationPermissionBootstrap } from '@/components/LocationPermissionBootstrap.jsx';

export default function App() {
  return (
    <Router>
      <LocationPermissionBootstrap />
      <PendingRouteEnforcer />
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
          <Route path="tasks" element={<MicroTasksPage />} />
          <Route path="saved" element={<SavedJobsPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="shifts" element={<StudentShiftsPage />} />
          <Route path="reviews" element={<StudentReviewsPage />} />
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
          <Route path="applications" element={<EmployerApplicationsPage />} />
          <Route path="shifts" element={<EmployerShiftsPage />} />
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
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
        </Route>

        {/* Fallback 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}
