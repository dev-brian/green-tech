import { useEffect, useState } from 'react';
import { getLocalReadings, subscribeToLocalTelemetry, type TelemetryReading } from '../lib/localTelemetry';

/**
 * Misma forma que `useTelemetry` (readings / latestReading / loading), pero
 * leyendo de localStorage en vez de Firestore. Ver `lib/localTelemetry.ts`.
 */
export function useLocalTelemetry(greenhouseId: string | null) {
  const [readings, setReadings] = useState<TelemetryReading[]>([]);

  useEffect(() => {
    if (!greenhouseId) {
      setReadings([]);
      return;
    }
    setReadings(getLocalReadings(greenhouseId));

    const unsubscribe = subscribeToLocalTelemetry((changedId) => {
      if (changedId === greenhouseId) setReadings(getLocalReadings(greenhouseId));
    });
    return unsubscribe;
  }, [greenhouseId]);

  const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;

  return { readings, latestReading, loading: false };
}
