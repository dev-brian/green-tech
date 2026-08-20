import { useState } from 'react';
import { Settings2, Power, ShieldAlert, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/* ── Fila de control manual (bomba / riego) ─────────────── */
function ControlRow({
  label,
  sublabel,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  sublabel: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="nm-concave"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-sm)',
        gap: 'var(--space-sm)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
          {label}
        </p>
        <p className="metric-timestamp" style={{ marginTop: 4 }}>{sublabel}</p>
      </div>
      <label className="switch" aria-label={label}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
        />
        <span className="slider" />
      </label>
    </div>
  );
}

/* ── Fila de slider de configuración ────────────────────── */
function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  color,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  color: string;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="metric-label">{label}</span>
        <span style={{ fontWeight: 700, fontSize: '0.875rem', color, fontVariantNumeric: 'tabular-nums' }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
        style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
    </div>
  );
}

export default function ControlPanel() {
  const { isAdmin } = useAuth();
  const [isAutoMode,       setIsAutoMode]       = useState(true);
  const [pumpActive,       setPumpActive]       = useState(false);
  const [irrigationActive, setIrrigationActive] = useState(true);
  const [minTemp,          setMinTemp]          = useState(18);
  const [maxTemp,          setMaxTemp]          = useState(28);
  const [minHumidity,      setMinHumidity]      = useState(50);
  const [targetPh,         setTargetPh]         = useState(6.2);

  return (
    <div
      className="container animate-fade-in"
      style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-2xl)' }}
    >
      {/* ── Header ──────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-sm)',
        marginBottom: 'var(--space-lg)',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}>Panel de Control</h2>
          <p style={{ margin: 0, marginTop: 'var(--space-xs)', fontSize: '0.875rem' }}>
            Monitoreo y configuración en tiempo real.
          </p>
        </div>

        {/* Toggle Manual / Automático */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span className="metric-label">Manual</span>
          <label className="switch" aria-label="Modo de operación">
            <input
              type="checkbox"
              checked={isAutoMode}
              onChange={e => setIsAutoMode(e.target.checked)}
            />
            <span className="slider" />
          </label>
          <span style={{
            fontWeight: 700,
            fontSize: '0.875rem',
            color: isAutoMode ? 'var(--accent)' : 'var(--text-disabled)',
            transition: 'color 0.3s',
          }}>
            Automático
          </span>
        </div>
      </div>

      {/* ── Grid de paneles ─────────────────────────── */}
      <div className="grid-cards">

        {/* Panel de Controles Manuales */}
        <div
          className="nm-flat"
          style={{
            padding: 'var(--space-md)',
            opacity: isAutoMode ? 0.55 : 1,
            transition: 'opacity 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
            <Power size={20} strokeWidth={1.5} color="var(--status-yellow)" />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Controles Manuales</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <ControlRow
              label="Bomba de Agua"
              sublabel={`Estado: ${pumpActive ? 'Encendida' : 'Apagada'}`}
              checked={pumpActive}
              disabled={isAutoMode}
              onChange={setPumpActive}
            />
            <ControlRow
              label="Sistema de Riego"
              sublabel={`Estado: ${irrigationActive ? 'Activo' : 'Inactivo'}`}
              checked={irrigationActive}
              disabled={isAutoMode}
              onChange={setIrrigationActive}
            />
          </div>

          {isAutoMode && (
            <p style={{
              margin: 0,
              marginTop: 'var(--space-sm)',
              fontSize: '0.75rem',
              color: 'var(--text-disabled)',
              textAlign: 'center',
            }}>
              Desactiva el modo automático para habilitar los controles manuales.
            </p>
          )}
        </div>

        {/* Panel de Límites del Sistema */}
        <div className="nm-flat" style={{ padding: 'var(--space-md)' }}>

          {/* Encabezado del panel */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-md)',
            flexWrap: 'wrap',
            gap: 'var(--space-xs)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <Settings2 size={20} strokeWidth={1.5} color="var(--status-blue)" />
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Límites del Sistema</h3>
            </div>
            {!isAdmin && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'rgba(245,158,11,0.1)',
                color: 'var(--status-yellow)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 'var(--radius-full)',
                padding: '2px 10px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}>
                <Lock size={10} strokeWidth={1.5} /> SOLO LECTURA
              </span>
            )}
          </div>

          {/* Banner de acceso restringido */}
          {!isAdmin && (
            <div className="nm-concave" style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-xs)',
              padding: 'var(--space-sm)',
              marginBottom: 'var(--space-md)',
              borderLeft: '3px solid var(--status-yellow)',
            }}>
              <ShieldAlert size={18} strokeWidth={1.5} color="var(--status-yellow)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8125rem', color: 'var(--status-yellow)' }}>
                  Acceso Restringido
                </p>
                <p style={{ margin: 0, marginTop: 4, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Tu rol de <strong style={{ color: 'var(--text-primary)' }}>Operador</strong> no puede modificar los límites del sistema.
                </p>
              </div>
            </div>
          )}

          {/* Sliders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <SliderRow
              label="Temperatura Mínima"
              value={minTemp} min={10} max={25}
              unit="°C" color="var(--status-yellow)"
              disabled={!isAdmin}
              onChange={v => { if (v <= maxTemp) setMinTemp(v); }}
            />
            <SliderRow
              label="Temperatura Máxima"
              value={maxTemp} min={20} max={40}
              unit="°C" color="var(--status-red)"
              disabled={!isAdmin}
              onChange={v => { if (v >= minTemp) setMaxTemp(v); }}
            />
            <SliderRow
              label="Humedad Mínima"
              value={minHumidity} min={30} max={80}
              unit="%" color="var(--status-blue)"
              disabled={!isAdmin}
              onChange={setMinHumidity}
            />
            <SliderRow
              label="Objetivo pH"
              value={targetPh} min={5.0} max={8.0} step={0.1}
              unit="" color="var(--accent)"
              disabled={!isAdmin}
              onChange={setTargetPh}
            />
          </div>

          {/* Botón guardar */}
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <button
              className="btn-primary"
              disabled={!isAdmin}
              aria-disabled={!isAdmin}
              style={{ width: '100%' }}
            >
              {isAdmin ? 'Guardar Configuración' : 'Configuración Bloqueada'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
