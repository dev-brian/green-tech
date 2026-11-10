import { useTelemetry } from './useTelemetry';

/**
 * T11.4 (#29) & T6.2 (#49):
 * El Dashboard lee exclusivamente de Firestore:
 * - `greenhouses/{id}/state/latest` para el estado actual por zona y modo offline
 * - `greenhouses/{id}/readings` para las gráficas históricas de las 7 variables hidropónicas
 * Se eliminó la generación de lecturas y alertas desde el navegador y OpenWeatherMap.
 */
export const USE_LOCAL_DEMO_DATA = false;

export function useTelemetrySource(greenhouseId: string | null) {
  return useTelemetry(USE_LOCAL_DEMO_DATA ? null : greenhouseId);
}
