import { useMemo, useState } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTelemetrySource } from '../hooks/useTelemetrySource';
import type { TelemetryReading, ZoneLatestState } from '../hooks/useTelemetry';
import type { SensorStatus } from '../lib/sensorThresholds';

/**
 * Colores en HEX literal para Recharts (coinciden con las variables de index.css).
 */
const CHART_COLORS = {
  bg: '#1e222b',
  textSecondary: '#94a3b8',
  textDisabled: '#4a5568',
  shadowDark: '#15181f',
  shadowLight: '#272d3a',
  accent: '#10b981',
  yellow: '#f59e0b',
  blue: '#3b82f6',
};

const STATUS_PRIORITY: Record<SensorStatus, number> = {
  red: 0,
  yellow: 1,
  green: 2,
  offline: 3,
};

const ZONE_LABELS: Record<string, string> = {
  'zona-1': 'Zona 1 · Lechuga NFT',
  'zona-2': 'Zona 2 · Jitomate DWC',
  'zona-3': 'Zona 3 · Hierbas Aromáticas',
};

function formatZoneLabel(zoneId: string, crop?: string): string {
  if (ZONE_LABELS[zoneId]) return ZONE_LABELS[zoneId];
  if (crop) return `${zoneId} · ${crop}`;
  return zoneId;
}

function SensorLED({ status, isCritical }: { status: SensorStatus; isCritical?: boolean }) {
  const ledClass = [
    'nm-led',
    `nm-led--${status}`,
    status === 'red' && isCritical ? 'nm-led--red-pulse' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span
      className={ledClass}
      role="status"
      aria-label={`Estado del sensor: ${status}`}
    />
  );
}

function timeAgo(date: Date | undefined, isStale?: boolean): string {
  if (!date) return 'sin datos';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const base =
    seconds < 60
      ? `hace ${Math.max(0, seconds)}s`
      : seconds < 3600
        ? `hace ${Math.floor(seconds / 60)} min`
        : `hace ${Math.floor(seconds / 3600)} h`;
  return isStale ? `sin datos recientes (${base})` : `Actualizado ${base}`;
}

