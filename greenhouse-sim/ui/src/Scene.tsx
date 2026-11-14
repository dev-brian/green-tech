/**
 * Vista del invernadero: cielo, y por cada zona sus camas, tanque, bomba,
 * tuberías, dosificadoras, llenado, ventilación, lámparas y nodo de sensores.
 * Solo pinta el estado que llega del servidor; no simula nada.
 */

import type { KeyboardEvent, ReactNode } from 'react';
import type { DeviceId } from '../../model/types.ts';
import { DEVICE_LABELS } from '../../model/commands.ts';
import type { Snapshot, ZoneSnapshot } from '../../simulation.ts';

export type Selection =
  | { zoneId: string; target: DeviceId | 'tank' | 'node' }
  | null;

interface SceneProps {
  snapshot: Snapshot;
  selection: Selection;
  onSelect: (selection: Selection) => void;
}

const BAY_W = 380;
const BAY_X = [20, 410, 800];

function mix(a: number[], b: number[], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function Sky({ snapshot }: { snapshot: Snapshot }) {
  const { env, hour } = snapshot;
  const day = Math.min(1, env.sun * 1.6);
  const top = mix([10, 14, 28], [46, 92, 150], day);
  const bottom = mix([24, 28, 44], [120, 160, 196], day);
  const isDay = env.sun > 0;
  // El sol recorre el cielo de 6:30 a 18:30; la luna hace lo propio de noche.
  const dayT = (hour - 6.5) / 12;
  const nightT = ((hour + 24 - 18.5) % 24) / 12;
  const t = isDay ? dayT : nightT;
  const x = 80 + 1040 * t;
  const y = 104 - 78 * Math.sin(Math.PI * t);

  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1200" height="600" fill="url(#sky)" />
      {!isDay &&
        [[120, 30], [310, 58], [520, 24], [700, 66], [905, 36], [1090, 60], [430, 90], [980, 96]].map(
          ([sx, sy]) => <circle key={`${sx}-${sy}`} cx={sx} cy={sy} r="1.3" fill="#e2e8f0" opacity="0.7" />,
        )}
      {isDay ? (
        <g>
          <circle cx={x} cy={y} r="30" fill="#fde68a" opacity="0.25" />
          <circle cx={x} cy={y} r="17" fill="#fcd34d" />
        </g>
      ) : (
        <g>
          <circle cx={x} cy={y} r="14" fill="#e2e8f0" />
          <circle cx={x + 6} cy={y - 4} r="12" fill={top} />
        </g>
      )}
      <g opacity={env.cloud} fill={isDay ? '#e5e7eb' : '#64748b'}>
        {[[170, 52], [470, 78], [760, 44], [1040, 82]].map(([cx, cy]) => (
          <g key={cx}>
            <ellipse cx={cx} cy={cy} rx="62" ry="17" />
            <ellipse cx={cx - 30} cy={cy + 8} rx="42" ry="13" />
            <ellipse cx={cx + 36} cy={cy + 7} rx="48" ry="14" />
          </g>
        ))}
      </g>
      <rect x="0" y="560" width="1200" height="40" fill="#161a21" />
    </g>
  );
}

interface PartProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  fault?: 'none' | 'failed' | 'stuckOn';
  badge?: [number, number];
  children: ReactNode;
}

