import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Una PWA instalada puede quedar abierta por días, así que se revisa periódicamente. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="nm-flat animate-fade-in"
      style={{
        position: 'fixed', zIndex: 90,
        left: 'var(--space-sm)', right: 'var(--space-sm)', bottom: 'var(--space-sm)',
        maxWidth: 480, margin: '0 auto',
        padding: 'var(--space-sm)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>
        <RefreshCw size={20} strokeWidth={1.5} color="var(--accent)" aria-hidden="true" style={{ flexShrink: 0 }} />
        Hay una nueva versión de GreenTech
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
        <button className="btn-nm-primary" style={{ flex: 1 }} onClick={() => void updateServiceWorker(true)}>
          Actualizar
        </button>
        <button className="btn-nm-secondary" style={{ flex: 1 }} onClick={() => setNeedRefresh(false)}>
          Después
        </button>
      </div>
    </div>
  );
}
