import { useTelemetry } from './useTelemetry';
import { useLocalTelemetry } from './useLocalTelemetry';

/**
 * T11.4 (#29): Se desactiva el modo de datos locales del navegador.
 * El Dashboard lee directamente de Firestore con reglas seguras.
 * T6.2 (#49): Se elimina la creación de alertas desde el navegador;
 * las alertas las crea exclusivamente el motor del backend (T6.1 / T6.3).
 */
export const USE_LOCAL_DEMO_DATA = false;

export function useTelemetrySource(greenhouseId: string | null) {
  const remote = useTelemetry(USE_LOCAL_DEMO_DATA ? null : greenhouseId);
  const local = useLocalTelemetry(USE_LOCAL_DEMO_DATA ? greenhouseId : null);

  return USE_LOCAL_DEMO_DATA ? local : remote;
}
