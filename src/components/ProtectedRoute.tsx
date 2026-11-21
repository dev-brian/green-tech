import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '../context/AuthContext';
import { ROUTE_ROLES, decideRoute } from '../lib/routeAccess';

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * Roles que pueden entrar. Si se omite, se usa la tabla de
   * `lib/routeAccess.ts` para la ruta actual (la misma que filtra el menú).
   */
  allowedRoles?: UserRole[];
  /** Si exige tener un invernadero activo (por defecto, sí). */
  requireWorkspace?: boolean;
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  requireWorkspace = true,
}: ProtectedRouteProps) {
  const { user, loading, activeWorkspace, currentRole } = useAuth();
  const location = useLocation();

  const decision = decideRoute({
    loading,
    signedIn: !!user,
    hasWorkspace: !!activeWorkspace,
    requireWorkspace,
    role: currentRole,
    allowedRoles: allowedRoles ?? ROUTE_ROLES[location.pathname],
  });

  switch (decision.kind) {
    case 'loading':
      return (
        <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-sm)', minHeight: '60vh', color: 'var(--text-secondary)' }}>
          <span style={{ width: 20, height: 20, border: '2px solid var(--track)', borderTopColor: 'var(--leaf)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} aria-hidden="true" />
          <span>Cargando sesión…</span>
        </div>
      );
    case 'login':
      return <Navigate to="/login" state={{ from: location }} replace />;
    case 'onboarding':
      return <Navigate to="/onboarding" replace />;
    case 'dashboard':
      return <Navigate to="/dashboard" replace />;
    default:
      return <>{children}</>;
  }
}
