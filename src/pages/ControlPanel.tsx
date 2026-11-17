import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Droplets, FlaskConical, Fan, Sprout, Info, CircleDot, ChevronRight, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useZones } from '../hooks/useZones';
import { useNow } from '../hooks/useNow';
import { subscribeToActuators } from '../lib/actuatorsService';
import { ACTUATOR_INFO, ACTUATOR_ORDER, type ActuatorKey, type ZoneActuators } from '../lib/actuators';
import { cropLabel, zoneDisplayName } from '../lib/zones';
import { STALE_THRESHOLD_MS, isStaleAt } from '../lib/zoneFreshness';

/**
 * Equipos del invernadero (auditoría A2, issue #68).
 *
 * Antes esta página era una maqueta: encender la bomba o "Guardar
 * Configuración" no escribía nada, y un operador podía creer que había
 * encendido algo. Ahora muestra, en solo lectura, lo que el backend decidió
 * en greenhouses/{id}/actuators/{zoneId}. El control manual queda fuera del
 * alcance de la entrega; los límites se ajustan en Alertas.
 */

const ICONS: Record<ActuatorKey, typeof Droplets> = {
  recirculationPump: Droplets,
  phDoser: FlaskConical,
  nutrientDoser: Sprout,
  ventilation: Fan,
};

function timeAgo(date: Date | null, now: number): string {
  if (!date) return 'sin hora';
  const s = Math.floor((now - date.getTime()) / 1000);
  if (s < 60) return `hace ${Math.max(0, s)} s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  return `el ${date.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
}

function ActuatorRow({ k, on, stale }: { k: ActuatorKey; on: boolean | null; stale: boolean }) {
  const info = ACTUATOR_INFO[k];
  const Icon = ICONS[k];
  const known = on !== null && !stale;
  const tone = !known ? 'offline' : on ? 'ok' : 'offline';
  const word = on === null ? 'Sin dato' : on ? 'Encendido' : 'Apagado';
  const detail = on === null ? 'El sistema todavía no reporta este equipo.' : on ? info.on : info.off;
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderTop: '1px solid var(--line)' }}>
      <span className={`icon-well icon-well--${tone}`}>
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{info.name}</span>
        <span className="metric-label">{detail}</span>
      </span>
      <span className={`chip chip--${tone}`}>
        <CircleDot size={16} strokeWidth={2} aria-hidden="true" />
        {stale && on !== null ? `${word} (último dato)` : word}
      </span>
    </li>
  );
}

export default function ControlPanel() {
  const { activeWorkspace } = useAuth();
  const greenhouseId = activeWorkspace?.id ?? null;
  const { zonesById } = useZones(greenhouseId);
  const now = useNow(30_000);
  const [result, setResult] = useState<{ greenhouseId: string; zones: ZoneActuators[]; error: string | null } | null>(null);

  useEffect(() => {
    if (!greenhouseId) return;
    return subscribeToActuators(
      greenhouseId,
      (zones) => setResult({ greenhouseId, zones, error: null }),
      (err) => {
        console.error('Error leyendo actuadores:', err);
        setResult({ greenhouseId, zones: [], error: 'No se pudo leer el estado de los equipos. Revisa tu conexión e intenta de nuevo.' });
      },
    );
  }, [greenhouseId]);

  const current = result && result.greenhouseId === greenhouseId ? result : null;

  return (
    <div
      className="container animate-fade-in"
      style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-2xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>Equipos del invernadero</h1>
        <p style={{ maxWidth: 560 }}>
          Qué está encendido en cada zona. El sistema los prende y los apaga solo, según las lecturas.
        </p>
      </header>

      <div className="well" role="note" style={{ display: 'flex', gap: 12, padding: 16, alignItems: 'flex-start' }}>
        <Info size={20} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Solo lectura.</strong> Desde aquí todavía no se puede
          encender ni apagar nada. Para cambiar los rangos que activan cada equipo, ve a{' '}
          <Link to="/alerts" style={{ fontWeight: 600 }}>Alertas</Link>.
        </p>
      </div>

      {!greenhouseId ? null : !current ? (
        <p role="status" style={{ color: 'var(--text-secondary)' }}>Cargando equipos…</p>
      ) : current.error ? (
        <p role="alert" className="glass" style={{ padding: 'var(--space-md)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <WifiOff size={20} aria-hidden="true" /> {current.error}
        </p>
      ) : current.zones.length === 0 ? (
        <div className="glass" style={{ padding: 'var(--space-lg) var(--space-md)', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.125rem' }}>Todavía no hay datos de equipos</h2>
          <p>Aparecerán en cuanto los sensores (o el simulador) manden la primera lectura.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-sm)' }}>
          {current.zones.map((zone) => {
            const stale = isStaleAt(zone.updatedAt, now);
            const crop = cropLabel(zonesById[zone.zoneId]?.crop);
            return (
              <section key={zone.zoneId} className="glass" aria-labelledby={`eq-${zone.zoneId}`} style={{ padding: 'var(--space-sm) 0 0', overflow: 'hidden' }}>
                <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <h2 id={`eq-${zone.zoneId}`} style={{ fontSize: '1.125rem' }}>
                    {zoneDisplayName(zone.zoneId, zonesById)}
                    {crop && <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}> · {crop}</span>}
                  </h2>
                  <span className="metric-label">
                    {stale
                      ? `Sin datos recientes · última actualización ${timeAgo(zone.updatedAt, now)}`
                      : `Actualizado ${timeAgo(zone.updatedAt, now)}`}
                  </span>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {ACTUATOR_ORDER.map((k) => (
                    <ActuatorRow key={k} k={k} on={zone[k].on} stale={stale} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Link to="/dashboard" style={{ minHeight: 48, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
        Volver al tablero <ChevronRight size={16} aria-hidden="true" />
      </Link>
      <span className="metric-label">
        Un equipo sin actualizar en más de {STALE_THRESHOLD_MS / 60000} minutos se muestra en gris.
      </span>
    </div>
  );
}
