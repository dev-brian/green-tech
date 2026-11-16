/**
 * Lectura del histórico en Firestore (T7.2 #76). Las funciones puras están en
 * `history.ts`.
 */
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  downsample,
  parseHourlyDoc,
  parseReadingDoc,
  rangeStart,
  sortPoints,
  type HistoryPoint,
  type HistoryRange,
} from './history';

/**
 * Tope de lecturas crudas para 24 h. Con el cron cada 5 min son 288; el tope
 * solo importa si alguien deja el simulador local enviando cada pocos segundos.
 */
const MAX_RAW_DOCS = 1500;

export async function fetchHistory(
  greenhouseId: string,
  zoneId: string,
  range: HistoryRange,
  now: Date = new Date(),
): Promise<HistoryPoint[]> {
  const since = Timestamp.fromDate(rangeStart(range, now));

  if (range === '7d') {
    // Promedios por hora: máximo 168 documentos (contrato §2.3).
    const snap = await getDocs(
      query(
        collection(db, 'greenhouses', greenhouseId, 'readingsHourly'),
        where('zoneId', '==', zoneId),
        where('hour', '>=', since),
        orderBy('hour', 'asc'),
      ),
    );
    return sortPoints(
      snap.docs.map((d) => parseHourlyDoc(d.data())).filter((p): p is HistoryPoint => p !== null),
    );
  }

  // 24 h: lecturas crudas, de la más nueva a la más vieja para que el tope
  // corte las más antiguas y no las de ahora (índice zoneId ASC, timestamp DESC).
  const snap = await getDocs(
    query(
      collection(db, 'greenhouses', greenhouseId, 'readings'),
      where('zoneId', '==', zoneId),
      where('timestamp', '>=', since),
      orderBy('timestamp', 'desc'),
      limit(MAX_RAW_DOCS),
    ),
  );
  const points = snap.docs
    .map((d) => parseReadingDoc(d.data()))
    .filter((p): p is HistoryPoint => p !== null);
  return downsample(sortPoints(points));
}

/** Mensaje claro para los errores que se pueden esperar. */
export function historyErrorMessage(err: unknown): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
  if (code === 'failed-precondition') {
    return 'Falta publicar los índices de Firestore (firebase deploy --only firestore:indexes).';
  }
  if (code === 'permission-denied') {
    return 'No tienes permiso para ver el histórico de este invernadero.';
  }
  if (code === 'unavailable') {
    return 'Sin conexión: no se pudo cargar el histórico. Intenta de nuevo cuando vuelva el internet.';
  }
  return 'No se pudo cargar el histórico. Intenta de nuevo.';
}
