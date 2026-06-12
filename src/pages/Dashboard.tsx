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

export default function Dashboard() {
  const [currentMetrics] = useState({
    temp: 22.5,
    humidity: 65,
    ph: 6.2,
    light: 'Óptimo',
    pumpStatus: 'Activa'
  });

  return (
    <div className="container animate-fade-in">
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <h2>Dashboard - Estado Actual</h2>
        <div className="glass-panel" style={{ padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--accent-green)', boxShadow: '0 0 10px var(--accent-green)' }}></span>
          <span style={{ fontWeight: 600 }}>Planta: Lechuga</span>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '2rem' }}>
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
          <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{currentMetrics.light}</h3>
        </div>

        <div className="glass-panel text-center">
          <Power size={32} className={currentMetrics.pumpStatus === 'Activa' ? 'text-green' : 'text-red'} style={{ margin: '0 auto 0.5rem' }} />
          <p className="text-muted" style={{ marginBottom: '0.5rem' }}>Bomba</p>
          <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{currentMetrics.pumpStatus}</h3>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid" style={{ gridTemplateColumns: '1fr', gap: '2rem' }}>
        <div className="glass-panel">
          <h3 style={{ marginBottom: '1.5rem' }}>Histórico de Temperatura y Humedad</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={mockData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" />
                <YAxis yAxisId="left" stroke="var(--accent-amber)" />
                <YAxis yAxisId="right" orientation="right" stroke="var(--accent-blue)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line yAxisId="left" type="monotone" dataKey="temp" stroke="var(--accent-amber)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" dataKey="humidity" stroke="var(--accent-blue)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
