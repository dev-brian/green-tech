import { useEffect, useRef } from 'react';
import { useTelemetry } from './useTelemetry';
import { useLocalTelemetry } from './useLocalTelemetry';
import { useAuth } from '../context/AuthContext';
import { THRESHOLDS, statusFor } from '../lib/sensorThresholds';
import {
  createAlert,
  hasActiveAlert,
  type AlertVariable,
  type AlertSeverity,
} from '../lib/alertsService';
import type { TelemetryReading } from '../lib/localTelemetry';

/**
 * Mientras `firestore.rules` no esté publicado en la consola de Firebase
 * (ver error "Missing or insufficient permissions"), el Dashboard y el
 * panel de Datos de Prueba usan datos guardados localmente en el
 * navegador en vez de Firestore. Cambia esto a `false` cuando las reglas
 * ya estén publicadas y las escrituras a Firestore funcionen.
 */
export const USE_LOCAL_DEMO_DATA = true;

// ─── Mapa de variables a generar alertas ───────────────────────────────────

const ALERT_VARIABLES: {
  key: AlertVariable;
  getter: (r: TelemetryReading) => number;
  label: string;
  unit: string;
}[] = [
  { key: 'temperature',  getter: (r) => r.temperature,  label: 'Temperatura',       unit: '°C' },
  { key: 'humidity',     getter: (r) => r.humidity,      label: 'Humedad relativa',  unit: '%'  },
  { key: 'soilMoisture', getter: (r) => r.soilMoisture,  label: 'Humedad de suelo',  unit: '%'  },
];

// ─── Hook de auto-alertas ─────────────────────────────────────────────────────

/**
 * Escucha las últimas lecturas de telemetría y crea alertas en Firestore
 * cuando se detecta un estado rojo o amarillo.
 * Anti-spam: no crea una nueva alerta si ya existe una activa ('new')
 * para la misma variable y sector.
 */
function useAutoAlerts(
  latestReading: TelemetryReading | null,
  greenhouseId: string | null,
) {
  const lastProcessedId = useRef<string | null>(null);

  useEffect(() => {
    if (!latestReading || !greenhouseId) return;
    if (latestReading.id === lastProcessedId.current) return;
    lastProcessedId.current = latestReading.id;

    // Procesar cada variable
    for (const { key, getter, label, unit } of ALERT_VARIABLES) {
      const value = getter(latestReading);
      const status = statusFor(value, THRESHOLDS[key]);

      if (status === 'green' || status === 'offline') continue;

      const severity: AlertSeverity = status === 'red' ? 'red' : 'yellow';
      const sector = latestReading.sector || 'General';

      // Anti-spam asíncrono: verificar si ya hay alerta activa
      hasActiveAlert(greenhouseId, sector, key).then((exists) => {
        if (exists) return;
        createAlert({
          greenhouseId,
          sector,
          variable: key,
          severity,
          message: `${label} ${severity === 'red' ? 'crítica' : 'en precaución'}: ${value}${unit}`,
          value,
        }).catch((err) => {
          // En modo demo local o sin permisos de Firestore, silenciar el error
          if (import.meta.env.DEV) {
            console.debug('[useAutoAlerts] No se pudo crear alerta en Firestore:', (err as { code?: string })?.code ?? err);
          }
        });
      }).catch(() => {
        // Silenciar errores de permisos en modo demo
      });
    }
  }, [latestReading, greenhouseId]);
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useTelemetrySource(greenhouseId: string | null) {
  const { user } = useAuth();

  // Ambos hooks se llaman siempre (Rules of Hooks); el que no se usa
  // recibe `null` y no hace trabajo.
  const remote = useTelemetry(USE_LOCAL_DEMO_DATA ? null : greenhouseId);
  const local  = useLocalTelemetry(USE_LOCAL_DEMO_DATA ? greenhouseId : null);

  const result = USE_LOCAL_DEMO_DATA ? local : remote;

  // Auto-generar alertas en Firestore cuando hay un usuario autenticado
  // y hay lecturas nuevas con estado fuera de rango.
  useAutoAlerts(user ? result.latestReading : null, greenhouseId);

  return result;
}

