import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Thermometer, Droplets, Sprout, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAlerts, type FirestoreAlert } from '../hooks/useAlerts';

function iconFor(variable: string, color: string) {
  const props = { size: 20, strokeWidth: 1.5, color };
  if (variable === 'temperature') return <Thermometer {...props} />;
  if (variable === 'humidity')    return <Droplets    {...props} />;
  return                                  <Sprout     {...props} />;
}

const DISMISSED_KEY = 'gt.dismissedAlertBanners';

/**
 * Clave de un aviso cerrado. Incluye la severidad: si la alerta sube de
 * precaución a crítica el aviso vuelve a salir.
 */
function dismissKey(alert: FirestoreAlert): string {
  return `${alert.id}:${alert.severity}`;
}

function readDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(keys: Set<string>) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...keys].slice(-200)));
  } catch {
    // Sin almacenamiento (modo privado): el aviso queda cerrado solo en esta vista.
  }
}

const iconButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-disabled)',
  cursor: 'pointer',
  padding: 8,
  borderRadius: 'var(--radius-sm)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 48,
  minHeight: 48,
  flexShrink: 0,
  transition: 'color 0.15s ease',
};

function AlertBanner({
  alert,
  onClose,
  onAttend,
}: {
  alert: FirestoreAlert;
  onClose: (alert: FirestoreAlert) => void;
  onAttend: (alert: FirestoreAlert) => void;
}) {
  const isDanger = alert.severity === 'red';
  const color    = isDanger ? 'var(--status-red)' : 'var(--status-yellow)';

  return (
    <div
      className={`alert-nm alert-nm--${isDanger ? 'danger' : 'warning'} animate-fade-in`}
      role="alert"
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xs)', paddingTop: 2 }}>
        {iconFor(alert.variable, color)}
        <span
          className={`nm-led nm-led--${isDanger ? 'red' : 'yellow'}${isDanger ? ' nm-led--red-pulse' : ''}`}
          role="status"
          aria-label={isDanger ? 'Alerta crítica' : 'Advertencia'}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, marginBottom: 4, fontWeight: 700, fontSize: '0.9rem', color }}>
          {alert.sector} — {alert.message}
        </p>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Valor actual: <strong style={{ color }}>{alert.value}</strong>. Ver historial en la sección de Alertas.
        </p>
        <button
          onClick={() => onAttend(alert)}
          className="btn-nm-secondary"
          title="Marca la alerta como atendida para todo el equipo"
          style={{ width: 'auto', minHeight: 48, padding: '0 16px', marginTop: 'var(--space-xs)', fontSize: '0.8125rem' }}
        >
          <Check size={14} strokeWidth={2} />
          Ya lo revisé
        </button>
      </div>

      <button
        onClick={() => onClose(alert)}
        aria-label="Cerrar aviso"
        title="Cerrar aviso (solo en este dispositivo)"
        style={iconButtonStyle}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-disabled)')}
      >
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}

/**
 * Muestra banners flotantes para las alertas "new" del invernadero activo.
 * - La X solo cierra el aviso en este dispositivo; la alerta sigue igual para el equipo.
 * - "Ya lo revisé" la marca como atendida en Firestore para todos. La alerta
 *   sigue abierta hasta que el valor vuelva a rango, sin crear otra (C4).
 * Máximo 3 banners visibles a la vez para no saturar la pantalla.
 */
export default function AlertSystem() {
  const { activeWorkspace } = useAuth();
  const { alerts, markAttended } = useAlerts(activeWorkspace?.id ?? null);
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed);

  const close = useCallback((alert: FirestoreAlert) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(dismissKey(alert));
      saveDismissed(next);
      return next;
    });
  }, []);

  const attend = useCallback(
    (alert: FirestoreAlert) => {
      close(alert);
      markAttended(alert.id).catch(() => {
        // Si falla (sin conexión o sin permiso) el aviso vuelve a mostrarse.
        setDismissed((prev) => {
          const next = new Set(prev);
          next.delete(dismissKey(alert));
          saveDismissed(next);
          return next;
        });
      });
    },
    [close, markAttended],
  );

  const open = alerts.filter((a) => a.status === 'new' && !a.resolvedAt && !dismissed.has(dismissKey(a)));
  const banners = open.slice(0, 3);

  if (banners.length === 0) return null;

  // T3.2 (#72): en un celular de 360 px tres avisos tapaban media pantalla;
  // ahí se muestra solo el primero y un enlace a los demás (ver index.css).
  const more = open.length - 1;
  return (
    <div className="alert-container">
      {banners.map((alert) => (
        <AlertBanner key={alert.id} alert={alert} onClose={close} onAttend={attend} />
      ))}
      {more > 0 && (
        <Link to="/alerts" className="alert-more">
          {more === 1 ? 'Ver 1 aviso más' : `Ver ${more} avisos más`}
        </Link>
      )}
    </div>
  );
}
