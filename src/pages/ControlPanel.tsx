import { useState } from 'react';
import { Settings2, Power, ShieldAlert, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ControlPanel() {
  const { isAdmin } = useAuth();
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [pumpActive, setPumpActive] = useState(false);
  const [irrigationActive, setIrrigationActive] = useState(true);

  // Limits
  const [minTemp, setMinTemp] = useState(18);
  const [maxTemp, setMaxTemp] = useState(28);
  const [minHumidity, setMinHumidity] = useState(50);
  const [targetPh, setTargetPh] = useState(6.2);

  return (
    <div className="container animate-fade-in py-6">
      <div className="flex justify-between items-center flex-col-mobile" style={{ marginBottom: '2rem' }}>
        <div>
          <h2>Panel de Control</h2>
          <p className="text-muted" style={{ margin: 0 }}>Monitoreo y configuración de parámetros en tiempo real.</p>
        </div>
        <div className="flex items-center" style={{ gap: '1rem' }}>
          <span className="text-muted">Modo Manual</span>
          <label className="switch">
            <input type="checkbox" checked={isAutoMode} onChange={(e) => setIsAutoMode(e.target.checked)} />
            <span className="slider"></span>
          </label>
          <span className="text-green" style={{ fontWeight: isAutoMode ? 'bold' : 'normal' }}>Automático</span>
        </div>
      </div>

      <div className="grid grid-cards" style={{ gap: '2rem' }}>
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

        {/* Configurations / Sliders */}
        <div className="glass-panel" style={{ opacity: isAdmin ? 1 : 0.85 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
            <h3 className="flex items-center" style={{ gap: '0.5rem', margin: 0 }}>
              <Settings2 className="text-blue" /> Límites del Sistema
            </h3>
            {!isAdmin && (
              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-1 rounded-full font-medium">
                <Lock size={12} /> Solo Lectura (Operador)
              </span>
            )}
          </div>

          {!isAdmin && (
            <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-2.5">
              <ShieldAlert size={18} className="flex-shrink-0 text-amber-400 mt-0.5" />
              <div>
                <strong className="font-semibold block text-amber-200">Acceso Restringido</strong>
                Tu rol actual de <strong>Operador</strong> no tiene permisos para modificar los límites del sistema. Los sliders se encuentran bloqueados.
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <div className="flex justify-between">
              <span>Temperatura Ideal (°C)</span>
              <span className="text-amber">{minTemp}° - {maxTemp}°</span>
            </div>
            <div className="flex" style={{ gap: '1rem', marginTop: '0.5rem' }}>
              <input
                type="range"
                min="10"
                max="25"
                value={minTemp}
                disabled={!isAdmin}
                onChange={(e) => setMinTemp(parseInt(e.target.value))}
                style={{ opacity: isAdmin ? 1 : 0.5, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
              />
              <input
                type="range"
                min="20"
                max="40"
                value={maxTemp}
                disabled={!isAdmin}
                onChange={(e) => setMaxTemp(parseInt(e.target.value))}
                style={{ opacity: isAdmin ? 1 : 0.5, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div className="flex justify-between">
              <span>Humedad Mínima (%)</span>
              <span className="text-blue">{minHumidity}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="80"
              value={minHumidity}
              disabled={!isAdmin}
              onChange={(e) => setMinHumidity(parseInt(e.target.value))}
              style={{ marginTop: '0.5rem', opacity: isAdmin ? 1 : 0.5, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div className="flex justify-between">
              <span>Objetivo pH</span>
              <span className="text-green">{targetPh}</span>
            </div>
            <input
              type="range"
              min="5.0"
              max="8.0"
              step="0.1"
              value={targetPh}
              disabled={!isAdmin}
              onChange={(e) => setTargetPh(parseFloat(e.target.value))}
              style={{ marginTop: '0.5rem', opacity: isAdmin ? 1 : 0.5, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
            />
          </div>

          <button
            className="btn-primary"
            disabled={!isAdmin}
            style={{
              width: '100%',
              opacity: isAdmin ? 1 : 0.5,
              cursor: isAdmin ? 'pointer' : 'not-allowed'
            }}
          >
            {isAdmin ? 'Guardar Configuración' : 'Configuración Bloqueada para Operadores'}
          </button>
        </div>
      </div>
    </div>
  );
}
