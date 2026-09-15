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
  const { isAuthenticated, role: userRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (userRole !== role) {
    const dashboards = { student: '/student', employer: '/employer', admin: '/admin' };
    return <Navigate to={dashboards[userRole] || '/'} replace />;
  }
  return children;
}

export function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, role } = useAuth();
  if (isAuthenticated) {
    const dashboards = { student: '/student', employer: '/employer', admin: '/admin' };
    return <Navigate to={dashboards[role] || '/'} replace />;
  }
  return children;
}
