import { useTelemetry } from './useTelemetry';
import { useLocalTelemetry } from './useLocalTelemetry';

/**
 * Mientras `firestore.rules` no esté publicado en la consola de Firebase
 * (ver error "Missing or insufficient permissions"), el Dashboard y el
 * panel de Datos de Prueba usan datos guardados localmente en el
 * navegador en vez de Firestore. Cambia esto a `false` cuando las reglas
 * ya estén publicadas y las escrituras a Firestore funcionen.
 */
export const USE_LOCAL_DEMO_DATA = true;

export function useTelemetrySource(greenhouseId: string | null) {
  // Ambos hooks se llaman siempre (Rules of Hooks); el que no se usa
  // recibe `null` y no hace trabajo.
  const remote = useTelemetry(USE_LOCAL_DEMO_DATA ? null : greenhouseId);
  const local = useLocalTelemetry(USE_LOCAL_DEMO_DATA ? greenhouseId : null);

  return USE_LOCAL_DEMO_DATA ? local : remote;
}
