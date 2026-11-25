import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Thermometer, Droplets, Sprout, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAlerts, type FirestoreAlert } from '../hooks/useAlerts';
import { useZones } from '../hooks/useZones';
import { zoneDisplayName } from '../lib/zones';

function iconFor(variable: string, color: string) {
  const props = { size: 18, strokeWidth: 1.75, color };
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

function AlertToast({
  alert,
  zoneName,
  more,
  onClose,
  onAttend,
}: {
  alert: FirestoreAlert;
  /** Nombre que el admin le puso a la zona (T3.3 #73: "zona-2" no le decía nada a los usuarios). */
  zoneName: string;
  /** Cuántas alertas nuevas más hay, además de esta. */
  more: number;
  onClose: (alert: FirestoreAlert) => void;
  onAttend: (alert: FirestoreAlert) => void;
}) {
  const isDanger = alert.severity === 'red';
  const color    = isDanger ? 'var(--status-crit-text)' : 'var(--status-warn-text)';

  return (
    <div
      className={`alert-toast alert-toast--${isDanger ? 'danger' : 'warning'} animate-fade-in`}
      role="alert"
    >
      <span className="alert-toast__icon" aria-hidden="true">{iconFor(alert.variable, color)}</span>

      <div className="alert-toast__text">
        <p className="alert-toast__title" style={{ color }}>
          <span className="sr-only">{isDanger ? 'Alerta crítica: ' : 'Advertencia: '}</span>
          {zoneName}
        </p>
        <p className="alert-toast__msg" title={`${alert.message}. Valor actual: ${alert.value}`}>
          {alert.message}
        </p>
      </div>

      <div className="alert-toast__actions">
        <Link to="/alerts" className="alert-toast__btn" title="Abrir la bandeja de alertas">
          {more > 0 ? `Ver (+${more})` : 'Ver'}
        </Link>
        <button
          type="button"
          onClick={() => onAttend(alert)}
          className="alert-toast__btn alert-toast__btn--icon"
          aria-label="Ya lo revisé"
          title="Ya lo revisé: la marca como atendida para todo el equipo"
        >
          <Check size={18} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => onClose(alert)}
          className="alert-toast__btn alert-toast__btn--icon"
          aria-label="Cerrar aviso"
          title="Cerrar aviso (solo en este dispositivo)"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

/**
 * Aviso flotante de la alerta "new" más reciente del invernadero activo.
 * - Uno solo y en una línea: antes se apilaban hasta 3 y tapaban media pantalla
 *   en celular y la pantalla entera en horizontal (revisión UI 25 nov).
 * - La X solo cierra el aviso en este dispositivo y no vuelve al cambiar de
 *   página; sale otra vez si llega una alerta nueva o si sube a crítica.
 * - "Ya lo revisé" la marca como atendida en Firestore para todos. La alerta
 *   sigue abierta hasta que el valor vuelva a rango, sin crear otra (C4).
 * - No se muestra en la página de Alertas (App.tsx).
 */
export default function AlertSystem() {
  const { activeWorkspace } = useAuth();
  const { alerts, markAttended } = useAlerts(activeWorkspace?.id ?? null);
  const { zonesById } = useZones(activeWorkspace?.id ?? null);
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
  if (open.length === 0) return null;

  // La más grave primero; a igual severidad, la que llegó al final (useAlerts ordena por fecha).
  const first = open.find((a) => a.severity === 'red') ?? open[0];
  return (
    <div className="alert-container">
      <AlertToast
        key={first.id}
        alert={first}
        zoneName={zoneDisplayName(first.sector, zonesById)}
        more={open.length - 1}
        onClose={close}
        onAttend={attend}
      />
    </div>
  );
}
