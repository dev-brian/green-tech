import { useEffect, useState } from 'react';
import { BellRing, BellOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { disablePush, enablePush, getPushStatus, refreshPushToken, type PushStatus } from '../lib/pushService';

const STATUS_TEXT: Record<PushStatus, string> = {
  unsupported: 'Este navegador no admite notificaciones push. Instala la app o usa Chrome, Edge o Firefox.',
  'not-configured': 'Las notificaciones push aún no están configuradas en este despliegue.',
  denied: 'Bloqueaste las notificaciones. Actívalas desde la configuración del sitio en tu navegador.',
  default: 'Recibe un aviso en este dispositivo cuando una variable llegue a nivel crítico.',
  enabled: 'Este dispositivo recibirá un aviso cuando haya una alerta crítica.',
};

/** Activa o desactiva el push FCM de alertas críticas en este dispositivo (T6.4 #51). */
export default function PushNotificationsToggle() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Si ya había permiso, se refresca el token (FCM puede rotarlo).
      if (user) await refreshPushToken(user.uid);
      const s = await getPushStatus();
      if (!cancelled) setStatus(s);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!user || status === null) return null;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (status === 'enabled') {
        await disablePush(user.uid);
        setStatus('default');
      } else {
        setStatus(await enablePush(user.uid));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la configuración de notificaciones.');
    } finally {
      setBusy(false);
    }
  };

  const canToggle = status === 'default' || status === 'enabled';
  const Icon = status === 'enabled' ? BellRing : BellOff;

  return (
    <div
      className="nm-flat"
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap',
        padding: 'var(--space-sm)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-lg)',
      }}
    >
      <Icon size={20} strokeWidth={1.5} color={status === 'enabled' ? 'var(--accent)' : 'var(--text-secondary)'} aria-hidden="true" />
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
          Notificaciones push
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }} role="status">
          {error ?? STATUS_TEXT[status]}
        </div>
      </div>
      {canToggle && (
        <button
          className={status === 'enabled' ? 'btn-nm-secondary' : 'btn-nm-primary'}
          onClick={() => void toggle()}
          disabled={busy}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {status === 'enabled' ? 'Desactivar' : 'Activar'}
        </button>
      )}
    </div>
  );
}
