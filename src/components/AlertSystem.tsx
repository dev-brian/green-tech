import { Thermometer, Droplets, Sprout, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAlerts, type FirestoreAlert } from '../hooks/useAlerts';

function iconFor(variable: string, color: string) {
  const props = { size: 20, strokeWidth: 1.5, color };
  if (variable === 'temperature') return <Thermometer {...props} />;
  if (variable === 'humidity')    return <Droplets    {...props} />;
  return                                  <Sprout     {...props} />;
}

function AlertBanner({ alert, onDismiss }: { alert: FirestoreAlert; onDismiss: (id: string) => void }) {
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
      </div>

      <button
        onClick={() => onDismiss(alert.id)}
        aria-label="Marcar alerta como atendida y cerrar"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-disabled)',
          cursor: 'pointer',
          padding: 8,
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 32,
          minHeight: 32,
          flexShrink: 0,
          transition: 'color 0.15s ease',
        }}
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
 * Presionar X marca la alerta como "attended" en Firestore.
 * Máximo 3 banners visibles a la vez para no saturar la pantalla.
 */
export default function AlertSystem() {
  const { activeWorkspace } = useAuth();
  const { alerts, markAttended } = useAlerts(activeWorkspace?.id ?? null);

  const banners = alerts.filter((a) => a.status === 'new').slice(0, 3);

  if (banners.length === 0) return null;

  return (
    <div className="alert-container">
      {banners.map((alert) => (
        <AlertBanner key={alert.id} alert={alert} onDismiss={markAttended} />
      ))}
    </div>
  );
}
