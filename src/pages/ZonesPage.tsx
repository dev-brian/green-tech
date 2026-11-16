import { useMemo, useState, type FormEvent } from 'react';
import { MapPin, Pencil, Plus, Trash2, X, Check, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useZones } from '../hooks/useZones';
import { useTelemetrySource } from '../hooks/useTelemetrySource';
import { createZone, deleteZone, updateZone } from '../lib/zonesService';
import {
  ZONE_CROPS,
  ZONE_NAME_MAX,
  compareZoneIds,
  cropLabel,
  defaultZoneName,
  isZoneCrop,
  nextZoneId,
  normalizeZoneName,
  type Zone,
  type ZoneCrop,
} from '../lib/zones';

/**
 * Zonas de cultivo (HU-04 #63, T4.1 #64).
 * El admin crea, renombra, cambia el cultivo y borra zonas. El operador
 * solo las ve. Cada zona usa los umbrales de su cultivo: el backend lee
 * `zones/{zoneId}.crop` al evaluar cada lectura.
 */

const fieldStyle = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  padding: 'var(--space-xs) 0',
  color: 'var(--text-primary)',
  fontSize: '0.9375rem',
  minHeight: 40,
} as const;

function errorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === 'permission-denied') return 'No tienes permiso. Solo el admin puede editar zonas.';
  if (code === 'unavailable') return 'Sin conexión. Intenta de nuevo cuando vuelva internet.';
  return 'No se pudo guardar. Intenta de nuevo.';
}

