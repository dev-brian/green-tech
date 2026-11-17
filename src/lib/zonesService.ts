import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { compareZoneIds, parseZoneDoc, type Zone, type ZoneCrop } from './zones';

/**
 * Acceso a greenhouses/{greenhouseId}/zones (T4.1 #64).
 * Leer: cualquier miembro. Crear, editar y borrar: solo el admin
 * (lo valida `firestore.rules`).
 */

function zonesRef(greenhouseId: string) {
  return collection(db, 'greenhouses', greenhouseId, 'zones');
}

export function subscribeToZones(
  greenhouseId: string,
  onData: (zones: Zone[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    zonesRef(greenhouseId),
    (snap) => {
      const zones = snap.docs
        .map((d) => parseZoneDoc(d.id, d.data() as Record<string, unknown>))
        .filter((z): z is Zone => z !== null)
        .sort((a, b) => compareZoneIds(a.id, b.id));
      onData(zones);
    },
    (err) => onError?.(err),
  );
}

/** Crea la zona con el id que usará el sensor (por ejemplo `zona-4`). */
export async function createZone(
  greenhouseId: string,
  zoneId: string,
  data: { name: string; crop: ZoneCrop },
): Promise<void> {
  await setDoc(doc(zonesRef(greenhouseId), zoneId), {
    name: data.name,
    crop: data.crop,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateZone(
  greenhouseId: string,
  zoneId: string,
  data: { name: string; crop: ZoneCrop },
): Promise<void> {
  await updateDoc(doc(zonesRef(greenhouseId), zoneId), {
    name: data.name,
    crop: data.crop,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Borra la zona. Las lecturas y alertas viejas se quedan (se purgan solas
 * por la retención); si el sensor sigue mandando datos, la zona vuelve a
 * aparecer como "sin registrar".
 */
export async function deleteZone(greenhouseId: string, zoneId: string): Promise<void> {
  await deleteDoc(doc(zonesRef(greenhouseId), zoneId));
}
