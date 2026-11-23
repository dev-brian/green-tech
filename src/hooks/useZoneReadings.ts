import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toTelemetryReading, type TelemetryReading } from './useTelemetry';

/** Lecturas recientes de una sola zona para las gráficas del tablero. */
const ZONE_CHART_LIMIT = 60;

interface Result {
  key: string;
  readings: TelemetryReading[];
  error: string | null;
}

/**
 * Auditoría A6: consulta por zona (índice readings zoneId ASC + timestamp DESC,
 * el mismo del histórico) en vez de repartir 90 lecturas entre todas las zonas.
 */
export function useZoneReadings(greenhouseId: string | null, zoneId: string | null) {
  const key = greenhouseId && zoneId ? `${greenhouseId}/${zoneId}` : '';
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!greenhouseId || !zoneId) return;
    const k = `${greenhouseId}/${zoneId}`;
    const q = query(
      collection(db, 'greenhouses', greenhouseId, 'readings'),
      where('zoneId', '==', zoneId),
      orderBy('timestamp', 'desc'),
      limit(ZONE_CHART_LIMIT),
    );
    return onSnapshot(
      q,
      (snap) => {
        const readings = snap.docs
          .map((d) => toTelemetryReading(d.id, d.data() as Record<string, unknown>))
          .filter((r): r is TelemetryReading => r !== null)
          .reverse();
        setResult({ key: k, readings, error: null });
      },
      (err) => {
        console.error('Error leyendo lecturas de la zona:', err);
        const code = (err as { code?: string }).code;
        setResult({
          key: k,
          readings: [],
          error:
            code === 'failed-precondition'
              ? 'Falta publicar los índices de Firestore para ver la gráfica.'
              : 'No se pudieron cargar las lecturas de esta zona.',
        });
      },
    );
  }, [greenhouseId, zoneId]);

  const current = result && result.key === key ? result : null;
  return {
    readings: current?.readings ?? [],
    error: current?.error ?? null,
    loading: key !== '' && current === null,
  };
}
