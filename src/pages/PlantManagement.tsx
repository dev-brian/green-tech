import { useState, useEffect } from 'react';
import {
  Leaf, Droplets, ThermometerSun, Plus, ShieldAlert,
  Pencil, Trash2, X, CloudRain, Sun
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { plantsService, type Plant } from '../lib/plantsService';

/* ─── Utilidades ───────────────────────────────────────────── */

type PlantStatus = 'En Espera' | 'Creciendo' | 'Óptimo' | 'Cosecha';

const STATUS_CONFIG: Record<PlantStatus, { color: string; glow: string; label: string }> = {
  'En Espera': { color: 'var(--text-disabled)',  glow: 'rgba(74,85,104,0.35)',           label: 'En Espera' },
  'Creciendo': { color: 'var(--status-blue)',    glow: 'rgba(59,130,246,0.35)',           label: 'Creciendo' },
  'Óptimo':    { color: 'var(--status-green)',   glow: 'rgba(16,185,129,0.35)',           label: 'Óptimo'    },
  'Cosecha':   { color: 'var(--status-yellow)',  glow: 'rgba(245,158,11,0.35)',           label: 'Cosecha'   },
};

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as PlantStatus] ?? STATUS_CONFIG['En Espera'];
  return (
    <span style={{
      display: 'inline-block',
      width: 10, height: 10,
      borderRadius: '50%',
      background: 'var(--bg)',
      border: `1px solid ${cfg.color}`,
      boxShadow: `inset 0 0 6px ${cfg.glow}, 0 0 4px ${cfg.glow}`,
      flexShrink: 0,
    }} />
  );
}

/* ─── Fila de parámetro dentro de la tarjeta ──────────────── */
function ParamRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <li style={{
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-xs)',
      padding: 'var(--space-xs) 0',
      borderBottom: '1px solid rgba(255,255,255,0.03)',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
        {icon}
        {label}
      </span>
      <strong style={{
        fontSize: '0.8125rem', color: 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
        background: 'var(--bg-sunken)',
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        flexShrink: 0,
      }}>
        {value}
      </strong>
    </li>
  );
}

