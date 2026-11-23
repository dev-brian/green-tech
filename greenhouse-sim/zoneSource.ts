/**
 * De dónde salen las zonas del simulador interactivo.
 *
 * Con la cuenta de servicio de Firebase en .env.local, se leen las zonas que el
 * invernadero (GREENHOUSE_ID) registró en la PWA, con su cultivo. Sin cuenta de
 * servicio, o con --zonas=ejemplo, se usan las 3 zonas de ejemplo.
 */

import { toSimZones } from './model/realZones.ts';
import type { ZoneConfig } from './model/types.ts';
import { DEFAULT_ZONES } from './model/world.ts';

export type ZoneMode = 'auto' | 'ejemplo';

export interface ZoneSourceResult {
  zones: ZoneConfig[];
  /** Explicación corta para el registro de arranque. */
  origin: string;
}

function hasFirebaseCredentials(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

export async function loadZones(greenhouseId: string, mode: ZoneMode): Promise<ZoneSourceResult> {
  if (mode === 'ejemplo') return { zones: DEFAULT_ZONES, origin: 'zonas de ejemplo (--zonas=ejemplo)' };
  if (!hasFirebaseCredentials()) {
    return {
      zones: DEFAULT_ZONES,
      origin: 'zonas de ejemplo (sin FIREBASE_SERVICE_ACCOUNT no se pueden leer las del invernadero)',
    };
  }
  try {
    // Import diferido: el simulador no carga firebase-admin si no lo necesita.
    const [{ initFirestoreAdmin }, discovery] = await Promise.all([
      import('../simulator/core/firestoreStorage.ts'),
      import('../simulator/core/zoneDiscovery.ts'),
    ]);
    const ref = initFirestoreAdmin().collection('greenhouses').doc(greenhouseId);
    const [zonesSnap, latestSnap] = await Promise.all([
      ref.collection('zones').get(),
      ref.collection('state').doc('latest').get(),
    ]);
    const registered = discovery.zonesFromDocs(zonesSnap.docs.map((d) => ({ id: d.id, data: d.data() })));
    const fromState = discovery.zonesFromLatestState(latestSnap.data());
    const { zones, source } = discovery.pickZones(registered, fromState);
    if (zones.length === 0) {
      return {
        zones: DEFAULT_ZONES,
        origin: `zonas de ejemplo (${greenhouseId} aún no tiene zonas registradas en la PWA)`,
      };
    }
    const label = source === 'registradas' ? 'registradas en la PWA' : 'que ya mandaban datos';
    return { zones: toSimZones(zones), origin: `${zones.length} zonas de ${greenhouseId} ${label}` };
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    return { zones: DEFAULT_ZONES, origin: `zonas de ejemplo (no se pudo leer Firestore: ${why})` };
  }
}
