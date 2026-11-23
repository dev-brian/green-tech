/**
 * Descubre qué simular: los invernaderos de Firestore y las zonas que cada
 * uno registró en la PWA (greenhouses/{id}/zones, T4.1 #64), con su cultivo.
 *
 * Así el ciclo programado ya no simula 3 zonas fijas en un solo invernadero:
 * si una cuenta registra 2 zonas de jitomate y otra 1 de lechuga y 2 de
 * jitomate, cada invernadero recibe lecturas de sus propias zonas.
 *
 * Un invernadero que aún no registra zonas pero ya tenía datos (zonas en
 * state/latest) sigue recibiendo lecturas de esas zonas, para no dejar sin
 * datos a los invernaderos creados antes de que existiera el registro.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { compareZoneIds, parseZoneDoc } from '../../src/lib/zones.ts';
import type { CropType } from './hydroponicModel.ts';
import type { SimulatedZoneConfig } from './simulatorEngine.ts';

export interface DiscoveredGreenhouse {
  greenhouseId: string;
  zones: SimulatedZoneConfig[];
  /** De dónde salieron las zonas: registradas en la PWA o vistas en state/latest. */
  source: 'registradas' | 'estado';
}

/** Tope de zonas por ciclo para no agotar la cuota diaria del plan Spark. */
export const MAX_ZONES_PER_RUN = 60;

function isCrop(value: unknown): value is CropType {
  return value === 'jitomate' || value === 'lechuga';
}

/** Zonas registradas en la PWA, válidas y en orden natural (zona-2 antes que zona-10). */
export function zonesFromDocs(
  docs: { id: string; data: Record<string, unknown> }[],
): SimulatedZoneConfig[] {
  return docs
    .map((d) => parseZoneDoc(d.id, d.data))
    .filter((z): z is NonNullable<typeof z> => z !== null)
    .sort((a, b) => compareZoneIds(a.id, b.id))
    .map((z) => ({ zoneId: z.id, name: z.name, crop: z.crop }));
}

/** Zonas que ya mandan datos (claves de state/latest), con el cultivo que reportaron. */
export function zonesFromLatestState(latest: Record<string, unknown> | undefined): SimulatedZoneConfig[] {
  if (!latest) return [];
  return Object.entries(latest)
    .filter(([, value]) => value !== null && typeof value === 'object')
    .map(([zoneId, value]) => {
      const crop = (value as { crop?: unknown }).crop;
      return { zoneId, name: zoneId, crop: isCrop(crop) ? crop : 'jitomate' };
    })
    .sort((a, b) => compareZoneIds(a.zoneId, b.zoneId));
}

/** Elige las zonas de un invernadero: las registradas; si no hay, las que ya tenían datos. */
export function pickZones(
  registered: SimulatedZoneConfig[],
  fromState: SimulatedZoneConfig[],
): { zones: SimulatedZoneConfig[]; source: DiscoveredGreenhouse['source'] } {
  if (registered.length > 0) return { zones: registered, source: 'registradas' };
  return { zones: fromState, source: 'estado' };
}

/** Recorta la lista para respetar MAX_ZONES_PER_RUN, en el orden recibido. */
export function capZones(list: DiscoveredGreenhouse[], max = MAX_ZONES_PER_RUN): DiscoveredGreenhouse[] {
  const out: DiscoveredGreenhouse[] = [];
  let left = max;
  for (const gh of list) {
    if (left <= 0) break;
    const zones = gh.zones.slice(0, left);
    left -= zones.length;
    if (zones.length > 0) out.push({ ...gh, zones });
  }
  return out;
}

/** Lee de Firestore (Admin SDK) todos los invernaderos y sus zonas a simular. */
export async function discoverGreenhouses(db: Firestore): Promise<DiscoveredGreenhouse[]> {
  const snap = await db.collection('greenhouses').get();
  const result: DiscoveredGreenhouse[] = [];
  for (const doc of snap.docs) {
    const [zonesSnap, latestSnap] = await Promise.all([
      doc.ref.collection('zones').get(),
      doc.ref.collection('state').doc('latest').get(),
    ]);
    const registered = zonesFromDocs(zonesSnap.docs.map((z) => ({ id: z.id, data: z.data() })));
    const fromState = zonesFromLatestState(latestSnap.data());
    const { zones, source } = pickZones(registered, fromState);
    if (zones.length > 0) result.push({ greenhouseId: doc.id, zones, source });
  }
  return result.sort((a, b) => a.greenhouseId.localeCompare(b.greenhouseId));
}
