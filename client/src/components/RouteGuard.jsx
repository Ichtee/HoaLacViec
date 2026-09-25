import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.jsx';

/**
 * Route guards for role-based access control
 * NOTE: These are frontend-only guards for UX purposes.
 * Real authorization enforcement MUST happen on the backend.
 */

export function RequireAuth({ children, redirectTo = '/login' }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }
  return children;
}

export function RequireRole({ role, children }) {
  const { isAuthenticated, user, role: userRole, logout } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Nếu tài khoản đang ở trạng thái pending, chuyển hướng đến trang xác minh
  if (user?.status === 'pending' || userRole === 'pending') {
    return <Navigate to="/verify-account" replace />;
  }

  if (userRole !== role) {
    if (role === 'admin') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-cream to-green-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-8 rounded-3xl border border-purple-100 shadow-modal text-center space-y-4 animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto text-3xl shadow-sm">
              🛡️
            </div>
            <h2 className="text-xl font-bold text-gray-900">Bảng Điều Khiển Quản Trị (Admin)</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              Bạn hiện đang đăng nhập với vai trò <strong className="text-green-dark">{userRole === 'student' ? 'Sinh viên' : 'Nhà tuyển dụng'}</strong>. Khu vực <code className="px-1.5 py-0.5 bg-gray-100 rounded text-purple-700 font-semibold">/admin</code> yêu cầu quyền Quản trị viên hệ thống.
            </p>
            <div className="pt-3 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  const dashboards = { student: '/student', employer: '/employer' };
                  window.location.href = dashboards[userRole] || '/';
                }}
                className="w-full py-2.5 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs shadow-sm transition-all"
              >
                Quay lại trang của tôi
              </button>
              <button
                onClick={() => {
                  logout();
                  window.location.href = '/login';
                }}
                className="w-full py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold text-xs transition-colors"
              >
                Đăng xuất để đăng nhập tài khoản khác
              </button>
            </div>
          </div>
        </div>
      );
    }
    const dashboards = { student: '/student', employer: '/employer', admin: '/admin' };
    return <Navigate to={dashboards[userRole] || '/'} replace />;
  }
  return children;
}

export function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, user, role } = useAuth();
  if (isAuthenticated) {
    if (user?.status === 'pending' || role === 'pending') {
      return <Navigate to="/verify-account" replace />;
    }
    const dashboards = { student: '/student', employer: '/employer', admin: '/admin' };
    const target = dashboards[role] || (user?.role && dashboards[user.role]) || '/student';
    return <Navigate to={target} replace />;
  }
  return children;
}

/**
 * Global enforcer:
 * 1. If a logged-in user is in pending state, they are ONLY allowed to access /verify-account.
 * 2. If an authenticated user attempts to access '/', redirect them to their portal (/student, /employer, /admin).
 */
export function PendingRouteEnforcer() {
  const { isAuthenticated, user, role } = useAuth();
  const location = useLocation();

  const isPending = isAuthenticated && (user?.status === 'pending' || role === 'pending');

  if (isPending && location.pathname !== '/verify-account') {
    return <Navigate to="/verify-account" replace />;
  }

  if (isAuthenticated && !isPending && location.pathname === '/') {
    const dashboards = { student: '/student', employer: '/employer', admin: '/admin' };
    const target = dashboards[role] || (user?.role && dashboards[user.role]) || '/student';
    return <Navigate to={target} replace />;
  }

  return null;
}

/**
 * Route guard for /verify-account page:
 * - Requires authentication
 * - If user is already active (not pending), redirects to their role dashboard
 */
export function RequirePending({ children }) {
  const { isAuthenticated, user, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isPending = user?.status === 'pending' || role === 'pending';
  if (!isPending) {
    const dashboards = { student: '/student', employer: '/employer', admin: '/admin' };
    return <Navigate to={dashboards[role] || '/'} replace />;
  }

  return children;
}
