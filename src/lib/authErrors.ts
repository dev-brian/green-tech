/**
 * Mensajes de inicio de sesión en español (auditoría A9, issue #35).
 * Antes se mostraba el texto en inglés de Firebase ("Firebase: Error (auth/…)").
 * Lógica pura para probarla con `node --test`.
 */

export function authErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) return String((err as { code: unknown }).code);
  return '';
}

/** null = no es un error que valga la pena mostrar (el usuario cerró la ventana). */
export function authErrorMessage(err: unknown): string | null {
  switch (authErrorCode(err)) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null;
    case 'auth/network-request-failed':
      return 'No hay conexión. Revisa tu internet e intenta de nuevo.';
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio e intenta de nuevo.';
    case 'auth/unauthorized-domain':
      return 'Este sitio no está autorizado para iniciar sesión. Avísale al administrador.';
    case 'auth/user-disabled':
      return 'Esta cuenta está deshabilitada. Avísale al administrador.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
    case 'auth/account-exists-with-different-credential':
      return 'Ya existe una cuenta con ese correo usando otro método de inicio de sesión.';
    case 'auth/operation-not-supported-in-this-environment':
    case 'auth/web-storage-unsupported':
      return 'Este navegador no permite iniciar sesión aquí. Abre GreenTech en Chrome o Safari e intenta de nuevo.';
    case 'auth/internal-error':
      return 'Google no respondió. Intenta de nuevo en un momento.';
    default:
      return 'No se pudo iniciar sesión con Google. Intenta de nuevo.';
  }
}

/** Errores en los que conviene intentar con redirección en vez de ventana emergente. */
export function shouldFallBackToRedirect(err: unknown): boolean {
  const code = authErrorCode(err);
  return code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment';
}
