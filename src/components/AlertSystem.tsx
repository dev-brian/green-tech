import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function AlertSystem() {
  const [alerts, setAlerts] = useState([
    { id: 1, type: 'warning', message: 'Nivel de agua bajo en el depósito principal.', title: 'Falta de agua' },
    { id: 2, type: 'danger', message: 'Temperatura por encima de 28°C detectada.', title: 'Temperatura Alta' }
  ]);

  const removeAlert = (id: number) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '1rem', width: '350px' }}>
      {alerts.map(alert => (
        <div key={alert.id} className="animate-fade-in" style={{
          background: alert.type === 'danger' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(245, 158, 11, 0.9)',
          backdropFilter: 'blur(8px)',
          padding: '1rem',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: '#fff',
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-start'
        }}>
          <AlertTriangle size={24} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>{alert.title}</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>{alert.message}</p>
          </div>
          <button onClick={() => removeAlert(alert.id)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}>
            <X size={20} />
          </button>
        </div>
      ))}
    </div>
  );
}
