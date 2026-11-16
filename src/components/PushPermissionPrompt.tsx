import { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePwaInstalled } from '../hooks/usePwaInstall';
import { enablePush, getPushStatus } from '../lib/pushService';

/** Tras "Ahora no" se vuelve a ofrecer después de unos días. */
const DISMISSED_KEY = 'gt-push-prompt-dismissed-at';
const ASK_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function wasDismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < ASK_AGAIN_AFTER_MS;
  } catch {
    return false;
  }
}

function rememberDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Sin almacenamiento local el aviso solo vuelve a salir en la siguiente apertura.
  }
}

/**
 * Ofrece activar el push justo después de instalar la PWA o al abrirla instalada.
 *
 * El navegador solo muestra el permiso de notificaciones si lo pide un toque del
 * usuario (en iPhone es obligatorio), así que no se pide solo al instalar: se
 * muestra este aviso y el botón "Activar alertas" hace la solicitud.
 */
export default function PushPermissionPrompt() {
  const { user } = useAuth();
  const installed = usePwaInstalled();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !installed || wasDismissedRecently()) return;
    let cancelled = false;
    void getPushStatus().then((status) => {
      // Solo se ofrece si nunca se ha pedido: ni bloqueado, ni ya activo, ni sin soporte.
      if (!cancelled && status === 'default') setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user, installed]);

  if (!user || !installed || !visible) return null;

  const activate = async () => {
    setBusy(true);
    try {
      const status = await enablePush(user.uid);
      // Si cerró el aviso del navegador sin responder, se le vuelve a ofrecer más tarde.
      if (status === 'default') rememberDismissed();
    } catch {
      rememberDismissed();
    } finally {
      setBusy(false);
      setVisible(false);
    }
  };

  const dismiss = () => {
    rememberDismissed();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-labelledby="push-prompt-title"
      aria-describedby="push-prompt-text"
      className="nm-flat animate-fade-in"
      style={{
        position: 'fixed', zIndex: 89,
        left: 'var(--space-sm)', right: 'var(--space-sm)', bottom: 'var(--space-sm)',
        maxWidth: 480, margin: '0 auto',
        padding: 'var(--space-sm)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
        <BellRing size={20} strokeWidth={1.5} color="var(--accent)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div id="push-prompt-title" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Activa las alertas en este dispositivo
          </div>
          <div id="push-prompt-text" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 2 }}>
            Te avisaremos aunque la app esté cerrada cuando una variable de tu invernadero llegue a nivel crítico.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
        <button
          className="btn-nm-primary"
          style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={() => void activate()}
          disabled={busy}
        >
          {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          Activar alertas
        </button>
        <button className="btn-nm-secondary" style={{ flex: 1 }} onClick={dismiss} disabled={busy}>
          Ahora no
        </button>
      </div>
    </div>
  );
}
