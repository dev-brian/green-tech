import { useState, useCallback } from 'react';
import {
  Bell, BellOff, Thermometer, Droplets, Sprout,
  CheckCircle2, Clock, AlertTriangle, ChevronDown,
  ChevronUp, RotateCcw, Save, Filter, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAlerts, type FirestoreAlert, type AlertFilters } from '../hooks/useAlerts';
import { useThresholds, type GreenhouseThresholds } from '../hooks/useThresholds';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

const VARIABLE_LABELS: Record<string, string> = {
  temperature: 'Temperatura',
  humidity: 'Humedad Relativa',
  soilMoisture: 'Humedad de Suelo',
};

const VARIABLE_UNITS: Record<string, string> = {
  temperature: '°C',
  humidity: '%',
  soilMoisture: '%',
};

function VariableIcon({ variable, color }: { variable: string; color: string }) {
  const props = { size: 18, strokeWidth: 1.5, color };
  if (variable === 'temperature') return <Thermometer {...props} />;
  if (variable === 'humidity')    return <Droplets    {...props} />;
  return                                  <Sprout     {...props} />;
}

// ─── Componente: ítem de alerta ───────────────────────────────────────────────

function AlertItem({
  alert,
  onMarkAttended,
}: {
  alert: FirestoreAlert;
  onMarkAttended: (id: string) => void;
}) {
  const severityColor = alert.severity === 'red'
    ? 'var(--status-red)'
    : 'var(--status-yellow)';

  const statusConfig = {
    new:           { label: 'Nueva',     bg: 'rgba(239,68,68,0.12)',   text: 'var(--status-red)'    },
    attended:      { label: 'Atendida',  bg: 'rgba(16,185,129,0.12)',  text: 'var(--status-green)'  },
    auto_resolved: { label: 'Resuelta',  bg: 'rgba(148,163,184,0.12)', text: 'var(--text-secondary)' },
  }[alert.status];

  return (
    <div
      className="nm-flat animate-fade-in"
      style={{
        padding: 'var(--space-sm)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        gap: 'var(--space-sm)',
        alignItems: 'flex-start',
        borderLeft: `3px solid ${severityColor}`,
      }}
    >
      {/* Ícono + LED */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xs)', paddingTop: 2, flexShrink: 0 }}>
        <VariableIcon variable={alert.variable} color={severityColor} />
        <span
          className={`nm-led nm-led--${alert.severity === 'red' ? 'red' : 'yellow'}${alert.severity === 'red' && alert.status === 'new' ? ' nm-led--red-pulse' : ''}`}
          role="status"
          aria-label={alert.severity === 'red' ? 'Crítico' : 'Precaución'}
        />
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-xs)', marginBottom: 4 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            {alert.message}
          </p>
          {/* Badge de estado */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: statusConfig.bg,
            color: statusConfig.text,
            borderRadius: 'var(--radius-full)',
            padding: '2px 8px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}>
            {alert.status === 'new' && <AlertTriangle size={9} strokeWidth={2} />}
            {alert.status === 'attended' && <CheckCircle2 size={9} strokeWidth={2} />}
            {alert.status === 'auto_resolved' && <CheckCircle2 size={9} strokeWidth={2} />}
            {statusConfig.label}
          </span>
        </div>

        {/* Meta-info */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} strokeWidth={1.5} />
            {relativeTime(alert.createdAt)}
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {alert.sector}
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {VARIABLE_LABELS[alert.variable]}: <strong style={{ color: severityColor }}>{alert.value}{VARIABLE_UNITS[alert.variable]}</strong>
          </span>
        </div>

        {/* Acción "Marcar como atendida" */}
        {alert.status === 'new' && (
          <button
            onClick={() => onMarkAttended(alert.id)}
            style={{
              marginTop: 'var(--space-xs)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
              color: 'var(--accent)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 36,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.16)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)'; }}
          >
            <CheckCircle2 size={14} strokeWidth={1.5} />
            Marcar como atendida
          </button>
        )}
        {alert.status === 'attended' && alert.attendedAt && (
          <p style={{ margin: 0, marginTop: 4, fontSize: '0.75rem', color: 'var(--text-disabled)' }}>
            Atendida {relativeTime(alert.attendedAt)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Componente: filtros activos ──────────────────────────────────────────────

const FILTER_OPTIONS = {
  severity: [
    { value: undefined,  label: 'Toda severidad' },
    { value: 'red',      label: '🔴 Crítico' },
    { value: 'yellow',   label: '🟡 Precaución' },
  ],
  status: [
    { value: undefined,        label: 'Todo estado' },
    { value: 'new',            label: 'Nueva' },
    { value: 'attended',       label: 'Atendida' },
    { value: 'auto_resolved',  label: 'Resuelta' },
  ],
} as const;

function FilterBar({
  filters,
  onFiltersChange,
  sectors,
}: {
  filters: AlertFilters;
  onFiltersChange: (f: AlertFilters) => void;
  sectors: string[];
}) {
  const hasActiveFilter = !!(filters.severity || filters.status || filters.sector);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', alignItems: 'center' }}>
      <Filter size={14} strokeWidth={1.5} color="var(--text-disabled)" />

      {/* Severidad */}
      {FILTER_OPTIONS.severity.map((opt) => (
        <button
          key={opt.label}
          onClick={() => onFiltersChange({ ...filters, severity: opt.value as AlertFilters['severity'] })}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            minHeight: 30,
            background: filters.severity === opt.value
              ? 'rgba(16,185,129,0.15)'
              : 'rgba(255,255,255,0.04)',
            color: filters.severity === opt.value
              ? 'var(--accent)'
              : 'var(--text-secondary)',
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
        >
          {opt.label}
        </button>
      ))}

      {/* Estado */}
      {FILTER_OPTIONS.status.map((opt) => (
        <button
          key={opt.label}
          onClick={() => onFiltersChange({ ...filters, status: opt.value as AlertFilters['status'] })}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            minHeight: 30,
            background: filters.status === opt.value
              ? 'rgba(16,185,129,0.15)'
              : 'rgba(255,255,255,0.04)',
            color: filters.status === opt.value
              ? 'var(--accent)'
              : 'var(--text-secondary)',
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
        >
          {opt.label}
        </button>
      ))}

      {/* Sector */}
      {sectors.length > 1 && sectors.map((s) => (
        <button
          key={s}
          onClick={() => onFiltersChange({ ...filters, sector: filters.sector === s ? undefined : s })}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            minHeight: 30,
            background: filters.sector === s
              ? 'rgba(59,130,246,0.15)'
              : 'rgba(255,255,255,0.04)',
            color: filters.sector === s
              ? 'var(--status-blue)'
              : 'var(--text-secondary)',
          }}
        >
          {s}
        </button>
      ))}

      {/* Limpiar filtros */}
      {hasActiveFilter && (
        <button
          onClick={() => onFiltersChange({})}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            minHeight: 30,
            background: 'rgba(239,68,68,0.08)',
            color: 'var(--status-red)',
          }}
        >
          <X size={11} strokeWidth={2} />
          Limpiar
        </button>
      )}
    </div>
  );
}

