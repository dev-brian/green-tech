import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Optional: restrict to specific roles. Omit to allow any authenticated user. */
  requiredRole?: UserRole;
  /** Optional: list of allowed roles. Omit to allow any authenticated user. */
  allowedRoles?: UserRole[];
  /** Whether the user must have an active workspace (default: true) */
  requireWorkspace?: boolean;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  allowedRoles,
  requireWorkspace = true,
}: ProtectedRouteProps) {
  const { user, loading, activeWorkspace, currentRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Cargando sesión…</span>
        </div>
      </div>
    );
  }

  // Not authenticated → redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If requires workspace but none is active → onboarding
  if (requireWorkspace && !activeWorkspace) {
    return <Navigate to="/onboarding" replace />;
  }

  // Role checks
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(currentRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  if (requiredRole && currentRole !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