function CropPicker({ value, onChange, name }: { value: ZoneCrop; onChange: (c: ZoneCrop) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label="Cultivo" style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
      {ZONE_CROPS.map((c) => {
        const selected = value === c.value;
        return (
          <label
            key={c.value}
            className={selected ? 'nm-concave' : 'nm-flat'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 var(--space-sm)',
              minHeight: 44,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontWeight: selected ? 700 : 600,
              fontSize: '0.875rem',
              color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <input
              type="radio"
              name={name}
              value={c.value}
              checked={selected}
              onChange={() => onChange(c.value)}
              style={{ accentColor: 'var(--accent)' }}
            />
            {c.label}
          </label>
        );
      })}
    </div>
  );
}

function ZoneForm({
  title,
  zoneId,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  zoneId: string;
  initial: { name: string; crop: ZoneCrop };
  submitLabel: string;
  onSubmit: (data: { name: string; crop: ZoneCrop }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [crop, setCrop] = useState<ZoneCrop>(initial.crop);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    const clean = normalizeZoneName(name);
    if (!clean) {
      setError(`Escribe un nombre de 1 a ${ZONE_NAME_MAX} caracteres.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: clean, crop });
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handle}
      className="nm-flat animate-fade-in"
      style={{ padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          ID del sensor: <code>{zoneId}</code>
        </span>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="metric-label">Nombre</span>
        <div className="nm-concave" style={{ padding: 'var(--space-xs) var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
          <input
            autoFocus
            type="text"
            value={name}
            maxLength={ZONE_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Mesa norte"
            style={fieldStyle}
          />
        </div>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="metric-label">Cultivo</span>
        <CropPicker value={crop} onChange={setCrop} name={`crop-${zoneId}`} />
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          La zona usa los umbrales de este cultivo para el semáforo y las alertas.
        </span>
      </div>

      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--status-red)', fontSize: '0.875rem' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-xs)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" onClick={onCancel} className="btn-secondary" style={{ minHeight: 44 }} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" style={{ minHeight: 44 }} disabled={saving}>
          {saving ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function ZoneRow({
  zone,
  isAdmin,
  hasData,
  onEdit,
  onDelete,
}: {
  zone: Zone;
  isAdmin: boolean;
  hasData: boolean;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <li
      className="nm-flat"
      style={{ listStyle: 'none', padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <MapPin size={18} strokeWidth={1.5} color="var(--accent)" aria-hidden />
        <div style={{ flex: 1, minWidth: 160 }}>
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{zone.name}</p>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {cropLabel(zone.crop)} · <code>{zone.id}</code>
            {!hasData && ' · aún sin lecturas'}
          </p>
        </div>
        {isAdmin && !confirming && (
          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            <button type="button" onClick={onEdit} className="nm-flat" aria-label={`Editar ${zone.name}`}
              style={{ border: 'none', minWidth: 44, minHeight: 44, borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <Pencil size={16} strokeWidth={1.5} />
            </button>
            <button type="button" onClick={() => setConfirming(true)} className="nm-flat" aria-label={`Borrar ${zone.name}`}
              style={{ border: 'none', minWidth: 44, minHeight: 44, borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--status-red)' }}>
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 200, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            ¿Borrar “{zone.name}”? Sus lecturas y alertas pasadas se conservan.
          </span>
          <button type="button" onClick={() => setConfirming(false)} className="btn-secondary" style={{ minHeight: 40 }} disabled={busy}>
            <X size={14} /> No
          </button>
          <button type="button" onClick={remove} className="btn-nm-danger" style={{ minHeight: 40 }} disabled={busy}>
            <Check size={14} /> {busy ? 'Borrando…' : 'Sí, borrar'}
          </button>
        </div>
      )}
      {error && <p role="alert" style={{ margin: 0, color: 'var(--status-red)', fontSize: '0.875rem' }}>{error}</p>}
    </li>
  );
}

type Editing = { mode: 'create'; zoneId: string; name: string; crop: ZoneCrop } | { mode: 'edit'; zone: Zone } | null;

export default function ZonesPage() {
  const { activeWorkspace, isAdmin } = useAuth();
  const greenhouseId = activeWorkspace?.id ?? null;
  const { zones, zonesById, loading, error } = useZones(greenhouseId);
  const { zonesById: liveZones } = useTelemetrySource(greenhouseId);
  const [editing, setEditing] = useState<Editing>(null);

  // Zonas que ya mandan datos pero nadie registró (por ejemplo las del simulador).
  const unregistered = useMemo(
    () =>
      Object.values(liveZones)
        .filter((z) => !zonesById[z.zoneId])
        .sort((a, b) => compareZoneIds(a.zoneId, b.zoneId)),
    [liveZones, zonesById],
  );

  const startCreate = () => {
    const zoneId = nextZoneId([...zones.map((z) => z.id), ...Object.keys(liveZones)]);
    setEditing({ mode: 'create', zoneId, name: defaultZoneName(zoneId), crop: 'jitomate' });
  };

  if (!greenhouseId) {
    return (
      <div className="container" style={{ paddingTop: 'var(--space-md)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Selecciona un invernadero para ver sus zonas.</p>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-2xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}>Zonas de cultivo</h2>
          <p style={{ margin: 0, marginTop: 'var(--space-xs)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {isAdmin
              ? 'Crea una zona por cada mesa o sistema y asígnale su cultivo.'
              : 'Solo el admin puede crear o cambiar zonas.'}
          </p>
        </div>
        {isAdmin && !editing && (
          <button type="button" onClick={startCreate} className="btn-primary" style={{ minHeight: 44 }}>
            <Plus size={16} /> Nueva zona
          </button>
        )}
      </header>

      {editing?.mode === 'create' && (
        <ZoneForm
          title="Nueva zona"
          zoneId={editing.zoneId}
          initial={{ name: editing.name, crop: editing.crop }}
          submitLabel="Crear zona"
          onCancel={() => setEditing(null)}
          onSubmit={async (data) => {
            await createZone(greenhouseId, editing.zoneId, data);
            setEditing(null);
          }}
        />
      )}

      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--status-red)' }}>No se pudieron cargar las zonas: {error}</p>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Cargando zonas…</p>
      ) : zones.length === 0 && unregistered.length === 0 ? (
        <div className="nm-concave" style={{ padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Todavía no hay zonas. {isAdmin ? 'Crea la primera con “Nueva zona”.' : ''}
        </div>
      ) : (
        <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {zones.map((zone) =>
            editing?.mode === 'edit' && editing.zone.id === zone.id ? (
              <li key={zone.id} style={{ listStyle: 'none' }}>
                <ZoneForm
                  title={`Editar ${zone.name}`}
                  zoneId={zone.id}
                  initial={{ name: zone.name, crop: zone.crop }}
                  submitLabel="Guardar"
                  onCancel={() => setEditing(null)}
                  onSubmit={async (data) => {
                    await updateZone(greenhouseId, zone.id, data);
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <ZoneRow
                key={zone.id}
                zone={zone}
                isAdmin={isAdmin}
                hasData={!!liveZones[zone.id]}
                onEdit={() => setEditing({ mode: 'edit', zone })}
                onDelete={() => deleteZone(greenhouseId, zone.id)}
              />
            ),
          )}
        </ul>
      )}

      {!loading && unregistered.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={16} strokeWidth={1.5} aria-hidden /> Mandan datos pero no están registradas
          </h3>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Mientras no se registren, usan el cultivo que manda el sensor.
          </p>
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            {unregistered.map((z) => (
              <li key={z.zoneId} className="nm-concave" style={{ listStyle: 'none', padding: 'var(--space-xs) var(--space-md)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 160, fontSize: '0.875rem' }}>
                  <code>{z.zoneId}</code>{z.crop ? ` · ${cropLabel(z.crop)}` : ''}
                </span>
                {isAdmin && !editing && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ minHeight: 40 }}
                    onClick={() =>
                      setEditing({
                        mode: 'create',
                        zoneId: z.zoneId,
                        name: defaultZoneName(z.zoneId),
                        crop: isZoneCrop(z.crop) ? z.crop : 'jitomate',
                      })
                    }
                  >
                    Registrar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