/* ─── Tarjeta de planta ───────────────────────────────────── */
function PlantCard({
  plant,
  onEdit,
  onDelete,
  onSetActive,
}: {
  plant: Plant;
  onEdit: (p: Plant) => void;
  onDelete: (id: string) => void;
  onSetActive: (id: string) => void;
}) {
  const isActive = plant.active;
  return (
    <div
      className="nm-flat"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
        padding: 'var(--space-sm)',
        borderRadius: 'var(--radius-md)',
        ...(isActive && {
          borderLeft: '3px solid var(--accent)',
          boxShadow: `5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light), inset 0 0 20px rgba(16,185,129,0.04)`,
        }),
      }}
    >
      {/* Badge CULTIVO ACTIVO */}
      {isActive && (
        <div style={{
          position: 'absolute', top: -10, left: 12,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'var(--accent)', color: 'var(--bg)',
          padding: '2px 10px', borderRadius: 'var(--radius-full)',
          fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bg)', opacity: 0.8, animation: 'led-pulse 1.5s ease-in-out infinite' }} />
          Cultivo Actual
        </div>
      )}

      {/* Cabecera */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 'var(--space-xs)',
        marginTop: isActive ? 8 : 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flex: 1, minWidth: 0 }}>
          <div className="nm-concave" style={{
            width: 40, height: 40, borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Leaf size={20} strokeWidth={1.5} color={isActive ? 'var(--accent)' : 'var(--text-disabled)'} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0, fontWeight: 700, fontSize: '0.9375rem',
              color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {plant.name}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <StatusDot status={plant.status} />
              <span className="metric-label">{plant.status}</span>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => onEdit(plant)}
            aria-label="Editar planta"
            className="nm-flat"
            style={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)', cursor: 'pointer',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <Pencil size={13} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => onDelete(plant.id)}
            aria-label="Eliminar planta"
            className="nm-flat"
            style={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)', cursor: 'pointer',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--status-red)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Parámetros */}
      <div className="nm-concave" style={{ padding: 'var(--space-xs) var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          <ParamRow icon={<ThermometerSun size={14} strokeWidth={1.5} color="var(--status-yellow)" />} label="Temp." value={`${plant.reqs.tempMin}–${plant.reqs.tempMax}°C`} />
          <ParamRow icon={<CloudRain      size={14} strokeWidth={1.5} color="var(--status-blue)"   />} label="HR"    value={`${plant.reqs.humidity}%`} />
          <ParamRow icon={<Droplets       size={14} strokeWidth={1.5} color="var(--status-blue)"   />} label="Sustrato" value={`${plant.reqs.soilMoisture}%`} />
          <ParamRow icon={<Sun            size={14} strokeWidth={1.5} color="var(--status-yellow)" />} label="Luz"   value={`${plant.reqs.lightHours}h`} />
        </ul>
      </div>

      {/* CTA: establecer como activo */}
      {!isActive && (
        <button
          onClick={() => onSetActive(plant.id)}
          className="btn-secondary"
          style={{ width: '100%', minHeight: 44, fontSize: '0.8125rem' }}
        >
          Establecer como Cultivo
        </button>
      )}
    </div>
  );
}

/* ─── Slider con etiqueta ─────────────────────────────────── */
function LabeledSlider({
  label, icon, value, min, max, step = 1, unit, color, onChange,
}: {
  label: string; icon: React.ReactNode; value: number;
  min: number; max: number; step?: number;
  unit: string; color: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {icon} {label}
        </label>
        <span style={{ fontWeight: 700, fontSize: '0.875rem', color, fontVariantNumeric: 'tabular-nums' }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
      />
    </div>
  );
}

/* ─── Modal de nuevo/editar cultivo ──────────────────────── */
const STATUS_OPTIONS: { id: PlantStatus; desc: string }[] = [
  { id: 'En Espera', desc: 'Aún no plantado en el sistema.' },
  { id: 'Creciendo', desc: 'Fase de desarrollo temprano.' },
  { id: 'Óptimo',    desc: 'Salud perfecta o madurez vegetativa.' },
  { id: 'Cosecha',   desc: 'Lista para ser recolectada.' },
];

function PlantModal({
  editingPlant,
  formData,
  setFormData,
  isSaving,
  errorMsg,
  onClose,
  onSubmit,
  handleTempMinChange,
  handleTempMaxChange,
}: {
  editingPlant: Plant | null;
  formData: any;
  setFormData: (d: any) => void;
  isSaving: boolean;
  errorMsg: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  handleTempMinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTempMaxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.72)',
      padding: '0',
    }}>
      {/* Panel deslizable desde abajo en móvil */}
      <div
        className="nm-flat animate-fade-in"
        style={{
          width: '100%', maxWidth: 520,
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          overflow: 'hidden',
        }}
      >
        {/* Cabecera del modal */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-md)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div className="nm-concave" style={{
              width: 40, height: 40, borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Leaf size={20} strokeWidth={1.5} color="var(--accent)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                {editingPlant ? 'Editar Cultivo' : 'Nuevo Cultivo'}
              </h3>
              <p className="metric-timestamp" style={{ marginTop: 2 }}>
                Parámetros del perfil de planta
              </p>
            </div>
          </div>
          <button
            type="button" onClick={onClose}
            className="nm-flat"
            aria-label="Cerrar"
            style={{
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Cuerpo scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
          <form id="plant-form" onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

            {/* ── Información básica ────────────────── */}
            <section>
              <span className="metric-label" style={{ display: 'block', marginBottom: 'var(--space-sm)' }}>
                Información Básica
              </span>
              <div className="nm-concave" style={{ padding: 'var(--space-xs) var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre del cultivo (ej. Lechuga Romana)"
                  style={{
                    width: '100%', background: 'transparent', border: 'none',
                    outline: 'none', padding: 'var(--space-xs) 0',
                    color: 'var(--text-primary)', fontSize: '0.9375rem',
                    minHeight: 40,
                  }}
                />
              </div>
            </section>

            {/* ── Estado inicial ────────────────────── */}
            <section>
              <span className="metric-label" style={{ display: 'block', marginBottom: 'var(--space-sm)' }}>
                Estado Inicial
              </span>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 'var(--space-xs)',
              }}>
                {STATUS_OPTIONS.map(s => {
                  const cfg = STATUS_CONFIG[s.id];
                  const isSelected = formData.status === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, status: s.id })}
                      className="nm-flat"
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        textAlign: 'left',
                        padding: 'var(--space-sm)',
                        border: isSelected ? `1px solid ${cfg.color}` : '1px solid rgba(255,255,255,0.03)',
                        cursor: 'pointer',
                        gap: 4,
                        ...(isSelected && { boxShadow: `5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light), inset 0 0 12px ${cfg.glow}` }),
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StatusDot status={s.id} />
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: isSelected ? cfg.color : 'var(--text-primary)' }}>
                          {s.id}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-disabled)', lineHeight: 1.4 }}>
                        {s.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ── Parámetros ambientales ────────────── */}
            <section>
              <span className="metric-label" style={{ display: 'block', marginBottom: 'var(--space-sm)' }}>
                Parámetros (Microclima)
              </span>

              {/* Temperatura */}
              <div className="nm-concave" style={{ padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    <ThermometerSun size={14} strokeWidth={1.5} color="var(--status-yellow)" />
                    Temperatura
                  </label>
                  <span style={{ fontWeight: 700, color: 'var(--status-yellow)', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
                    {formData.tempMin}–{formData.tempMax}°C
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="metric-timestamp">Mínima</span>
                      <span className="metric-timestamp">{formData.tempMin}°C</span>
                    </div>
                    <input type="range" min="0" max="40" step="1" value={formData.tempMin} onChange={handleTempMinChange} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="metric-timestamp">Máxima</span>
                      <span className="metric-timestamp">{formData.tempMax}°C</span>
                    </div>
                    <input type="range" min="0" max="50" step="1" value={formData.tempMax} onChange={handleTempMaxChange} />
                  </div>
                </div>
              </div>

              {/* HR + Sustrato */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                <div className="nm-concave" style={{ padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
                  <LabeledSlider
                    label="HR" icon={<CloudRain size={14} strokeWidth={1.5} color="var(--status-blue)" />}
                    value={formData.humidity} min={0} max={100} step={5}
                    unit="%" color="var(--status-blue)"
                    onChange={v => setFormData({ ...formData, humidity: v })}
                  />
                </div>
                <div className="nm-concave" style={{ padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
                  <LabeledSlider
                    label="Sustrato" icon={<Droplets size={14} strokeWidth={1.5} color="var(--status-blue)" />}
                    value={formData.soilMoisture} min={0} max={100} step={5}
                    unit="%" color="var(--status-blue)"
                    onChange={v => setFormData({ ...formData, soilMoisture: v })}
                  />
                </div>
              </div>

              {/* Fotoperiodo */}
              <div className="nm-concave" style={{ padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
                <LabeledSlider
                  label="Fotoperiodo" icon={<Sun size={14} strokeWidth={1.5} color="var(--status-yellow)" />}
                  value={formData.lightHours} min={0} max={24} step={1}
                  unit="h/día" color="var(--status-yellow)"
                  onChange={v => setFormData({ ...formData, lightHours: v })}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xs)' }}>
                  <span className="metric-timestamp">0h</span>
                  <span className="metric-timestamp">12h</span>
                  <span className="metric-timestamp">24h</span>
                </div>
              </div>
            </section>
          </form>
        </div>

        {/* Footer del modal */}
        <div style={{
          padding: 'var(--space-md)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)',
        }}>
          {errorMsg && (
            <div className="nm-concave" style={{
              padding: 'var(--space-xs) var(--space-sm)',
              borderLeft: '3px solid var(--status-red)',
              marginBottom: 'var(--space-xs)',
            }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--status-red)' }}>{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button
              type="button" onClick={onClose} disabled={isSaving}
              className="btn-secondary"
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="submit" form="plant-form" disabled={isSaving}
              className="btn-primary"
              style={{ flex: 1 }}
            >
              {isSaving ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Guardando...
                </span>
              ) : 'Guardar Cultivo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Página principal ────────────────────────────────────── */
export default function PlantManagement() {
  const { isAdmin, activeWorkspace } = useAuth();

  const [plants,      setPlants]      = useState<Plant[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [isSaving,    setIsSaving]    = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '', status: 'En Espera', tempMin: 18, tempMax: 24,
    humidity: 60, soilMoisture: 50, lightHours: 12,
  });

  useEffect(() => {
    if (isAdmin && activeWorkspace) loadPlants();
  }, [isAdmin, activeWorkspace]);

  const loadPlants = async () => {
    if (!activeWorkspace) return;
    try { setLoading(true); setErrorMsg(null); setPlants(await plantsService.getPlants(activeWorkspace.id)); }
    catch (e: any) { setErrorMsg('No se pudieron cargar las plantas: ' + (e.message || 'Error desconocido')); }
    finally { setLoading(false); }
  };

  const handleOpenModal = (plant?: Plant) => {
    setErrorMsg(null);
    if (plant) {
      setEditingPlant(plant);
      setFormData({ name: plant.name, status: plant.status, tempMin: plant.reqs.tempMin || 18, tempMax: plant.reqs.tempMax || 24, humidity: plant.reqs.humidity || 60, soilMoisture: plant.reqs.soilMoisture || 50, lightHours: plant.reqs.lightHours || 12 });
    } else {
      setEditingPlant(null);
      setFormData({ name: '', status: 'En Espera', tempMin: 18, tempMax: 24, humidity: 60, soilMoisture: 50, lightHours: 12 });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => { setIsModalOpen(false); setEditingPlant(null); setErrorMsg(null); };

  const handleSavePlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    try {
      setIsSaving(true); setErrorMsg(null);
      const data = { name: formData.name, status: formData.status, active: editingPlant?.active ?? false, reqs: { tempMin: +formData.tempMin, tempMax: +formData.tempMax, humidity: +formData.humidity, soilMoisture: +formData.soilMoisture, lightHours: +formData.lightHours } };
      if (editingPlant) await plantsService.updatePlant(activeWorkspace.id, editingPlant.id, data);
      else await plantsService.addPlant(activeWorkspace.id, data);
      handleCloseModal(); loadPlants();
    } catch (e: any) { setErrorMsg('Error al guardar: ' + (e.message || 'Verifica tus permisos de Firebase.')); }
    finally { setIsSaving(false); }
  };

  const handleDeletePlant = async (plantId: string) => {
    if (!activeWorkspace || !window.confirm('¿Eliminar esta planta?')) return;
    try { await plantsService.deletePlant(activeWorkspace.id, plantId); loadPlants(); }
    catch (e: any) { alert('Error al eliminar: ' + e.message); }
  };

  const handleSetActive = async (plantId: string) => {
    if (!activeWorkspace) return;
    try { await plantsService.setActivePlant(activeWorkspace.id, plantId, plants.map(p => p.id)); loadPlants(); }
    catch (e: any) { alert('Error al activar: ' + e.message); }
  };

  const handleTempMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value); if (v <= formData.tempMax) setFormData({ ...formData, tempMin: v });
  };
  const handleTempMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value); if (v >= formData.tempMin) setFormData({ ...formData, tempMax: v });
  };

  /* ── Vista: acceso restringido ──────────────────────── */
  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '70vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-lg) var(--space-md)', textAlign: 'center',
      }} className="animate-fade-in">
        <div className="nm-flat" style={{
          width: 80, height: 80,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 'var(--radius-lg)',
          borderLeft: '3px solid var(--status-yellow)',
          marginBottom: 'var(--space-md)',
        }}>
          <ShieldAlert size={36} strokeWidth={1.5} color="var(--status-yellow)" />
        </div>
        <h2 style={{ margin: 0, marginBottom: 'var(--space-xs)', fontSize: 'clamp(1.25rem, 4vw, 1.75rem)' }}>
          Acceso Restringido
        </h2>
        <p style={{ maxWidth: 400, marginBottom: 'var(--space-lg)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
          La gestión de cultivos es exclusiva para usuarios con rol de{' '}
          <strong style={{ color: 'var(--text-primary)' }}>Administrador</strong>.
        </p>
        <Link to="/dashboard" className="btn-primary" style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)',
          textDecoration: 'none', minWidth: 200,
        }}>
          Volver al Dashboard
        </Link>
      </div>
    );
  }

  /* ── Vista principal ──────────────────────────────── */
  return (
    <>
      <div
        className="container animate-fade-in"
        style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-2xl)' }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)',
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', letterSpacing: '-0.02em' }}>
              Catálogo de Cultivos
            </h1>
            <p style={{ margin: 0, marginTop: 'var(--space-xs)', fontSize: '0.875rem' }}>
              Perfiles y parámetros de las plantas del invernadero.
            </p>
          </div>
          <button
            id="add-plant-btn"
            onClick={() => handleOpenModal()}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', minWidth: 160 }}
          >
            <Plus size={18} strokeWidth={1.5} />
            Registrar Cultivo
          </button>
        </div>

        {/* Error de carga */}
        {errorMsg && !isModalOpen && (
          <div className="nm-concave" style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
            padding: 'var(--space-sm)', marginBottom: 'var(--space-md)',
            borderLeft: '3px solid var(--status-red)',
          }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--status-red)' }}>{errorMsg}</span>
          </div>
        )}

        {/* Estado de carga */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-sm)', padding: 'var(--space-2xl) 0', color: 'var(--text-disabled)' }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--text-disabled)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span>Cargando base de datos...</span>
          </div>
        ) : plants.length === 0 ? (
          /* Estado vacío */
          <div className="nm-concave" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', textAlign: 'center',
            padding: 'var(--space-2xl) var(--space-md)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <div className="nm-flat" style={{
              width: 64, height: 64, borderRadius: 'var(--radius-full)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 'var(--space-md)',
            }}>
              <Leaf size={28} strokeWidth={1.5} color="var(--text-disabled)" />
            </div>
            <h3 style={{ margin: 0, marginBottom: 'var(--space-xs)', fontSize: '1.25rem' }}>
              Aún no hay cultivos
            </h3>
            <p style={{ margin: 0, marginBottom: 'var(--space-lg)', maxWidth: 320, fontSize: '0.875rem' }}>
              Registra el primer perfil de planta para comenzar el monitoreo paramétrico.
            </p>
            <button onClick={() => handleOpenModal()} className="btn-secondary" style={{ minWidth: 200 }}>
              Agregar mi primera planta
            </button>
          </div>
        ) : (
          /* Grid de tarjetas */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(1, 1fr)',
            gap: 'var(--space-md)',
          }}
          className="plants-grid"
          >
            {plants.map(plant => (
              <PlantCard
                key={plant.id}
                plant={plant}
                onEdit={handleOpenModal}
                onDelete={handleDeletePlant}
                onSetActive={handleSetActive}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <PlantModal
          editingPlant={editingPlant}
          formData={formData}
          setFormData={setFormData}
          isSaving={isSaving}
          errorMsg={errorMsg}
          onClose={handleCloseModal}
          onSubmit={handleSavePlant}
          handleTempMinChange={handleTempMinChange}
          handleTempMaxChange={handleTempMaxChange}
        />
      )}
    </>
  );
}