/** Elemento del dibujo que se puede seleccionar con clic o teclado. */
function Part({ label, selected, onClick, fault = 'none', badge, children }: PartProps) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
  return (
    <g
      className={`part${selected ? ' part-selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={onKey}
    >
      <title>{label}</title>
      {children}
      {fault !== 'none' && badge && (
        <g transform={`translate(${badge[0]}, ${badge[1]})`} className="fault-badge">
          <circle r="9" fill={fault === 'failed' ? 'var(--status-red)' : 'var(--status-yellow)'} />
          <text y="4" textAnchor="middle" fontSize="12" fontWeight="700" fill="#111">
            !
          </text>
        </g>
      )}
    </g>
  );
}

function Plant({ x, y, crop, health, wetness }: { x: number; y: number; crop: string; health: number; wetness: number }) {
  // De verde sano a pajizo según la salud; se dobla cuando las raíces se secan.
  const h = health / 100;
  const leaf = mix([146, 120, 60], [52, 190, 110], h);
  const dark = mix([110, 88, 48], [22, 130, 78], h);
  const droop = (1 - Math.min(1, wetness / 0.5)) * 0.4;
  const scaleY = 1 - droop;
  if (crop === 'jitomate') {
    return (
      <g transform={`translate(${x}, ${y}) scale(1, ${scaleY})`}>
        <path d="M0 0 V-30" stroke={dark} strokeWidth="2.2" fill="none" />
        <ellipse cx="-7" cy="-12" rx="8" ry="4" fill={leaf} transform={`rotate(${-24 + droop * 60} -7 -12)`} />
        <ellipse cx="7" cy="-18" rx="8" ry="4" fill={leaf} transform={`rotate(${24 - droop * 60} 7 -18)`} />
        <ellipse cx="-6" cy="-26" rx="7" ry="3.6" fill={leaf} transform="rotate(-18 -6 -26)" />
        <ellipse cx="5" cy="-31" rx="6" ry="3.4" fill={leaf} />
        <circle cx="6" cy="-9" r="3.4" fill={h > 0.45 ? '#ef4444' : '#a16207'} />
        <circle cx="-5" cy="-19" r="2.8" fill={h > 0.45 ? '#f87171' : '#a16207'} />
      </g>
    );
  }
  return (
    <g transform={`translate(${x}, ${y}) scale(1, ${scaleY})`}>
      <ellipse cx="-8" cy="-7" rx="9" ry="6" fill={dark} transform={`rotate(${-28 + droop * 50} -8 -7)`} />
      <ellipse cx="8" cy="-7" rx="9" ry="6" fill={dark} transform={`rotate(${28 - droop * 50} 8 -7)`} />
      <ellipse cx="0" cy="-11" rx="9" ry="8" fill={leaf} />
      <ellipse cx="0" cy="-9" rx="4.5" ry="4.5" fill={mix([170, 150, 90], [150, 226, 160], h)} />
    </g>
  );
}

const LED_COLOR: Record<string, string> = {
  ok: 'var(--status-green)',
  queued: 'var(--status-yellow)',
  rejected: 'var(--status-red)',
  idle: 'var(--status-blue)',
  off: 'var(--status-offline)',
};

interface BayProps {
  zone: ZoneSnapshot;
  x: number;
  power: boolean;
  network: boolean;
  selection: Selection;
  onSelect: (selection: Selection) => void;
}

function Bay({ zone, x, power, network, selection, onSelect }: BayProps) {
  const d = zone.devices;
  const isSel = (target: string) => selection?.zoneId === zone.id && selection.target === target;
  const select = (target: DeviceId | 'tank' | 'node') => () => onSelect({ zoneId: zone.id, target });
  const dev = (id: DeviceId) => ({
    label: `${DEVICE_LABELS[id]} de ${zone.name}: ${d[id].running ? 'funcionando' : 'detenida'}`,
    selected: isSel(id),
    onClick: select(id),
    fault: d[id].fault,
  });

  const flowing = d.recirculationPump.running;
  const wet = zone.plants.rootWetness;
  const level = Math.max(0, Math.min(100, zone.tank.levelPct));
  const liquidH = (96 * level) / 100;
  const liquidY = 538 - liquidH;
  // El agua se enturbia hacia el ámbar si el pH se sale del rango 5.5–6.5.
  const phOff = Math.min(1, Math.abs(zone.tank.ph - 6) / 1.2);
  const water = mix([34, 160, 190], [196, 150, 60], phOff);
  const pipe = 'var(--pipe)';
  const flowClass = flowing ? 'flow' : 'flow flow-off';
  const beds = [320, 376];
  const plantXs = [64, 112, 160, 208, 256, 304];
  const klx = zone.light / 1000;

  return (
    <g transform={`translate(${x}, 0)`}>
      {/* Nave */}
      <path d={`M0 150 Q${BAY_W / 2} 74 ${BAY_W} 150 V560 H0 Z`} fill="rgba(30, 34, 43, 0.86)" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
      <path d={`M0 150 Q${BAY_W / 2} 74 ${BAY_W} 150`} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
      <line x1={BAY_W / 2} y1="112" x2={BAY_W / 2} y2="150" stroke="rgba(255,255,255,0.08)" />
      <line x1="0" y1="150" x2={BAY_W} y2="150" stroke="rgba(255,255,255,0.08)" />

      <text x="18" y="176" className="svg-title">
        {zone.name} · {zone.cropLabel}
      </text>
      <text x="18" y="193" className="svg-sub">
        {zone.system} · aire {zone.air.tempC.toFixed(1)} °C · {zone.air.rh.toFixed(0)} % HR · {klx.toFixed(1)} klx
      </text>

      {/* Lámparas */}
      <Part {...dev('lamps')} badge={[306, 208]}>
        <rect x="34" y="204" width="270" height="22" fill="transparent" />
        <line x1="40" y1="210" x2="300" y2="210" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
        {[70, 170, 270].map((lx) => (
          <g key={lx}>
            {d.lamps.running && (
              <polygon points={`${lx - 22},222 ${lx + 22},222 ${lx + 52},300 ${lx - 52},300`} fill="#fde68a" opacity="0.13" />
            )}
            <rect x={lx - 24} y="212" width="48" height="9" rx="3" fill={d.lamps.running ? '#fde68a' : '#3b4252'} stroke="rgba(255,255,255,0.25)" />
          </g>
        ))}
      </Part>

      {/* Ventilación */}
      <Part {...dev('fans')} badge={[362, 166]}>
        <circle cx="342" cy="186" r="22" fill="#1b1f27" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        <g className={d.fans.running ? 'spin' : ''}>
          {[0, 120, 240].map((a) => (
            <ellipse key={a} cx="342" cy="175" rx="5.5" ry="11" fill={d.fans.running ? '#93c5fd' : '#64748b'} transform={`rotate(${a} 342 186)`} />
          ))}
        </g>
        <circle cx="342" cy="186" r="3.5" fill="#cbd5e1" />
      </Part>

      {/* Tuberías: retorno (izquierda) y alimentación (derecha) */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M40 327 H22 V458 H30" stroke={pipe} strokeWidth="6" />
        <path d="M40 383 H22" stroke={pipe} strokeWidth="6" />
        <path d="M150 520 H197" stroke={pipe} strokeWidth="6" />
        <path d="M233 520 H366 V327 H320 M366 383 H320" stroke={pipe} strokeWidth="6" />
        <path d="M233 520 H366 V327 H320 M366 383 H320" className={flowClass} />
        <path d="M150 520 H197" className={flowClass} />
        <path d="M40 327 H22 V458 H30 M40 383 H22" className={wet > 0.05 && flowing ? 'flow flow-return' : 'flow flow-off'} />
      </g>

      {/* Camas de cultivo */}
      {beds.map((by) => (
        <g key={by} aria-hidden="true">
          <rect x="40" y={by} width="280" height="14" rx="7" fill="#2b3140" stroke="rgba(255,255,255,0.2)" />
          <rect x="44" y={by + 8} width="272" height="3.5" rx="1.75" fill={water} opacity={0.15 + 0.75 * wet} />
          {plantXs.map((px) => (
            <Plant key={px} x={px} y={by + 2} crop={zone.crop} health={zone.plants.health} wetness={wet} />
          ))}
        </g>
      ))}

      {/* Dosificadoras */}
      <Part {...dev('phDoser')} badge={[74, 396]}>
        <rect x="42" y="398" width="30" height="34" rx="5" fill="#3a2230" stroke="#f472b6" strokeWidth="1.5" />
        <rect x="52" y="392" width="10" height="7" rx="2" fill="#f472b6" />
        <text x="57" y="420" textAnchor="middle" className="svg-tag">pH−</text>
        <line x1="57" y1="432" x2="57" y2="442" stroke="#f472b6" strokeWidth="2" />
        {d.phDoser.running && <circle cx="57" cy="436" r="2.6" fill="#f472b6" className="drip" />}
      </Part>
      <Part {...dev('nutrientDoser')} badge={[120, 396]}>
        <rect x="88" y="398" width="30" height="34" rx="5" fill="#2b2440" stroke="#a78bfa" strokeWidth="1.5" />
        <rect x="98" y="392" width="10" height="7" rx="2" fill="#a78bfa" />
        <text x="103" y="420" textAnchor="middle" className="svg-tag">A+B</text>
        <line x1="103" y1="432" x2="103" y2="442" stroke="#a78bfa" strokeWidth="2" />
        {d.nutrientDoser.running && <circle cx="103" cy="436" r="2.6" fill="#a78bfa" className="drip" />}
      </Part>

      {/* Llenado */}
      <Part {...dev('refillValve')} badge={[164, 398]}>
        <rect x="124" y="396" width="52" height="46" fill="transparent" />
        <path d="M176 410 H138 V442" fill="none" stroke={pipe} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M176 410 H138 V442" fill="none" className={d.refillValve.running ? 'flow flow-supply' : 'flow flow-off'} />
        <path d="M148 402 L162 418 V402 L148 418 Z" fill={d.refillValve.running ? '#60a5fa' : '#475569'} stroke="rgba(255,255,255,0.4)" />
        <text x="180" y="414" className="svg-tag svg-left">agua</text>
      </Part>

      {/* Tanque */}
      <Part label={`Tanque de ${zone.name}: ${level.toFixed(0)} %`} selected={isSel('tank')} onClick={select('tank')}>
        <clipPath id={`tank-${zone.id}`}>
          <rect x="30" y="442" width="120" height="98" rx="8" />
        </clipPath>
        <rect x="30" y="442" width="120" height="98" rx="8" fill="#1b1f27" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        <g clipPath={`url(#tank-${zone.id})`}>
          <rect x="30" y={liquidY} width="120" height={liquidH + 4} fill={water} opacity="0.78" />
          <rect x="30" y={liquidY} width="120" height="3" fill="#fff" opacity="0.25" />
        </g>
        <rect x="30" y="442" width="120" height="98" rx="8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        <text x="90" y="488" textAnchor="middle" className="svg-big">{level.toFixed(0)} %</text>
        <text x="90" y="506" textAnchor="middle" className="svg-tag">
          pH {zone.tank.ph.toFixed(2)} · EC {zone.tank.ec.toFixed(2)}
        </text>
        <text x="90" y="521" textAnchor="middle" className="svg-tag">{zone.tank.tempC.toFixed(1)} °C</text>
        {zone.tank.leakLph > 0 && (
          <g>
            <ellipse cx="90" cy="552" rx="46" ry="5" fill={water} opacity="0.6" />
            <circle cx="72" cy="543" r="2.5" fill={water} className="drip" />
            <circle cx="104" cy="543" r="2.5" fill={water} className="drip drip-late" />
          </g>
        )}
      </Part>

      {/* Bomba de recirculación */}
      <Part {...dev('recirculationPump')} badge={[232, 502]}>
        <circle cx="215" cy="520" r="19" fill="#1b1f27" stroke={flowing ? 'var(--accent)' : 'rgba(255,255,255,0.35)'} strokeWidth="2" />
        <g className={flowing ? 'spin spin-fast' : ''}>
          <path d="M215 507 A13 13 0 0 1 228 520 L215 520 Z M215 533 A13 13 0 0 1 202 520 L215 520 Z" fill={flowing ? 'var(--accent)' : '#64748b'} />
        </g>
        <rect x="205" y="539" width="20" height="5" rx="2" fill="#475569" />
      </Part>

      {/* Nodo de sensores */}
      <Part label={`Nodo de sensores de ${zone.name}`} selected={isSel('node')} onClick={select('node')}>
        <rect x="262" y="444" width="84" height="46" rx="6" fill="#1b1f27" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        <line x1="334" y1="444" x2="334" y2="426" stroke="#94a3b8" strokeWidth="2" />
        <circle cx="334" cy="424" r="2.5" fill="#94a3b8" />
        {zone.node.online && network && zone.node.led === 'ok' && (
          <g fill="none" stroke="var(--status-green)" strokeWidth="1.5" className="pulse">
            <path d="M326 420 A9 9 0 0 1 342 420" />
            <path d="M321 415 A15 15 0 0 1 347 415" />
          </g>
        )}
        <circle cx="275" cy="458" r="5" fill={LED_COLOR[zone.node.led]} className={zone.node.led === 'off' ? '' : 'led'} />
        <text x="286" y="462" className="svg-tag svg-left">Nodo</text>
        <text x="270" y="480" className="svg-tag svg-dim svg-left">
          {!zone.node.online ? 'apagado' : zone.node.queue > 0 ? `cola ${zone.node.queue}` : 'en línea'}
        </text>
      </Part>

      {!power && (
        <g pointerEvents="none">
          <path d={`M0 150 Q${BAY_W / 2} 74 ${BAY_W} 150 V560 H0 Z`} fill="#05070b" opacity="0.42" />
          <text x={BAY_W / 2} y="268" textAnchor="middle" className="svg-warn">SIN ELECTRICIDAD</text>
        </g>
      )}
    </g>
  );
}

export function Scene({ snapshot, selection, onSelect }: SceneProps) {
  return (
    <svg
      className={`scene${snapshot.paused ? ' scene-paused' : ''}`}
      viewBox="0 0 1200 600"
      role="group"
      aria-label="Invernadero simulado"
      onClick={() => onSelect(null)}
    >
      <Sky snapshot={snapshot} />
      <text x="24" y="30" className="svg-sub svg-on-sky">
        Exterior {snapshot.env.outsideTemp.toFixed(1)} °C · {snapshot.env.outsideRh.toFixed(0)} % HR
        {snapshot.env.cloud > 0 ? ` · nubosidad ${Math.round(snapshot.env.cloud * 100)} %` : ''}
      </text>
      {snapshot.zones.slice(0, 3).map((zone, i) => (
        <Bay
          key={zone.id}
          zone={zone}
          x={BAY_X[i]}
          power={snapshot.power}
          network={snapshot.network}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </svg>
  );
}
