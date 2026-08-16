import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Thermometer, Droplets, FlaskConical, Sun, Power } from 'lucide-react';

const mockData = [
  { time: '08:00', temp: 20, humidity: 60, ph: 6.0 },
  { time: '10:00', temp: 22, humidity: 62, ph: 6.1 },
  { time: '12:00', temp: 24, humidity: 58, ph: 6.2 },
  { time: '14:00', temp: 25, humidity: 55, ph: 6.2 },
  { time: '16:00', temp: 23, humidity: 60, ph: 6.1 },
  { time: '18:00', temp: 21, humidity: 65, ph: 6.0 },
];

type SensorStatus = 'green' | 'yellow' | 'red' | 'offline';

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

function getStatus(value: number, min: number, max: number): SensorStatus {
  if (value < min || value > max) return 'red';
  const buffer = (max - min) * 0.1;
  if (value < min + buffer || value > max - buffer) return 'yellow';
  return 'green';
}

export default function Dashboard() {
  const [currentMetrics] = useState({
    temp: 22.5,
    humidity: 65,
    ph: 6.2,
    light: 'Óptimo',
    pumpStatus: 'Activa'
  });

  const tempStatus  = getStatus(currentMetrics.temp, 18, 28);
  const humidStatus = getStatus(currentMetrics.humidity, 50, 80);
  const phStatus    = getStatus(currentMetrics.ph, 5.5, 7.0);

  return (
    <div className="container animate-fade-in" style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-2xl)' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-sm)',
        marginBottom: 'var(--space-lg)',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
            Estado Actual
          </h2>
          <p style={{ margin: 0, marginTop: 'var(--space-xs)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Actualizado hace 3 s
          </p>
        </div>
        {/* Indicador de cultivo activo */}
        <div className="nm-flat" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          padding: '0 var(--space-sm)',
          minHeight: 40,
          borderRadius: 'var(--radius-sm)',
        }}>
          <SensorLED status="green" />
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            Planta: Lechuga
          </span>
        </div>
      </div>

      {/* ── Tarjetas de Métricas ──────────────────────── */}
      <div className="metrics-grid" style={{ marginBottom: 'var(--space-lg)' }}>

        {/* Temperatura */}
        <div className="nm-flat" style={{ padding: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Thermometer size={20} strokeWidth={1.5} color="var(--status-yellow)" />
            <SensorLED status={tempStatus} isCritical={tempStatus === 'red'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 'var(--space-xs)' }}>
            <span className="metric-value">{currentMetrics.temp}</span>
            <span className="metric-unit">°C</span>
          </div>
          <span className="metric-label">Temperatura</span>
        </div>

        {/* Humedad */}
        <div className="nm-flat" style={{ padding: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Droplets size={20} strokeWidth={1.5} color="var(--status-blue)" />
            <SensorLED status={humidStatus} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 'var(--space-xs)' }}>
            <span className="metric-value">{currentMetrics.humidity}</span>
            <span className="metric-unit">%</span>
          </div>
          <span className="metric-label">Humedad</span>
        </div>

        {/* pH */}
        <div className="nm-flat" style={{ padding: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <FlaskConical size={20} strokeWidth={1.5} color="var(--accent)" />
            <SensorLED status={phStatus} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 'var(--space-xs)' }}>
            <span className="metric-value">{currentMetrics.ph}</span>
            <span className="metric-unit">pH</span>
          </div>
          <span className="metric-label">pH del Agua</span>
        </div>

        {/* Luz */}
        <div className="nm-flat" style={{ padding: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Sun size={20} strokeWidth={1.5} color="#fbbf24" />
            <SensorLED status="green" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 'var(--space-xs)' }}>
            <span className="metric-value" style={{ fontSize: 'clamp(1.25rem, 4vw, 1.75rem)' }}>
              {currentMetrics.light}
            </span>
          </div>
          <span className="metric-label">Luminosidad</span>
        </div>

        {/* Bomba */}
        <div className="nm-flat" style={{ padding: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Power size={20} strokeWidth={1.5} color={currentMetrics.pumpStatus === 'Activa' ? 'var(--status-green)' : 'var(--status-offline)'} />
            <SensorLED status={currentMetrics.pumpStatus === 'Activa' ? 'green' : 'offline'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 'var(--space-xs)' }}>
            <span className="metric-value" style={{ fontSize: 'clamp(1.25rem, 4vw, 1.75rem)' }}>
              {currentMetrics.pumpStatus}
            </span>
          </div>
          <span className="metric-label">Bomba</span>
        </div>

      </div>

      {/* ── Gráfica Histórica ────────────────────────── */}
      <div className="nm-flat" style={{ padding: 'var(--space-md)' }}>
        <h3 style={{ margin: 0, marginBottom: 'var(--space-md)', fontSize: '1rem', fontWeight: 700 }}>
          Histórico — Temperatura y Humedad
        </h3>
        <div className="nm-concave" style={{ padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={mockData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" stroke="var(--text-disabled)" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left"  stroke="var(--status-yellow)" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--status-blue)" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)',
                  }}
                  itemStyle={{ color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                  labelStyle={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}
                />
                <Line yAxisId="left"  type="monotone" dataKey="temp"     stroke="var(--status-yellow)" strokeWidth={2} dot={{ r: 3, fill: 'var(--bg)' }} activeDot={{ r: 5 }} />
                <Line yAxisId="right" type="monotone" dataKey="humidity" stroke="var(--status-blue)"   strokeWidth={2} dot={{ r: 3, fill: 'var(--bg)' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
