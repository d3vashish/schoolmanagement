import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccess } from '../config/roleAccess';

/**
 * Wraps routes to enforce role-based access.
 * If the user's roles don't allow the current path, redirect to dashboard.
 */
export default function RoleGuard({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Wait for auth to resolve before redirecting — prevents login flash
  // during Google OAuth callback and initial page load
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <span className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const roles = user?.roles || [];
  if (!canAccess(roles, location.pathname)) {
    return <Navigate to="/" replace />;
  }

  return children;
}