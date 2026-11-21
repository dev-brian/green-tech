import { useEffect, useRef, useState } from 'react';
import { CloudOff, Cloud } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOnline } from '../hooks/useOnline';
import { useTelemetrySource } from '../hooks/useTelemetrySource';
import { newestDate, offlineBannerText } from '../lib/connection';

/**
 * T10.2 (#60) — Aviso de conexión (HU-10).
 *
 * Sin red: "Sin conexión · datos de las HH:MM", con la hora del dato más
 * reciente que hay en la caché de Firestore. Al volver la red se avisa unos
 * segundos que ya hay conexión.
 */
export default function ConnectionBanner() {
  const online = useOnline();
  const { activeWorkspace } = useAuth();
  const { zonesById } = useTelemetrySource(online ? null : (activeWorkspace?.id ?? null));
  const latest = newestDate(Object.values(zonesById ?? {}).map((z) => z.timestamp));

  // "Conexión recuperada" solo tras haber estado sin red en esta visita.
  const wasOffline = useRef(!online);
  const [showBack, setShowBack] = useState(false);
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      const t = setTimeout(() => setShowBack(false), 0);
      return () => clearTimeout(t);
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    const show = setTimeout(() => setShowBack(true), 0);
    const hide = setTimeout(() => setShowBack(false), 4000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [online]);

  if (online && !showBack) return null;

  const Icon = online ? Cloud : CloudOff;
  return (
    <div
      role="status"
      aria-live="polite"
      className="connection-banner"
      data-state={online ? 'back' : 'offline'}
    >
      <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <Icon size={18} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: 600 }}>
          {online ? 'Conexión recuperada' : offlineBannerText(latest)}
        </span>
      </div>
    </div>
  );
}

