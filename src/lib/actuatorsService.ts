import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { compareZoneIds } from './zones';
import { parseActuatorsDoc, type ZoneActuators } from './actuators';

/**
 * Solo lectura de greenhouses/{greenhouseId}/actuators (auditoría A2).
 * El backend es el único que decide encender o apagar; la PWA no escribe aquí.
 */
export function subscribeToActuators(
  greenhouseId: string,
  onData: (zones: ZoneActuators[]) => void,
  onError: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, 'greenhouses', greenhouseId, 'actuators'),
    (snap) => {
      const zones = snap.docs
        .map((d) => parseActuatorsDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => compareZoneIds(a.zoneId, b.zoneId));
      onData(zones);
    },
    onError,
  );
}
