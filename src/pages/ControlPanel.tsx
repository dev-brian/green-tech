import { useState } from 'react';
import { Settings2, Power, Droplet, Thermometer } from 'lucide-react';

export default function ControlPanel() {
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [pumpActive, setPumpActive] = useState(false);
  const [irrigationActive, setIrrigationActive] = useState(true);

  // Limits
  const [minTemp, setMinTemp] = useState(18);
  const [maxTemp, setMaxTemp] = useState(28);
  const [minHumidity, setMinHumidity] = useState(50);
  const [targetPh, setTargetPh] = useState(6.2);

  return (
    <div className="container animate-fade-in">
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <h2>Panel de Control</h2>
        <div className="flex items-center" style={{ gap: '1rem' }}>
          <span className="text-muted">Modo Manual</span>
          <label className="switch">
            <input type="checkbox" checked={isAutoMode} onChange={(e) => setIsAutoMode(e.target.checked)} />
            <span className="slider"></span>
          </label>
          <span className="text-green" style={{ fontWeight: isAutoMode ? 'bold' : 'normal' }}>Automático</span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {/* Manual Overrides */}
        <div className="glass-panel" style={{ opacity: isAutoMode ? 0.6 : 1, transition: 'opacity 0.3s' }}>
          <h3 className="flex items-center" style={{ gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Power className="text-amber" /> Controles Manuales
          </h3>
          
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            <div>
              <h4 style={{ margin: 0 }}>Bomba de Agua</h4>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>Estado: {pumpActive ? 'Encendida' : 'Apagada'}</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={pumpActive} disabled={isAutoMode} onChange={(e) => setPumpActive(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>

          <div className="flex justify-between items-center" style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            <div>
              <h4 style={{ margin: 0 }}>Sistema de Riego</h4>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>Estado: {irrigationActive ? 'Activo' : 'Inactivo'}</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={irrigationActive} disabled={isAutoMode} onChange={(e) => setIrrigationActive(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Configurations */}
        <div className="glass-panel">
          <h3 className="flex items-center" style={{ gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Settings2 className="text-blue" /> Límites del Sistema
          </h3>

          <div style={{ marginBottom: '1.5rem' }}>
            <div className="flex justify-between">
              <span>Temperatura Ideal (°C)</span>
              <span className="text-amber">{minTemp}° - {maxTemp}°</span>
            </div>
            <div className="flex" style={{ gap: '1rem', marginTop: '0.5rem' }}>
              <input type="range" min="10" max="25" value={minTemp} onChange={(e) => setMinTemp(parseInt(e.target.value))} />
              <input type="range" min="20" max="40" value={maxTemp} onChange={(e) => setMaxTemp(parseInt(e.target.value))} />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div className="flex justify-between">
              <span>Humedad Mínima (%)</span>
              <span className="text-blue">{minHumidity}%</span>
            </div>
            <input type="range" min="30" max="80" value={minHumidity} onChange={(e) => setMinHumidity(parseInt(e.target.value))} style={{ marginTop: '0.5rem' }} />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div className="flex justify-between">
              <span>Objetivo pH</span>
              <span className="text-green">{targetPh}</span>
            </div>
            <input type="range" min="5.0" max="8.0" step="0.1" value={targetPh} onChange={(e) => setTargetPh(parseFloat(e.target.value))} style={{ marginTop: '0.5rem' }} />
          </div>

          <button className="btn-primary" style={{ width: '100%' }}>Guardar Configuración</button>
        </div>
      </div>
    </div>
  );
}
