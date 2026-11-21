import { useEffect, useRef, useState } from 'react';
import { CloudOff, Cloud, CloudUpload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOnline } from '../hooks/useOnline';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { parseTimestamp } from '../lib/zoneFreshness';
import { newestDate, offlineBannerText } from '../lib/connection';
import { usePendingWrites } from '../hooks/usePendingWrites';
import { pendingText } from '../lib/pendingWrites';

/**
 * Hora del dato más reciente de `state/latest` (un solo documento; el tablero
 * ya lo escucha y Firestore comparte la escucha). Se escucha siempre, no solo
 * sin red, para que esté en la caché aunque se pierda la señal en otra pantalla.
 */
function useLatestDataTime(greenhouseId: string | null): Date | null {
  const [latest, setLatest] = useState<{ id: string; at: Date | null } | null>(null);
  useEffect(() => {
    if (!greenhouseId) return;
    return onSnapshot(
      doc(db, 'greenhouses', greenhouseId, 'state', 'latest'),
      (snap) => {
        const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
        const times = Object.entries(data)
          .filter(([key, val]) => key !== 'updatedAt' && val && typeof val === 'object')
          .map(([, val]) => parseTimestamp((val as Record<string, unknown>).timestamp));
        setLatest({ id: greenhouseId, at: newestDate(times) });
      },
      () => setLatest({ id: greenhouseId, at: null }),
    );
  }, [greenhouseId]);
  return latest && latest.id === greenhouseId ? latest.at : null;
}

/**
 * T10.2 (#60) — Aviso de conexión (HU-10).
 *
 * Sin red: "Sin conexión · datos de las HH:MM", con la hora del dato más
 * reciente que hay en la caché de Firestore (de `state/latest`). Al volver la red se avisa unos
 * segundos que ya hay conexión.
 *
 * T10.3 (#61): si hay cambios hechos sin red (alertas atendidas, umbrales),
 * el aviso dice cuántos faltan por enviar, también mientras se envían.
 */
export default function ConnectionBanner() {
  const online = useOnline();
  const pending = usePendingWrites().length;
  const { activeWorkspace } = useAuth();
  const latest = useLatestDataTime(activeWorkspace?.id ?? null);

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

