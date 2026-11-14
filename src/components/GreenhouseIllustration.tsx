import type { SensorStatus } from '../lib/sensorThresholds';
import { STATUS_CLASS } from '../lib/plainLanguage';

export interface IllustrationZone {
  zoneId: string;
  label: string;
  status: SensorStatus;
}

interface Props {
  /** Hasta 3 zonas, en el orden en que se dibujan (izquierda a derecha). */
  zones: IllustrationZone[];
  /** Etiqueta del problema más urgente, p. ej. "Zona 2 · Acidez". */
  callout?: { zoneId: string; title: string; value: string; status: SensorStatus };
}

// Proyección isométrica: el piso mide 300 × 170 y se reparte entre las zonas.
const FLOOR = 'matrix(0.866 0.5 -0.866 0.5 330 190)';
// Punto del piso (x, y, altura z) llevado a coordenadas del viewBox.
function iso(x: number, y: number, z = 0) {
  return { x: 330 + 0.866 * (x - y), y: 190 + 0.5 * (x + y) - z };
}

/**
 * Invernadero isométrico con las zonas pintadas por estado y solo el pin
 * del problema más urgente etiquetado (SKILL.md § 6.4). Decorativo: la
 * misma información está en texto en el inicio.
 */
export default function GreenhouseIllustration({ zones, callout }: Props) {
  const shown = zones.slice(0, 3);
  const width = 300 / Math.max(shown.length, 1);
  const calloutIdx = callout ? shown.findIndex((z) => z.zoneId === callout.zoneId) : -1;
  const center = (i: number) => (i + 0.5) * width;
  // Etiqueta de zona: al frente del piso. Pin: sobre el canal frontal.
  const tagPos = shown.map((_, i) => iso(center(i), 185));
  const pin = calloutIdx >= 0 ? iso(center(calloutIdx), 142, 28) : null;
  const description = shown
    .map((z) => `${z.label}: ${z.status === 'green' ? 'en orden' : z.status === 'offline' ? 'sin datos' : 'por revisar'}`)
    .join('; ');

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox="0 0 700 500" style={{ display: 'block', width: '100%', height: 'auto' }} role="img" aria-label={`Invernadero. ${description}.`}>
        <defs>
          <pattern id="gh-plants" patternUnits="userSpaceOnUse" x="10" y="30" width="20" height="35">
            <rect width="20" height="14" className="gh-channel" />
            <circle cx="10" cy="7" r="6.5" className="gh-plant" />
            <circle cx="10" cy="7" r="3" className="gh-plant-2" />
          </pattern>
        </defs>
        <g transform="translate(0,10)">
          <g transform={FLOOR}><rect x="-24" y="-20" width="416" height="205" rx="18" className="gh-edge" /></g>
        </g>
        <g transform={FLOOR}>
          <rect x="-24" y="-20" width="416" height="205" rx="18" className="gh-ground" />
          <rect x="0" y="0" width="300" height="170" className="gh-floor" />
          {shown.map((z, i) => (
            <rect key={z.zoneId} x={i * width} y="0" width={width} height="170" className={`gh-zone gh-zone--${STATUS_CLASS[z.status]}`} />
          ))}
          {[30, 65, 100, 135].map((y) => (
            <rect key={y} x="10" y={y} width="280" height="14" className="gh-shade" />
          ))}
          <ellipse cx="345" cy="30" rx="34" ry="34" className="gh-shade" />
        </g>
        <g transform="matrix(0.866 0.5 0 -1 330 190)">
          <rect x="0" y="0" width="300" height="95" className="gh-glass" />
          <path d="M50 0V95M100 0V95M150 0V95M200 0V95M250 0V95M0 48H300" className="gh-mullion" />
        </g>
        <g transform="matrix(-0.866 0.5 0 -1 330 190)">
          <polygon points="0,0 170,0 170,95 85,150 0,95" className="gh-glass" />
          <path d="M42.5 0V121M85 0V150M127.5 0V121M0 48H170" className="gh-mullion" />
        </g>
        <g transform="matrix(0.866 0.5 -73.6 -12.5 330 95)">
          <rect x="0" y="0" width="300" height="1" className="gh-glass" />
        </g>
        <g transform="translate(0,-28)">
          <g transform={FLOOR}><rect x="10" y="30" width="280" height="119" fill="url(#gh-plants)" /></g>
        </g>
        <path d="M575 372 H468" className="gh-pipe" />
        <path d="M573 315 V377 A30 15 0 0 0 633 377 V315 Z" className="gh-tank" />
        <path d="M573 335 V377 A30 15 0 0 0 633 377 V335 Z" className="gh-water" />
        <ellipse cx="603" cy="335" rx="30" ry="15" className="gh-water-top" />
        <ellipse cx="603" cy="315" rx="30" ry="15" className="gh-tank" fillOpacity={0.75} />
        <g transform="matrix(0.866 0.5 0 -1 182.8 275)">
          <rect x="0" y="0" width="300" height="95" className="gh-front" />
          <path d="M50 0V95M100 0V95M150 0V95M200 0V95M250 0V95M0 48H300" className="gh-mullion" opacity={0.8} />
        </g>
        <g transform="matrix(-0.866 0.5 0 -1 589.8 340)">
          <polygon points="0,0 170,0 170,95 85,150 0,95" className="gh-front" />
          <path d="M42.5 0V121M85 0V150M127.5 0V121M0 48H170" className="gh-mullion" opacity={0.8} />
        </g>
        <g transform="matrix(0.866 0.5 73.6 -97.5 182.8 180)">
          <rect x="0" y="0" width="300" height="1" className="gh-front" />
          <path d="M50 0V1M100 0V1M150 0V1M200 0V1M250 0V1" className="gh-mullion" />
        </g>
        {pin && callout && (
          <>
            <path d={`M${pin.x} ${pin.y} L${pin.x - 120} ${pin.y - 115}`} stroke="currentColor" strokeOpacity={0.4} strokeWidth={1} fill="none" />
            {callout.status === 'red' && <circle className="gh-ring" cx={pin.x} cy={pin.y} r={16} />}
            <circle className={`gh-pin ${callout.status === 'yellow' ? 'gh-pin--warn' : ''}`} cx={pin.x} cy={pin.y} r={10} />
          </>
        )}
      </svg>

      {pin && callout && (
        <div
          className={`tnum chip--${STATUS_CLASS[callout.status]}`}
          style={{
            position: 'absolute',
            left: `${((pin.x - 118) / 700) * 100}%`,
            top: `${((pin.y - 115) / 500) * 100}%`,
            transform: 'translate(-100%, -50%)',
            padding: '8px 12px',
            borderRadius: 14,
            display: 'flex',
            flexDirection: 'column',
            lineHeight: 1.2,
            boxShadow: 'var(--shadow-card)',
          }}
          aria-hidden="true"
        >
          <span style={{ fontSize: 12, fontWeight: 600 }}>{callout.title}</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{callout.value}</span>
        </div>
      )}
      {shown.map((z, i) => (
        <span
          key={z.zoneId}
          className="chip glass"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: `${(tagPos[i].x / 700) * 100}%`,
            top: `${(tagPos[i].y / 500) * 100}%`,
            transform: 'translate(-50%, 0)',
            color: 'var(--text-primary)',
          }}
        >
          <span className={`dot dot--${STATUS_CLASS[z.status]}`} />
          {z.label}
        </span>
      ))}
    </div>
  );
}
