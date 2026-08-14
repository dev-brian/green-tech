import { useEffect, useState } from 'react';
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

export default function Dashboard() {
  const [currentMetrics, setCurrentMetrics] = useState({
  temp: 22.5,
  humidity: 65,
  ph: 6.2,
  light: 70,
  pumpStatus: 'Activa'
});

const [chartData, setChartData] = useState(mockData);
const [selectedMetric, setSelectedMetric] = useState('temp');

const tempOptimal = currentMetrics.temp >= 18 && currentMetrics.temp <= 28;
const humidityOptimal = currentMetrics.humidity >= 50 && currentMetrics.humidity <= 80;
const phOptimal = currentMetrics.ph >= 5.5 && currentMetrics.ph <= 7;

const allOptimal = tempOptimal && humidityOptimal && phOptimal;

const hasCritical =
  currentMetrics.temp < 15 ||
  currentMetrics.temp > 32 ||
  currentMetrics.humidity < 40 ||
  currentMetrics.humidity > 90 ||
  currentMetrics.ph < 5 ||
  currentMetrics.ph > 8;

const greenhouseStatus = hasCritical
  ? 'critical'
  : allOptimal
    ? 'optimal'
    : 'warning';

useEffect(() => {
  const interval = setInterval(() => {
    setCurrentMetrics((prev) => {
      const newTemp = Number(
        (prev.temp + (Math.random() - 0.5) * 0.6).toFixed(1)
      );

      const newHumidity = Math.round(
        prev.humidity + (Math.random() - 0.5) * 2
      );

      const newPh = Number(
        (prev.ph + (Math.random() - 0.5) * 0.2).toFixed(2)
      );

      const newLight = Math.round(
        prev.light + (Math.random() - 0.5) * 6);

      setChartData((previousData) => [
        ...previousData,
        {
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          temp: newTemp,
          humidity: newHumidity,
          ph: newPh,
        },
      ]);

      return {
        ...prev,
        temp: newTemp,
        humidity: newHumidity,
        ph: newPh,
        light: newLight,
      };
    });
  }, 3000);

  return () => clearInterval(interval);
}, []);

  return (
    <div className="container animate-fade-in">
      <div
  className="flex justify-between items-center flex-col-mobile"
  style={{ marginBottom: '2rem' }}
>
  <div>
    <h2 style={{ marginBottom: '0.5rem' }}>Estado actual</h2>

    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor:
          greenhouseStatus === 'optimal'
          ? 'var(--accent-green)'
          : greenhouseStatus === 'warning'
          ? 'var(--accent-amber)'
          : 'var(--accent-red)',

          boxShadow:
            greenhouseStatus === 'optimal'
            ? '0 0 10px var(--accent-green)'
            : greenhouseStatus === 'warning'
            ? '0 0 10px var(--accent-amber)'
            : '0 0 10px var(--accent-red)',
          }}
        />

          <span style={{ fontWeight: 600 }}>
            {greenhouseStatus === 'optimal'
            ? '🟢 Invernadero en condiciones óptimas'
            : greenhouseStatus === 'warning'
            ? '🟡 Invernadero requiere atención'
            : '🔴 Invernadero en estado crítico'}
          </span>
          </div>
        </div>

          <div
            className="glass-panel"
            style={{
              padding: '0.5rem 1rem',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
          <span style={{ fontWeight: 600 }}>🌱 Cultivo:</span>

            <select
              defaultValue="lechuga"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '0.4rem 0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >

                <option value="lechuga" style={{ backgroundColor: '#1f2937' }}>
                  Lechuga
                </option>

                <option value="jitomate" style={{ backgroundColor: '#1f2937' }}>
                  Jitomate
                </option>
            </select>
          </div>
        </div>

      {/* Metrics Cards */}
      <div className="grid grid-metrics" style={{ marginBottom: '2rem' }}>
        <div className="glass-panel text-center">
          <Thermometer size={32} className="text-amber" style={{ margin: '0 auto 0.5rem' }} />
          <p className="text-muted" style={{ marginBottom: '0.5rem' }}>Temperatura</p>
          <h3 style={{ fontSize: '2rem', margin: 0 }}>{currentMetrics.temp}°C</h3>
        </div>

        <div className="glass-panel text-center">
          <Droplets size={32} className="text-blue" style={{ margin: '0 auto 0.5rem' }} />
          <p className="text-muted" style={{ marginBottom: '0.5rem' }}>Humedad</p>
          <h3 style={{ fontSize: '2rem', margin: 0 }}>{currentMetrics.humidity}%</h3>
        </div>

        <div className="glass-panel text-center">
          <FlaskConical size={32} className="text-green" style={{ margin: '0 auto 0.5rem' }} />
          <p className="text-muted" style={{ marginBottom: '0.5rem' }}>pH del Agua</p>
          <h3 style={{ fontSize: '2rem', margin: 0 }}>{currentMetrics.ph}</h3>
        </div>

        <div className="glass-panel text-center">
          <Sun size={32} style={{ margin: '0 auto 0.5rem', color: '#fbbf24' }} />
          <p className="text-muted" style={{ marginBottom: '0.5rem' }}>Luz</p>
          <h3 style={{ fontSize: '1.5rem', margin: 0 }}>
            {currentMetrics.light >= 50 && currentMetrics.light <= 80
            ? 'Óptima'
            : currentMetrics.light > 80
            ? 'Exceso de luz'
            : 'Luz insuficiente'}
          </h3>
        </div>

        <div className="glass-panel text-center">
          <Power size={32} className={currentMetrics.pumpStatus === 'Activa' ? 'text-green' : 'text-red'} style={{ margin: '0 auto 0.5rem' }} />
          <p className="text-muted" style={{ marginBottom: '0.5rem' }}>Bomba</p>
          <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{currentMetrics.pumpStatus}</h3>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-charts">
        <div className="glass-panel">
          <div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  }}
>
  <h3 style={{ margin: 0 }}>Historial</h3>

  <select
    value={selectedMetric}
    onChange={(e) => setSelectedMetric(e.target.value)}
    style={{
      backgroundColor: 'rgba(0, 0, 0, 0.25)',
      color: '#fff',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '8px',
      padding: '0.4rem 0.7rem',
      fontWeight: 600,
      cursor: 'pointer',
      outline: 'none',
    }}
  >
    <option value="temp" style={{ backgroundColor: '#1f2937' }}>
      Temperatura
    </option>
    <option value="humidity" style={{ backgroundColor: '#1f2937' }}>
      Humedad
    </option>
    <option value="ph" style={{ backgroundColor: '#1f2937' }}>
      pH
    </option>
  </select>
</div>

<div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                <XAxis
  dataKey="time"
  stroke="var(--text-muted)"
/>

<YAxis
  stroke="var(--text-muted)"
  tickFormatter={(value) => {
    if (selectedMetric === 'temp') return `${value}°C`;
    if (selectedMetric === 'humidity') return `${value}%`;
    return value;
  }}
/>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke="#ffffff"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
