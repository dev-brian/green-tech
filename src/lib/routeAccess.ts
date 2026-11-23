/**
 * T1.1 (#34) — Quién puede entrar a cada ruta (HU-01).
 *
 * Una sola tabla para el menú y para `ProtectedRoute`, así lo que el menú
 * esconde es exactamente lo que la ruta bloquea. Criterio de HU-01: un
 * operador no ve Plantas, Umbrales, Simulador ni Exportar. Umbrales y Exportar
 * viven dentro de Alertas y del tablero, y ahí se esconden con `isAdmin`; el
 * simulador no tiene pantalla en la PWA (corre aparte, en greenhouse-sim/).
 *
 * Módulo puro (sin React ni Firebase) para probarlo con `node --test`.
 */

export type Role = 'admin' | 'operador';

/** Rutas con rol restringido. Una ruta que no aparece aquí es para cualquier miembro. */
export const ROUTE_ROLES: Readonly<Record<string, readonly Role[]>> = {
  '/plants': ['admin'],
};

export function canAccess(path: string, role: Role): boolean {
  const allowed = ROUTE_ROLES[path];
  return !allowed || allowed.includes(role);
}

export type RouteDecision =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'onboarding' }
  | { kind: 'dashboard' }
  | { kind: 'allow' };

/**
 * Qué hace `ProtectedRoute` con una sesión dada: esperar, mandar a login,
 * mandar a crear/unirse a un invernadero, regresar al tablero (rol sin
 * permiso) o dejar pasar.
 */
export function decideRoute(input: {
  loading: boolean;
  signedIn: boolean;
  hasWorkspace: boolean;
  requireWorkspace: boolean;
  role: Role;
  allowedRoles?: readonly Role[];
}): RouteDecision {
  if (input.loading) return { kind: 'loading' };
  if (!input.signedIn) return { kind: 'login' };
  if (input.requireWorkspace && !input.hasWorkspace) return { kind: 'onboarding' };
  if (input.allowedRoles && input.allowedRoles.length > 0 && !input.allowedRoles.includes(input.role)) {
    return { kind: 'dashboard' };
  }
  return { kind: 'allow' };
}
