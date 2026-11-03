import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Cada cuánto se pregunta al servidor si hay una versión nueva (la app puede quedar abierta días).
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registra el service worker y, cuando hay una versión nueva descargada,
 * muestra un aviso para actualizar. La versión nueva no se activa sin que
 * el usuario la acepte, para no recargar la pantalla mientras la usa.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => {});
      }, UPDATE_CHECK_MS);
    },
    onRegisterError(error) {
      console.error('No se pudo registrar el service worker:', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="nm-flat animate-fade-in"
      style={{
        position: 'fixed',
        left: 'var(--space-sm)',
        right: 'var(--space-sm)',
        bottom: 'calc(var(--space-sm) + env(safe-area-inset-bottom, 0px))',
        zIndex: 50,
        maxWidth: 480,
        margin: '0 auto',
        padding: 'var(--space-sm)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-xs)' }}>
        <RefreshCw size={20} strokeWidth={1.5} color="var(--accent)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Hay una versión nueva de GreenTech</p>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>Actualiza para usarla. La página se recargará.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" className="btn-nm-secondary" style={{ flex: '1 1 120px' }} onClick={() => setNeedRefresh(false)}>
          Después
        </button>
        <button type="button" className="btn-nm-primary" style={{ flex: '1 1 120px' }} onClick={() => updateServiceWorker(true)}>
          Actualizar
        </button>
      </div>
    </div>
  );
}
