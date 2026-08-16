import { Thermometer, Droplets, X } from 'lucide-react';
import { useState } from 'react';

type AlertType = 'warning' | 'danger';

interface Alert {
  id: number;
  type: AlertType;
  title: string;
  message: string;
}

export default function AlertSystem() {
  const [alerts, setAlerts] = useState<Alert[]>([
    { id: 1, type: 'warning', message: 'Nivel de agua bajo en el depósito principal.', title: 'Falta de agua' },
    { id: 2, type: 'danger',  message: 'Temperatura por encima de 28°C detectada.',  title: 'Temperatura Alta' },
  ]);

  const removeAlert = (id: number) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="alert-container">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`alert-nm alert-nm--${alert.type} animate-fade-in`}
          role="alert"
        >
          {/* Icono con LED semáforo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xs)', paddingTop: 2 }}>
            {alert.type === 'danger'
              ? <Thermometer size={20} strokeWidth={1.5} color="var(--status-red)" />
              : <Droplets    size={20} strokeWidth={1.5} color="var(--status-yellow)" />
            }
            <span
              className={`nm-led nm-led--${alert.type === 'danger' ? 'red' : 'yellow'} ${alert.type === 'danger' ? 'nm-led--red-pulse' : ''}`}
              role="status"
              aria-label={alert.type === 'danger' ? 'Alerta crítica' : 'Advertencia'}
            />
          </div>

          {/* Contenido */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0,
              marginBottom: 4,
              fontWeight: 700,
              fontSize: '0.9rem',
              color: alert.type === 'danger' ? 'var(--status-red)' : 'var(--status-yellow)',
            }}>
              {alert.title}
            </p>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {alert.message}
            </p>
          </div>

          {/* Cerrar — zona táctil 48×48 */}
          <button
            onClick={() => removeAlert(alert.id)}
            aria-label="Cerrar alerta"
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
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-disabled)')}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      ))}
    </div>
  );
}
