import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Thermometer, Droplets, Sprout, RefreshCw, FlaskConical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTelemetrySource, USE_LOCAL_DEMO_DATA } from '../hooks/useTelemetrySource';
import type { TelemetryReading } from '../lib/localTelemetry';
import { THRESHOLDS, statusFor, type SensorStatus } from '../lib/sensorThresholds';
import TestDataPanel from '../components/TestDataPanel';

/**
 * Colores en HEX literal (no var(--...)) para todo lo que dibuje Recharts.
 * Recharts calcula el largo del trazo con getTotalLength() para animar la
 * línea, y en algunos navegadores eso corre antes de que el SVG resuelva
 * las custom properties de CSS, dejando la línea con longitud 0 (invisible
 * aunque los puntos sí se vean). Usar valores literales aquí evita ese
 * problema por completo — deben coincidir con las variables de index.css.
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

function SensorLED({ status, isCritical }: { status: SensorStatus; isCritical?: boolean }) {
  const ledClass = [
    'nm-led',
    `nm-led--${status}`,
    status === 'red' && isCritical ? 'nm-led--red-pulse' : '',
  ].filter(Boolean).join(' ');
  return (
    <span
      className={ledClass}
      role="status"
      aria-label={`Estado del sensor: ${status}`}
    />
  );
}

function timeAgo(date: Date | undefined): string {
  if (!date) return 'sin datos';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h`;
}

function formatChartTime(d: Date) {
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function EmptyState() {
  return (
    <div className="nm-concave animate-fade-in" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', padding: 'var(--space-2xl) var(--space-md)',
      borderRadius: 'var(--radius-lg)', gap: 'var(--space-sm)',
    }}>
      <div className="nm-flat" style={{
        width: 64, height: 64, borderRadius: 'var(--radius-full)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <RefreshCw size={26} strokeWidth={1.5} color="var(--text-disabled)" />
      </div>
      <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Todavía no hay lecturas</h3>
      <p style={{ margin: 0, maxWidth: 420, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        No hay sensores conectados aún. Mientras tanto, abre el panel{' '}
        <strong style={{ color: 'var(--text-primary)' }}>"Datos de Prueba"</strong> más abajo
        para generar o enviar lecturas de ejemplo y ver cómo se vería el Dashboard en vivo.
      </p>
    </div>
  );
}

function MetricCard({
  icon, label, value, unit, status, isCritical,
}: {
  icon: React.ReactNode; label: string; value: string; unit?: string;
  status: SensorStatus; isCritical?: boolean;
}) {
  return (
    <div className="nm-flat" style={{ padding: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
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
  const { readings, latestReading, loading } = useTelemetrySource(activeWorkspace?.id ?? null);

  const tempStatus  = latestReading ? statusFor(latestReading.temperature, THRESHOLDS.temperature) : 'offline';
  const humidStatus = latestReading ? statusFor(latestReading.humidity, THRESHOLDS.humidity) : 'offline';
  const soilStatus  = latestReading ? statusFor(latestReading.soilMoisture, THRESHOLDS.soilMoisture) : 'offline';

  // Mantiene la misma referencia mientras `readings` no cambie, para que
  // Recharts no reinicie la animación de dibujo en cada render.
  const chartData = useMemo(
    () =>
      readings.map((r: TelemetryReading) => ({
        time: formatChartTime(r.timestamp),
        temp: r.temperature,
        humidity: r.humidity,
        soilMoisture: r.soilMoisture,
      })),
    [readings]
  );

  return (
    <div className="container animate-fade-in" style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-2xl)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-sm)',
        marginBottom: 'var(--space-lg)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
              Estado Actual
            </h2>
            {USE_LOCAL_DEMO_DATA && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'rgba(16,185,129,0.1)', color: 'var(--accent)',
                border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 'var(--radius-full)', padding: '2px 10px',
                fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                <FlaskConical size={11} strokeWidth={1.5} /> Modo Demo (datos locales)
              </span>
            )}
          </div>
          <p style={{ margin: 0, marginTop: 'var(--space-xs)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {activeWorkspace ? `Actualizado ${timeAgo(latestReading?.timestamp)}` : 'Selecciona un invernadero'}
          </p>
        </div>
        {latestReading && (
          <div className="nm-flat" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
            padding: '0 var(--space-sm)',
            minHeight: 40,
            borderRadius: 'var(--radius-sm)',
          }}>
            <SensorLED status={tempStatus === 'red' || humidStatus === 'red' || soilStatus === 'red' ? 'red' : 'green'} />
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              {latestReading.sector} · {latestReading.nodeId}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-sm)', padding: 'var(--space-2xl) 0', color: 'var(--text-disabled)' }}>
          <div style={{ width: 20, height: 20, border: '2px solid var(--text-disabled)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <span>Cargando lecturas...</span>
        </div>
      ) : !latestReading ? (
        <EmptyState />
      ) : (
        <>
          <div className="metrics-grid" style={{ marginBottom: 'var(--space-lg)' }}>
            <MetricCard
              icon={<Thermometer size={20} strokeWidth={1.5} color="var(--status-yellow)" />}
              label="Temperatura"
              value={String(latestReading.temperature)}
              unit="°C"
              status={tempStatus}
              isCritical={tempStatus === 'red'}
            />
            <MetricCard
              icon={<Droplets size={20} strokeWidth={1.5} color="var(--status-blue)" />}
              label="Humedad Relativa"
              value={String(latestReading.humidity)}
              unit="%"
              status={humidStatus}
              isCritical={humidStatus === 'red'}
            />
            <MetricCard
              icon={<Sprout size={20} strokeWidth={1.5} color="var(--accent)" />}
              label="Humedad de Suelo"
              value={String(latestReading.soilMoisture)}
              unit="%"
              status={soilStatus}
              isCritical={soilStatus === 'red'}
            />
          </div>

          <div className="nm-flat" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <h3 style={{ margin: 0, marginBottom: 'var(--space-md)', fontSize: '1rem', fontWeight: 700 }}>
              Histórico — Temperatura y Humedad
            </h3>
            <div className="nm-concave" style={{ padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="time" stroke={CHART_COLORS.textDisabled} tick={{ fontSize: 11, fill: CHART_COLORS.textDisabled }} />
                    <YAxis yAxisId="left"  stroke={CHART_COLORS.yellow} tick={{ fontSize: 11, fill: CHART_COLORS.yellow }} />
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
                    <Line yAxisId="left"  type="monotone" dataKey="temp"     name="Temp. (°C)"  stroke={CHART_COLORS.yellow} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS.bg, stroke: CHART_COLORS.yellow, strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls />
                    <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humedad (%)" stroke={CHART_COLORS.blue}   strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS.bg, stroke: CHART_COLORS.blue,   strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="nm-flat" style={{ padding: 'var(--space-md)' }}>
            <h3 style={{ margin: 0, marginBottom: 'var(--space-md)', fontSize: '1rem', fontWeight: 700 }}>
              Histórico — Humedad de Suelo
            </h3>
            <div className="nm-concave" style={{ padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="time" stroke={CHART_COLORS.textDisabled} tick={{ fontSize: 11, fill: CHART_COLORS.textDisabled }} />
                    <YAxis stroke={CHART_COLORS.accent} tick={{ fontSize: 11, fill: CHART_COLORS.accent }} domain={[0, 100]} />
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
                    <Line type="monotone" dataKey="soilMoisture" name="Suelo (%)" stroke={CHART_COLORS.accent} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS.bg, stroke: CHART_COLORS.accent, strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      <TestDataPanel greenhouseId={activeWorkspace?.id ?? null} />
    </div>
  );
}
