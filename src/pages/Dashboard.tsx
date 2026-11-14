import { useMemo, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Thermometer,
  Droplets,
  Sun,
  FlaskConical,
  Zap,
  Waves,
  Gauge,
  RefreshCw,
  CircleCheck,
  TriangleAlert,
  OctagonAlert,
  WifiOff,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTelemetrySource } from '../hooks/useTelemetrySource';
import { useThresholds } from '../hooks/useThresholds';
import { useAlerts } from '../hooks/useAlerts';
import type { TelemetryReading, ZoneLatestState } from '../hooks/useTelemetry';
import type { HydroponicVariable, SensorStatus } from '../lib/sensorThresholds';
import {
  VARIABLES,
  VARIABLE_ORDER,
  GROUP_LABEL,
  STATUS_WORD,
  STATUS_CLASS,
  adviceFor,
  formatValue,
  gaugeGeometry,
  idealText,
  type VariableGroup,
} from '../lib/plainLanguage';
import GreenhouseIllustration from '../components/GreenhouseIllustration';

/**
 * Inicio "sencillo primero" (SKILL.md):
 * 1. La frase: ¿está todo bien?
 * 2. Qué hacer ahora: una tarjeta por problema, en lenguaje de productor.
 * 3. Tus zonas y las lecturas de la zona elegida con medidores de rango.
 * Las gráficas quedan plegadas al final. El estado de cada variable lo
 * manda el backend; aquí solo se pinta.
 */

const STATUS_PRIORITY: Record<SensorStatus, number> = { red: 0, yellow: 1, offline: 2, green: 3 };

const ZONE_NAMES: Record<string, { name: string; crop: string }> = {
  'zona-1': { name: 'Zona 1', crop: 'Lechuga' },
  'zona-2': { name: 'Zona 2', crop: 'Jitomate' },
  'zona-3': { name: 'Zona 3', crop: 'Hierbas' },
};

function zoneName(zone: Pick<ZoneLatestState, 'zoneId' | 'crop'>) {
  const known = ZONE_NAMES[zone.zoneId];
  return {
    name: known?.name ?? zone.zoneId.replace(/^zona-/, 'Zona '),
    crop: zone.crop ?? known?.crop,
  };
}

const ICONS: Record<HydroponicVariable, typeof Thermometer> = {
  airTemp: Thermometer,
  humidity: Droplets,
  light: Sun,
  ph: FlaskConical,
  ec: Zap,
  solutionTemp: Waves,
  tankLevel: Gauge,
};

const STATUS_ICON: Record<SensorStatus, typeof CircleCheck> = {
  green: CircleCheck,
  yellow: TriangleAlert,
  red: OctagonAlert,
  offline: WifiOff,
};

interface Problem {
  zone: ZoneLatestState;
  variable: HydroponicVariable;
  status: 'red' | 'yellow';
}