// ─── Componente: configuración de umbrales ────────────────────────────────────

type Variable = 'temperature' | 'humidity' | 'soilMoisture';

const VARIABLE_CONFIG: { key: Variable; label: string; unit: string; min: number; max: number }[] = [
  { key: 'temperature',  label: 'Temperatura',         unit: '°C', min: -10, max: 60 },
  { key: 'humidity',     label: 'Humedad Relativa',     unit: '%',  min: 0,   max: 100 },
  { key: 'soilMoisture', label: 'Humedad de Suelo',     unit: '%',  min: 0,   max: 100 },
];

function ThresholdBlock({
  varKey,
  label,
  unit,
  min,
  max,
  values,
  onChange,
  disabled,
}: {
  varKey: Variable;
  label: string;
  unit: string;
  min: number;
  max: number;
  values: { redMin: number; yellowMin: number; yellowMax: number; redMax: number };
  onChange: (key: Variable, field: string, value: number) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(true);

  const sliders: { field: string; label: string; color: string; description: string }[] = [
    { field: 'redMin',    label: 'Crítico mínimo',   color: 'var(--status-red)',    description: `Por debajo → 🔴 Rojo` },
    { field: 'yellowMin', label: 'Precaución mínimo', color: 'var(--status-yellow)', description: `Por debajo → 🟡 Amarillo` },
    { field: 'yellowMax', label: 'Precaución máximo', color: 'var(--status-yellow)', description: `Por arriba → 🟡 Amarillo` },
    { field: 'redMax',    label: 'Crítico máximo',   color: 'var(--status-red)',    description: `Por arriba → 🔴 Rojo` },
  ];

  return (
    <div className="nm-concave" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {/* Header del bloque */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-sm)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          minHeight: 48,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-disabled)' }}>
            🟢 {values.yellowMin}–{values.yellowMax}{unit} · 🔴 &lt;{values.redMin} o &gt;{values.redMax}{unit}
          </span>
          {open ? <ChevronUp size={14} strokeWidth={1.5} color="var(--text-disabled)" /> : <ChevronDown size={14} strokeWidth={1.5} color="var(--text-disabled)" />}
        </div>
      </button>

      {/* Sliders expandibles */}
      {open && (
        <div style={{ padding: '0 var(--space-sm) var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {sliders.map(({ field, label: sliderLabel, color, description }) => {
            const currentVal = values[field as keyof typeof values];
            return (
              <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {sliderLabel}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-disabled)' }}>{description}</span>
                    <span style={{ fontWeight: 700, color, fontSize: '1rem', minWidth: 40, textAlign: 'right' }}>
                      {currentVal}{unit}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={1}
                  value={currentVal}
                  disabled={disabled}
                  onChange={(e) => onChange(varKey, field, Number(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: color,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                  }}
                  aria-label={`${label} — ${sliderLabel}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ThresholdsSection({ greenhouseId }: { greenhouseId: string }) {
  const { thresholds, loading, saving, error, successMsg, save, reset } = useThresholds(greenhouseId);
  const [draft, setDraft] = useState<GreenhouseThresholds | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Sincronizar draft cuando cargan los thresholds desde Firestore
  const current = draft ?? thresholds;

  const handleChange = useCallback((varKey: Variable, field: string, value: number) => {
    setDraft((prev) => {
      const base = prev ?? thresholds;
      return {
        ...base,
        [varKey]: { ...base[varKey], [field]: value },
      };
    });
  }, [thresholds]);

  const handleSave = async () => {
    await save(current);
    setDraft(null);
  };

  const handleReset = async () => {
    await reset();
    setDraft(null);
    setShowResetConfirm(false);
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-md)', color: 'var(--text-disabled)', textAlign: 'center' }}>
        Cargando umbrales...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      {/* Mensaje de éxito */}
      {successMsg && (
        <div
          className="animate-fade-in"
          style={{
            padding: 'var(--space-sm)',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16,185,129,0.10)',
            border: '1px solid rgba(16,185,129,0.25)',
            color: 'var(--status-green)',
            fontSize: '0.875rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} strokeWidth={1.5} />
          {successMsg}
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <div style={{
          padding: 'var(--space-sm)',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(239,68,68,0.10)',
          border: '1px solid rgba(239,68,68,0.25)',
          color: 'var(--status-red)',
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {/* Bloques por variable */}
      {VARIABLE_CONFIG.map(({ key, label, unit, min, max }) => (
        <ThresholdBlock
          key={key}
          varKey={key}
          label={label}
          unit={unit}
          min={min}
          max={max}
          values={current[key]}
          onChange={handleChange}
          disabled={saving}
        />
      ))}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {/* Dialog confirmación de reset */}
        {showResetConfirm ? (
          <div
            className="nm-concave animate-fade-in"
            style={{
              width: '100%',
              padding: 'var(--space-sm)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              ¿Seguro que deseas restaurar los umbrales de fábrica? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-xs)', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: 36,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleReset}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'rgba(239,68,68,0.15)',
                  color: 'var(--status-red)',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  minHeight: 36,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <RotateCcw size={14} strokeWidth={1.5} />
                Sí, restaurar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              minHeight: 36,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RotateCcw size={14} strokeWidth={1.5} />
            Restaurar valores de fábrica
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !draft}
          style={{
            padding: '8px 20px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: draft && !saving ? 'var(--accent)' : 'rgba(16,185,129,0.2)',
            color: draft && !saving ? '#fff' : 'var(--text-disabled)',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: (saving || !draft) ? 'not-allowed' : 'pointer',
            minHeight: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
        >
          <Save size={14} strokeWidth={1.5} />
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { activeWorkspace, isAdmin } = useAuth();
  const greenhouseId = activeWorkspace?.id ?? null;

  const { alerts, loading, unattendedCount, filters, setFilters, markAttended } =
    useAlerts(greenhouseId);

  // Sectores únicos presentes en las alertas (para el filtro)
  const sectors = [...new Set(alerts.map((a) => a.sector))].filter(Boolean).sort();

  return (
    <div className="container animate-fade-in" style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-2xl)' }}>

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
            Alertas y Notificaciones
          </h2>
          {unattendedCount > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(239,68,68,0.12)',
              color: 'var(--status-red)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--radius-full)',
              padding: '2px 10px',
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}>
              <Bell size={10} strokeWidth={2} />
              {unattendedCount} sin atender
            </span>
          )}
        </div>
        <p style={{ margin: 0, marginTop: 'var(--space-xs)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {activeWorkspace ? `Invernadero: ${activeWorkspace.name}` : 'Selecciona un invernadero'}
        </p>
      </div>

      {!activeWorkspace ? (
        <div className="nm-concave" style={{ padding: 'var(--space-2xl)', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
          <BellOff size={32} strokeWidth={1.2} color="var(--text-disabled)" style={{ marginBottom: 'var(--space-sm)' }} />
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Selecciona un invernadero para ver las alertas.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

          {/* ─── Sección 1: Lista de alertas ──────────────────────── */}
          <section>
            <h3 style={{ margin: 0, marginBottom: 'var(--space-sm)', fontSize: '1rem' }}>
              Historial de alertas
            </h3>

            {/* Filtros */}
            <div style={{ marginBottom: 'var(--space-sm)' }}>
              <FilterBar filters={filters} onFiltersChange={setFilters} sectors={sectors} />
            </div>

            {/* Lista */}
            {loading ? (
              /* Skeleton */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="nm-flat" style={{ height: 88, borderRadius: 'var(--radius-lg)', opacity: 0.4 + i * 0.1 }} />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="nm-concave" style={{ padding: 'var(--space-2xl)', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
                <BellOff size={28} strokeWidth={1.2} color="var(--text-disabled)" style={{ marginBottom: 'var(--space-sm)' }} />
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  {Object.keys(filters).length > 0 ? 'No hay alertas con los filtros seleccionados.' : 'No hay alertas registradas.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {alerts.map((alert) => (
                  <AlertItem key={alert.id} alert={alert} onMarkAttended={markAttended} />
                ))}
              </div>
            )}
          </section>

          {/* ─── Sección 2: Configuración de umbrales (solo admin) ── */}
          {isAdmin && (
            <section>
              <h3 style={{ margin: 0, marginBottom: 'var(--space-sm)', fontSize: '1rem' }}>
                Configuración de umbrales
              </h3>
              <ThresholdsSection greenhouseId={greenhouseId!} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
