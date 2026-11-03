import { useEffect, useState } from 'react';
import { getLocalReadings, subscribeToLocalTelemetry, type TelemetryReading } from '../lib/localTelemetry';

function readFor(greenhouseId: string | null): TelemetryReading[] {
  return greenhouseId ? getLocalReadings(greenhouseId) : [];
}

/**
 * Misma forma que `useTelemetry` (readings / latestReading / loading), pero
 * leyendo de localStorage en vez de Firestore. Ver `lib/localTelemetry.ts`.
 */
export function useLocalTelemetry(greenhouseId: string | null) {
  const [state, setState] = useState(() => ({ id: greenhouseId, readings: readFor(greenhouseId) }));

  // Si cambia el invernadero, se recargan las lecturas durante el render
  // (patrón recomendado por React en lugar de setState dentro de un efecto).
  if (state.id !== greenhouseId) {
    setState({ id: greenhouseId, readings: readFor(greenhouseId) });
  }

  useEffect(() => {
    if (!greenhouseId) return;
    return subscribeToLocalTelemetry((changedId) => {
      if (changedId === greenhouseId) setState({ id: greenhouseId, readings: getLocalReadings(greenhouseId) });
    });
  }, [greenhouseId]);

  const readings = state.id === greenhouseId ? state.readings : readFor(greenhouseId);
  const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;

  return { readings, latestReading, loading: false };
}
