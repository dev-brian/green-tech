/**
 * Zonas de cultivo (HU-04 #63, T4.1 #64 y T4.2 #65).
 *
 * Funciones puras, sin Firebase, para que las pruebas de `node --test`
 * las importen sin el SDK del navegador. El acceso a Firestore está en
 * `zonesService.ts`.
 *
 * Documento: greenhouses/{greenhouseId}/zones/{zoneId}
 *   - name: string (1..60)
 *   - crop: 'jitomate' | 'lechuga'
 *   - createdAt, updatedAt: Timestamp
 *
 * El `zoneId` es el mismo que manda el sensor en `POST /ingestTelemetry`
 * (por ejemplo `zona-1`), así las lecturas, `state/latest` y las alertas
 * se unen a la zona sin migrar datos.
 */

export type ZoneCrop = 'jitomate' | 'lechuga';

export const ZONE_CROPS: { value: ZoneCrop; label: string }[] = [
  { value: 'jitomate', label: 'Jitomate' },
  { value: 'lechuga', label: 'Lechuga' },
];

export const ZONE_NAME_MAX = 60;

export interface Zone {
  id: string;
  name: string;
  crop: ZoneCrop;
  createdAt: Date | null;
}

export function isZoneCrop(value: unknown): value is ZoneCrop {
  return value === 'jitomate' || value === 'lechuga';
}

export function cropLabel(crop: string | undefined): string | undefined {
  if (!crop) return undefined;
  return ZONE_CROPS.find((c) => c.value === crop)?.label ?? crop;
}

/** Quita espacios de más. Devuelve null si el nombre queda vacío o es muy largo. */
export function normalizeZoneName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length === 0 || name.length > ZONE_NAME_MAX) return null;
  return name;
}

/**
 * Siguiente id libre con la forma `zona-N`, tomando en cuenta las zonas
 * registradas y las que ya mandan datos aunque no estén registradas.
 */
export function nextZoneId(existingIds: Iterable<string>): string {
  let max = 0;
  for (const id of existingIds) {
    const m = /^zona-(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `zona-${max + 1}`;
}

/** "zona-3" → "Zona 3"; cualquier otro id se deja igual. */
export function defaultZoneName(zoneId: string): string {
  const m = /^zona-(\d+)$/.exec(zoneId);
  return m ? `Zona ${m[1]}` : zoneId;
}

/**
 * Nombre para mostrar de una zona: el que le puso el admin, o uno
 * derivado del id si todavía no está registrada.
 */
export function zoneDisplayName(
  zoneId: string,
  zonesById: Record<string, Pick<Zone, 'name'>> | undefined,
): string {
  return zonesById?.[zoneId]?.name ?? defaultZoneName(zoneId);
}

/** Etiqueta "Nombre · Cultivo" para selectores. */
export function zoneLabel(
  zoneId: string,
  zonesById: Record<string, Pick<Zone, 'name' | 'crop'>> | undefined,
  fallbackCrop?: string,
): string {
  const name = zoneDisplayName(zoneId, zonesById);
  const crop = cropLabel(zonesById?.[zoneId]?.crop ?? fallbackCrop);
  return crop ? `${name} · ${crop}` : name;
}

function toDateOrNull(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate();
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Convierte un documento de Firestore en `Zone`; null si está incompleto. */
export function parseZoneDoc(id: string, data: Record<string, unknown>): Zone | null {
  const name = typeof data.name === 'string' ? normalizeZoneName(data.name) : null;
  if (!name || !isZoneCrop(data.crop)) return null;
  return { id, name, crop: data.crop, createdAt: toDateOrNull(data.createdAt) };
}

/** Orden natural: zona-2 antes que zona-10. */
export function compareZoneIds(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true });
}

/**
 * Lista de zonas para filtros: las registradas y, además, las que aparecen
 * en datos (alertas o estado) aunque nadie las haya registrado todavía.
 */
export function mergeZoneIds(registered: Iterable<string>, ...seen: Iterable<string>[]): string[] {
  const set = new Set<string>(registered);
  for (const list of seen) for (const id of list) if (id) set.add(id);
  return [...set].sort(compareZoneIds);
}
