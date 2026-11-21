import { useEffect, useRef, useState } from 'react';
import { CloudOff, Cloud, CloudUpload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOnline } from '../hooks/useOnline';
import { useTelemetrySource } from '../hooks/useTelemetrySource';
import { newestDate, offlineBannerText } from '../lib/connection';
import { usePendingWrites } from '../hooks/usePendingWrites';
import { pendingText } from '../lib/pendingWrites';

/**
 * T10.2 (#60) — Aviso de conexión (HU-10).
 *
 * Sin red: "Sin conexión · datos de las HH:MM", con la hora del dato más
 * reciente que hay en la caché de Firestore. Al volver la red se avisa unos
 * segundos que ya hay conexión.
 *
 * T10.3 (#61): si hay cambios hechos sin red (alertas atendidas, umbrales),
 * el aviso dice cuántos faltan por enviar, también mientras se envían.
 */
export default function ConnectionBanner() {
  const online = useOnline();
  const pending = usePendingWrites().length;
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

  if (online && !showBack && pending === 0) return null;

  const state = !online ? 'offline' : pending > 0 ? 'pending' : 'back';
  const Icon = state === 'offline' ? CloudOff : state === 'pending' ? CloudUpload : Cloud;
  const text =
    state === 'offline'
      ? offlineBannerText(latest) + (pending > 0 ? ` · ${pendingText(pending)}` : '')
      : state === 'pending'
        ? (pending === 1 ? 'Enviando 1 cambio hecho sin conexión…' : `Enviando ${pending} cambios hechos sin conexión…`)
        : 'Conexión recuperada';
  return (
    <div
      role="status"
      aria-live="polite"
      className="connection-banner"
      data-state={state}
    >
      <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <Icon size={18} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: 600 }}>
          {text}
        </span>
      </div>
    </div>
  );
}