function formatChartTime(d: Date) {
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function EmptyState() {
  return (
    <div
      className="nm-concave animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: 'var(--space-2xl) var(--space-md)',
        borderRadius: 'var(--radius-lg)',
        gap: 'var(--space-sm)',
      }}
    >
      <div
        className="nm-flat"
        style={{
          width: 64,
          height: 64,
          borderRadius: 'var(--radius-full)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <RefreshCw size={26} strokeWidth={1.5} color="var(--text-disabled)" />
      </div>
      <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Todavía no hay lecturas</h3>
      <p
        style={{
          margin: 0,
          maxWidth: 460,
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        Esperando telemetría hidropónica en{' '}
        <strong style={{ color: 'var(--text-primary)' }}>
          greenhouses/&#123;id&#125;/state/latest
        </strong>
        . Ejecuta el simulador con{' '}
        <code style={{ color: 'var(--accent)' }}>pnpm sim:firestore --ticks=6</code> para
        enviar las 7 variables por zona en tiempo real.
      </p>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  status,
  isCritical,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  status: SensorStatus;
  isCritical?: boolean;
}) {
  return (
    <div
      className="nm-flat"
      style={{
        padding: 'var(--space-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-xs)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {icon}
        <SensorLED status={status} isCritical={isCritical} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 'var(--space-xs)' }}>
        <span className="metric-value">{value}</span>
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      <span className="metric-label">{label}</span>
    </div>
  );
}

export default function Dashboard() {
  const { activeWorkspace } = useAuth();
  const { readings, zonesById, loading } = useTelemetrySource(activeWorkspace?.id ?? null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Ordenar las zonas con peor estado primero (T4.1 / T4.2)
  const sortedZones: ZoneLatestState[] = useMemo(() => {
    return Object.values(zonesById).sort((a, b) => {
      const diff = STATUS_PRIORITY[a.overallStatus] - STATUS_PRIORITY[b.overallStatus];
      if (diff !== 0) return diff;
      return a.zoneId.localeCompare(b.zoneId);
    });
  }, [zonesById]);

  const activeZone: ZoneLatestState | null = useMemo(() => {
    if (sortedZones.length === 0) return null;
    if (selectedZoneId && zonesById[selectedZoneId]) {
      return zonesById[selectedZoneId];
    }
    return sortedZones[0];
  }, [sortedZones, selectedZoneId, zonesById]);

  // Filtrar lecturas históricas de la zona activa
  const chartData = useMemo(() => {
    const filtered = activeZone
      ? readings.filter((r: TelemetryReading) => r.zoneId === activeZone.zoneId)
      : readings;
    const source = filtered.length > 0 ? filtered : readings;

    return source.map((r: TelemetryReading) => ({
      time: formatChartTime(r.timestamp),
      airTemp: r.airTemp,
      humidity: r.humidity,
      ph: r.ph,
      ec: r.ec,
      tankLevel: r.tankLevel,
    }));
  }, [readings, activeZone]);

  return (
    <div
      className="container animate-fade-in"
      style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-2xl)' }}
    >
      {/* Encabezado y estado de la zona activa */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-md)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
            Estado Actual Hidropónico
          </h2>
          <p
            style={{
              margin: 0,
              marginTop: 'var(--space-xs)',
              color: activeZone?.isStale ? 'var(--status-yellow)' : 'var(--text-secondary)',
              fontSize: '0.875rem',
            }}
          >
            {activeWorkspace
              ? timeAgo(activeZone?.timestamp, activeZone?.isStale)
              : 'Selecciona un invernadero'}
          </p>
        </div>

        {activeZone && (
          <div
            className="nm-flat"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-xs)',
              padding: '0 var(--space-sm)',
              minHeight: 48,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <SensorLED
              status={activeZone.overallStatus}
              isCritical={activeZone.overallStatus === 'red'}
            />
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              {formatZoneLabel(activeZone.zoneId, activeZone.crop)}
            </span>
          </div>
        )}
      </div>

      {/* Selector de zonas (peor estado primero) */}
      {sortedZones.length > 1 && (
        <div
          role="tablist"
          aria-label="Zonas del invernadero"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-xs)',
            marginBottom: 'var(--space-lg)',
          }}
        >
          {sortedZones.map((zone) => {
            const isSelected = activeZone?.zoneId === zone.zoneId;
            return (
              <button
                key={zone.zoneId}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedZoneId(zone.zoneId)}
                className={isSelected ? 'nm-concave' : 'nm-flat'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-xs)',
                  padding: '0 var(--space-sm)',
                  minHeight: 48,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 700 : 600,
                  fontSize: '0.875rem',
                }}
              >
                <SensorLED
                  status={zone.overallStatus}
                  isCritical={zone.overallStatus === 'red'}
                />
                <span>{formatZoneLabel(zone.zoneId, zone.crop)}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-sm)',
            padding: 'var(--space-2xl) 0',
            color: 'var(--text-disabled)',
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              border: '2px solid var(--text-disabled)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }}
          />
          <span>Cargando lecturas...</span>
        </div>
      ) : !activeZone ? (
        <EmptyState />
      ) : (
        <>
          {/* Sección 1: Ambiente (3 variables) */}
          <h3
            style={{
              margin: 0,
              marginBottom: 'var(--space-xs)',
              fontSize: '0.9375rem',
              color: 'var(--text-secondary)',
              fontWeight: 700,
            }}
          >
            Ambiente
          </h3>
          <div className="metrics-grid" style={{ marginBottom: 'var(--space-lg)' }}>
            <MetricCard
              icon={<Thermometer size={20} strokeWidth={1.5} color="var(--status-yellow)" />}
              label="Temperatura del Aire"
              value={String(activeZone.airTemp.value)}
              unit="°C"
              status={activeZone.airTemp.status}
              isCritical={activeZone.airTemp.status === 'red'}
            />
            <MetricCard
              icon={<Droplets size={20} strokeWidth={1.5} color="var(--status-blue)" />}
              label="Humedad Relativa"
              value={String(activeZone.humidity.value)}
              unit="%"
              status={activeZone.humidity.status}
              isCritical={activeZone.humidity.status === 'red'}
            />
            <MetricCard
              icon={<Sun size={20} strokeWidth={1.5} color="var(--status-yellow)" />}
              label="Luz Ambiental"
              value={activeZone.light.value.toLocaleString('es-MX')}
              unit="lux"
              status={activeZone.light.status}
              isCritical={activeZone.light.status === 'red'}
            />
          </div>

          {/* Sección 2: Solución Nutritiva (4 variables) */}
          <h3
            style={{
              margin: 0,
              marginBottom: 'var(--space-xs)',
              fontSize: '0.9375rem',
              color: 'var(--text-secondary)',
              fontWeight: 700,
            }}
          >
            Solución Nutritiva
          </h3>
          <div className="metrics-grid" style={{ marginBottom: 'var(--space-lg)' }}>
            <MetricCard
              icon={<FlaskConical size={20} strokeWidth={1.5} color="var(--accent)" />}
              label="pH de la Solución"
              value={activeZone.ph.value.toFixed(2)}
              unit="pH"
              status={activeZone.ph.status}
              isCritical={activeZone.ph.status === 'red'}
            />
            <MetricCard
              icon={<Zap size={20} strokeWidth={1.5} color="var(--status-yellow)" />}
              label="Conductividad (EC)"
              value={activeZone.ec.value.toFixed(2)}
              unit="mS/cm"
              status={activeZone.ec.status}
              isCritical={activeZone.ec.status === 'red'}
            />
            <MetricCard
              icon={<Thermometer size={20} strokeWidth={1.5} color="var(--status-blue)" />}
              label="Temp. de la Solución"
              value={String(activeZone.solutionTemp.value)}
              unit="°C"
              status={activeZone.solutionTemp.status}
              isCritical={activeZone.solutionTemp.status === 'red'}
            />
            <MetricCard
              icon={<Waves size={20} strokeWidth={1.5} color="var(--accent)" />}
              label="Nivel del Tanque"
              value={String(activeZone.tankLevel.value)}
              unit="%"
              status={activeZone.tankLevel.status}
              isCritical={activeZone.tankLevel.status === 'red'}
            />
          </div>

          {/* Gráfica 1: Ambiente */}
          <div className="nm-flat" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <h3 style={{ margin: 0, marginBottom: 'var(--space-md)', fontSize: '1rem', fontWeight: 700 }}>
              Histórico — Temperatura del Aire y Humedad
            </h3>
            <div className="nm-concave" style={{ padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="time" stroke={CHART_COLORS.textDisabled} tick={{ fontSize: 11, fill: CHART_COLORS.textDisabled }} />
                    <YAxis yAxisId="left" stroke={CHART_COLORS.yellow} tick={{ fontSize: 11, fill: CHART_COLORS.yellow }} />
                    <YAxis yAxisId="right" orientation="right" stroke={CHART_COLORS.blue} tick={{ fontSize: 11, fill: CHART_COLORS.blue }} />
                    <Tooltip
                      contentStyle={{
                        background: CHART_COLORS.bg,
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        boxShadow: `4px 4px 8px ${CHART_COLORS.shadowDark}, -4px -4px 8px ${CHART_COLORS.shadowLight}`,
                      }}
                      itemStyle={{ color: '#f1f5f9', fontSize: '0.8125rem' }}
                      labelStyle={{ color: CHART_COLORS.textSecondary, fontSize: '0.75rem' }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="airTemp" name="Temp. Aire (°C)" stroke={CHART_COLORS.yellow} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS.bg, stroke: CHART_COLORS.yellow, strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls />
                    <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humedad (%)" stroke={CHART_COLORS.blue} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS.bg, stroke: CHART_COLORS.blue, strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Gráfica 2: Solución Nutritiva */}
          <div className="nm-flat" style={{ padding: 'var(--space-md)' }}>
            <h3 style={{ margin: 0, marginBottom: 'var(--space-md)', fontSize: '1rem', fontWeight: 700 }}>
              Histórico — Solución Nutritiva (pH, EC y Nivel del Tanque)
            </h3>
            <div className="nm-concave" style={{ padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="time" stroke={CHART_COLORS.textDisabled} tick={{ fontSize: 11, fill: CHART_COLORS.textDisabled }} />
                    <YAxis yAxisId="left" stroke={CHART_COLORS.accent} tick={{ fontSize: 11, fill: CHART_COLORS.accent }} domain={[0, 10]} />
                    <YAxis yAxisId="right" orientation="right" stroke={CHART_COLORS.blue} tick={{ fontSize: 11, fill: CHART_COLORS.blue }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        background: CHART_COLORS.bg,
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        boxShadow: `4px 4px 8px ${CHART_COLORS.shadowDark}, -4px -4px 8px ${CHART_COLORS.shadowLight}`,
                      }}
                      itemStyle={{ color: '#f1f5f9', fontSize: '0.8125rem' }}
                      labelStyle={{ color: CHART_COLORS.textSecondary, fontSize: '0.75rem' }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="ph" name="pH" stroke={CHART_COLORS.accent} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS.bg, stroke: CHART_COLORS.accent, strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls />
                    <Line yAxisId="left" type="monotone" dataKey="ec" name="EC (mS/cm)" stroke={CHART_COLORS.yellow} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS.bg, stroke: CHART_COLORS.yellow, strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls />
                    <Line yAxisId="right" type="monotone" dataKey="tankLevel" name="Tanque (%)" stroke={CHART_COLORS.blue} strokeWidth={2} dot={{ r: 2, fill: CHART_COLORS.bg, stroke: CHART_COLORS.blue, strokeWidth: 2 }} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