function timeAgo(date: Date | undefined): string {
  if (!date) return 'sin datos';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `hace ${Math.max(0, seconds)} s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  return `a las ${date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function StatusChip({ status, label }: { status: SensorStatus; label?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`chip chip--${STATUS_CLASS[status]}`}>
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
      {label ?? STATUS_WORD[status]}
    </span>
  );
}

function RangeGauge({
  variable,
  value,
  status,
  thresholds,
  showEnds,
}: {
  variable: HydroponicVariable;
  value: number;
  status: SensorStatus;
  thresholds: ReturnType<typeof useThresholds>['thresholds'];
  showEnds?: boolean;
}) {
  const t = thresholds[variable];
  const g = gaugeGeometry(variable, value, t);
  const ends = VARIABLES[variable].ends;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        className="gauge"
        role="img"
        aria-label={`${formatValue(variable, value)}. ${idealText(variable, t)}.`}
      >
        <span className="gauge__band" style={{ left: `${g.bandLeft}%`, width: `${g.bandWidth}%` }} />
        <span className={`gauge__mark gauge__mark--${STATUS_CLASS[status]}`} style={{ left: `${g.mark}%` }} />
      </span>
      {showEnds && (
        <span className="metric-label" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }} aria-hidden="true">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </span>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="glass animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: 'var(--space-2xl) var(--space-md)',
        gap: 'var(--space-sm)',
      }}
    >
      <span className="icon-well icon-well--offline" style={{ width: 56, height: 56 }}>
        <RefreshCw size={24} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h2 style={{ fontSize: '1.25rem' }}>Todavía no llegan lecturas</h2>
      <p style={{ maxWidth: 460, fontSize: '0.9375rem' }}>
        En cuanto los sensores (o el simulador) manden datos, aquí verás si tu invernadero está en orden.
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { activeWorkspace, user } = useAuth();
  const greenhouseId = activeWorkspace?.id ?? null;
  const { readings, zonesById, loading } = useTelemetrySource(greenhouseId);
  const { thresholds } = useThresholds(greenhouseId);
  const { alerts, markAttended } = useAlerts(greenhouseId);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const readingsRef = useRef<HTMLElement>(null);

  const sortedZones: ZoneLatestState[] = useMemo(
    () =>
      Object.values(zonesById).sort((a, b) => {
        const diff = STATUS_PRIORITY[a.overallStatus] - STATUS_PRIORITY[b.overallStatus];
        return diff !== 0 ? diff : a.zoneId.localeCompare(b.zoneId);
      }),
    [zonesById],
  );

  // Las zonas en el orden físico (zona-1, zona-2…) para la ilustración.
  const physicalZones = useMemo(
    () => [...sortedZones].sort((a, b) => a.zoneId.localeCompare(b.zoneId)),
    [sortedZones],
  );

  const problems: Problem[] = useMemo(() => {
    const list: Problem[] = [];
    for (const zone of sortedZones) {
      if (zone.isStale) continue;
      for (const v of VARIABLE_ORDER) {
        const s = zone[v].status;
        if (s === 'red' || s === 'yellow') list.push({ zone, variable: v, status: s });
      }
    }
    return list.sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);
  }, [sortedZones]);

  const staleZones = sortedZones.filter((z) => z.isStale);
  const critCount = problems.filter((p) => p.status === 'red').length;
  const warnCount = problems.length - critCount;
  const totalReadings = sortedZones.filter((z) => !z.isStale).length * VARIABLE_ORDER.length;
  const okReadings = totalReadings - problems.length;
  const latest = sortedZones.reduce<Date | undefined>(
    (acc, z) => (!acc || z.timestamp > acc ? z.timestamp : acc),
    undefined,
  );

  const activeZone =
    (selectedZoneId && zonesById[selectedZoneId]) || sortedZones[0] || null;

  const chartData = useMemo(() => {
    const filtered = activeZone ? readings.filter((r: TelemetryReading) => r.zoneId === activeZone.zoneId) : readings;
    return (filtered.length > 0 ? filtered : readings).map((r: TelemetryReading) => ({
      time: r.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      airTemp: r.airTemp,
      humidity: r.humidity,
      ph: r.ph,
      ec: r.ec,
      tankLevel: r.tankLevel,
    }));
  }, [readings, activeZone]);

  const openZone = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    readingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const alertFor = (p: Problem) =>
    alerts.find((a) => a.status === 'new' && a.sector === p.zone.zoneId && a.variable === p.variable);

  // ── La frase ────────────────────────────────────────────────────────────
  let headline: string;
  let subline: string;
  const top = problems[0];
  if (top) {
    const n = problems.length;
    headline = n === 1 ? 'Hay 1 cosa por revisar' : `Hay ${n} cosas por revisar`;
    const advice = adviceFor(top.variable, top.zone[top.variable].value, thresholds[top.variable]);
    subline = `${n > 1 ? 'La más urgente: ' : ''}${advice.title.charAt(0).toLowerCase()}${advice.title.slice(1)} en la ${zoneName(top.zone).name}.`;
  } else if (staleZones.length > 0) {
    headline = 'No llegan datos de una zona';
    subline = `${staleZones.map((z) => zoneName(z).name).join(', ')}: última lectura ${timeAgo(staleZones[0].timestamp)}. Revisa la conexión del sensor.`;
  } else {
    headline = 'Todo en orden';
    subline = `${sortedZones.length === 1 ? 'La zona está' : `Las ${sortedZones.length} zonas están`} dentro de rango. Última lectura ${timeAgo(latest)}.`;
  }

  const firstName = user?.name?.split(' ')[0];
  const topValue = top ? top.zone[top.variable].value : 0;

  return (
    <div
      className="container animate-fade-in"
      style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-2xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
    >
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-sm)', padding: 'var(--space-2xl) 0', color: 'var(--text-secondary)' }}>
          <span style={{ width: 20, height: 20, border: '2px solid var(--track)', borderTopColor: 'var(--leaf)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <span>Cargando lecturas…</span>
        </div>
      ) : sortedZones.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* 1. La frase */}
          <section className="glass" aria-labelledby="estado-titulo" style={{ padding: 'clamp(20px, 4vw, 32px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-md)' }}>
            <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <span className="metric-label" style={{ fontSize: '0.9375rem' }}>
                {greeting()}{firstName ? `, ${firstName}` : ''}
              </span>
              <h1 id="estado-titulo" className="display">{headline}</h1>
              <p style={{ fontSize: '1.0625rem', maxWidth: 480 }}>{subline}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {critCount > 0 && <StatusChip status="red" label={critCount === 1 ? '1 crítica' : `${critCount} críticas`} />}
                {warnCount > 0 && <StatusChip status="yellow" label={warnCount === 1 ? '1 en atención' : `${warnCount} en atención`} />}
                {staleZones.length > 0 && <StatusChip status="offline" label={`${staleZones.length} sin datos`} />}
                {totalReadings > 0 && <StatusChip status="green" label={`${okReadings} de ${totalReadings} lecturas bien`} />}
              </div>
            </div>
            <div style={{ flex: '1 1 380px', minWidth: 0, maxWidth: 560, margin: '0 auto' }}>
              <GreenhouseIllustration
                zones={physicalZones.map((z) => ({ zoneId: z.zoneId, label: zoneName(z).name, status: z.overallStatus }))}
                callout={
                  top
                    ? {
                        zoneId: top.zone.zoneId,
                        title: `${zoneName(top.zone).name} · ${VARIABLES[top.variable].name}`,
                        value: `${VARIABLES[top.variable].technical ? `${VARIABLES[top.variable].technical} ` : ''}${formatValue(top.variable, topValue)}${VARIABLES[top.variable].unit && !VARIABLES[top.variable].technical ? ` ${VARIABLES[top.variable].unit}` : ''}`,
                        status: top.status,
                      }
                    : undefined
                }
              />
            </div>
          </section>

          {/* 2. Qué hacer ahora */}
          {problems.length > 0 && (
            <section aria-labelledby="hacer-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <h2 id="hacer-titulo" className="section-title">Qué hacer ahora</h2>
              <div className="grid-cards">
                {problems.slice(0, 4).map((p) => {
                  const info = VARIABLES[p.variable];
                  const t = thresholds[p.variable];
                  const value = p.zone[p.variable].value;
                  const advice = adviceFor(p.variable, value, t);
                  const Icon = ICONS[p.variable];
                  const alert = alertFor(p);
                  const z = zoneName(p.zone);
                  return (
                    <article key={`${p.zone.zoneId}-${p.variable}`} className="glass" style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <span className={`icon-well icon-well--${STATUS_CLASS[p.status]}`} style={{ width: 48, height: 48 }}>
                          <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
                        </span>
                        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <h3 style={{ fontSize: '1.1875rem' }}>{advice.title}</h3>
                          <span className="metric-label">
                            {z.name}{z.crop ? ` · ${z.crop}` : ''} · {timeAgo(p.zone.timestamp)}
                          </span>
                        </div>
                        <StatusChip status={p.status} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <span className="tnum" style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>
                            {formatValue(p.variable, value)}{' '}
                            <span className="metric-unit">{info.technical ?? info.unit}</span>
                          </span>
                          <span className="metric-label">{idealText(p.variable, t)}</span>
                        </div>
                        <RangeGauge variable={p.variable} value={value} status={p.status} thresholds={thresholds} showEnds />
                      </div>

                      <div className="well" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.9375rem', lineHeight: 1.5 }}>
                        <p style={{ margin: 0 }}><strong style={{ color: 'var(--text-primary)' }}>Qué significa.</strong> {advice.meaning}</p>
                        {advice.system && (
                          <p style={{ margin: 0 }}><strong style={{ color: 'var(--text-primary)' }}>Qué hace el sistema.</strong> {advice.system}</p>
                        )}
                        <p style={{ margin: 0 }}><strong style={{ color: 'var(--text-primary)' }}>Qué haces tú.</strong> {advice.action}</p>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {alert && (
                          <button type="button" className="btn-primary" onClick={() => markAttended(alert.id)}>
                            Ya lo revisé
                          </button>
                        )}
                        <button type="button" className="btn-secondary" onClick={() => openZone(p.zone.zoneId)}>
                          Ver la {z.name}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {problems.length > 4 && (
                <Link to="/alerts" style={{ minHeight: 48, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  Ver las {problems.length - 4} restantes en Alertas <ChevronRight size={16} aria-hidden="true" />
                </Link>
              )}
            </section>
          )}

          {/* 3. Tus zonas */}
          <section aria-labelledby="zonas-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <h2 id="zonas-titulo" className="section-title">Tus zonas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-sm)' }}>
              {sortedZones.map((zone) => {
                const z = zoneName(zone);
                const bad = VARIABLE_ORDER.filter((v) => zone[v].status === 'red' || zone[v].status === 'yellow');
                const okCount = zone.isStale ? 0 : VARIABLE_ORDER.length - bad.length;
                let sentence = 'Todo en orden.';
                if (zone.isStale) sentence = `No llegan datos desde ${timeAgo(zone.timestamp)}.`;
                else if (bad.length === 1) {
                  const a = adviceFor(bad[0], zone[bad[0]].value, thresholds[bad[0]]);
                  sentence = `${a.title}. Lo demás, bien.`;
                } else if (bad.length > 1) sentence = `${bad.length} lecturas por revisar.`;
                const selected = activeZone?.zoneId === zone.zoneId;
                return (
                  <button
                    key={zone.zoneId}
                    type="button"
                    className="glass"
                    onClick={() => openZone(zone.zoneId)}
                    aria-pressed={selected}
                    style={{
                      textAlign: 'left',
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      color: 'var(--text-primary)',
                      font: 'inherit',
                      cursor: 'pointer',
                      outline: selected ? '2px solid var(--ink-block)' : undefined,
                      outlineOffset: selected ? 2 : undefined,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
                      <span style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                        {z.name}
                        {z.crop && <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}> · {z.crop}</span>}
                      </span>
                      <StatusChip status={zone.overallStatus} />
                    </span>
                    <span style={{ fontSize: '0.9375rem' }}>{sentence}</span>
                    {!zone.isStale && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {VARIABLE_ORDER.map((v) => (
                          <span key={v} className={`dot dot--${STATUS_CLASS[zone[v].status]}`} aria-hidden="true" />
                        ))}
                        <span className="metric-label" style={{ marginLeft: 6 }}>{okCount} de 7 bien</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 4. Lecturas de la zona elegida */}
          {activeZone && (
            <section ref={readingsRef} aria-labelledby="lecturas-titulo" className="glass" style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 18, scrollMarginTop: 96 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <h2 id="lecturas-titulo" className="section-title">Lecturas de la {zoneName(activeZone).name}</h2>
                <span className="metric-label">
                  {activeZone.isStale ? `Sin datos recientes · última lectura ${timeAgo(activeZone.timestamp)}` : `Actualizado ${timeAgo(activeZone.timestamp)}`}
                </span>
              </div>
              {(['aire', 'agua'] as VariableGroup[]).map((group) => (
                <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 className="metric-label" style={{ fontSize: '0.875rem', fontWeight: 600 }}>{GROUP_LABEL[group]}</h3>
                  <div className="well" style={{ display: 'flex', flexDirection: 'column', borderRadius: 16 }}>
                    {VARIABLE_ORDER.filter((v) => VARIABLES[v].group === group).map((v, i) => {
                      const info = VARIABLES[v];
                      const { value, status } = activeZone[v];
                      const Icon = ICONS[v];
                      const sc = STATUS_CLASS[status];
                      const isProblem = status === 'red' || status === 'yellow';
                      return (
                        <div
                          key={v}
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 14,
                            padding: '14px 16px',
                            borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                            background: isProblem ? `var(--status-${sc}-soft)` : undefined,
                          }}
                        >
                          <span className={`icon-well icon-well--${sc}`}>
                            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                          </span>
                          <span style={{ flex: '1 1 180px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                              {info.name}
                              {info.technical && ` (${info.technical})`}
                              {status !== 'green' && <span style={{ color: `var(--status-${sc}-text)` }}> · {STATUS_WORD[status]}</span>}
                            </span>
                            <span className="metric-label">
                              {info.hint ? `${info.hint} · ` : ''}{idealText(v, thresholds[v])}
                            </span>
                          </span>
                          <span style={{ flex: '1 1 160px', minWidth: 120 }}>
                            <RangeGauge variable={v} value={value} status={status} thresholds={thresholds} />
                          </span>
                          <span
                            className="tnum"
                            style={{
                              minWidth: 96,
                              textAlign: 'right',
                              fontSize: '1.25rem',
                              fontWeight: isProblem ? 700 : 600,
                              color: status === 'offline' ? 'var(--status-offline-text)' : isProblem ? `var(--status-${sc}-text)` : undefined,
                            }}
                          >
                            {formatValue(v, value)}
                            {info.unit && <span className="metric-label"> {info.unit}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <span className="metric-label">La barra verde marca el rango ideal; el círculo es la lectura de ahora.</span>
            </section>
          )}

          {/* Gráficas: a un toque, no en primer plano */}
          {chartData.length > 0 && (
            <details className="glass" style={{ padding: 'var(--space-sm) var(--space-md)' }}>
              <summary style={{ minHeight: 48, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>
                Ver cómo han cambiado las lecturas
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingBottom: 'var(--space-sm)' }}>
                <TrendChart
                  title="Temperatura del aire y humedad"
                  data={chartData}
                  lines={[
                    { key: 'airTemp', name: 'Temperatura (°C)', color: 'var(--status-warn)', axis: 'left' },
                    { key: 'humidity', name: 'Humedad (%)', color: 'var(--status-blue)', axis: 'right' },
                  ]}
                />
                <TrendChart
                  title="pH, nutrientes (EC) y agua en el tanque"
                  data={chartData}
                  lines={[
                    { key: 'ph', name: 'pH', color: 'var(--leaf)', axis: 'left' },
                    { key: 'ec', name: 'EC (mS/cm)', color: 'var(--status-warn)', axis: 'left' },
                    { key: 'tankLevel', name: 'Tanque (%)', color: 'var(--status-blue)', axis: 'right' },
                  ]}
                />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function TrendChart({
  title,
  data,
  lines,
}: {
  title: string;
  data: Record<string, number | string>[];
  lines: { key: string; name: string; color: string; axis: 'left' | 'right' }[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ fontSize: '1rem' }}>{title}</h3>
      <div className="well" style={{ padding: 12, height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="time" stroke="var(--text-secondary)" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
            <YAxis yAxisId="left" stroke="var(--text-secondary)" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
            <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-strong)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                boxShadow: 'var(--shadow-card)',
              }}
              itemStyle={{ color: 'var(--text-primary)', fontSize: '0.8125rem' }}
              labelStyle={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}
            />
            {lines.map((l) => (
              <Line
                key={l.key}
                yAxisId={l.axis}
                type="monotone"
                dataKey={l.key}
                name={l.name}
                stroke={l.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
