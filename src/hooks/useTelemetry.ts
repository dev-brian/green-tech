import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { HydroponicVariable } from '../lib/sensorThresholds';
import {
  FRESHNESS_TICK_MS,
  ZONE_VARIABLES,
  parseTimestamp,
  parseZone,
  withFreshness,
  type ParsedZone,
  type ZoneLatestState,
} from '../lib/zoneFreshness';
import { useNow } from './useNow';

export type { ZoneLatestState, ZoneVariableState } from '../lib/zoneFreshness';

export type TelemetryReading = {
  id: string;
  zoneId: string;
  crop?: string;
  timestamp: Date;
} & Record<HydroponicVariable, number | null>;

/** Lo que guardan las suscripciones; se descarta solo si cambia el invernadero. */
interface Snapshot<T> {
  greenhouseId: string;
  data: T;
}

export function useTelemetry(greenhouseId: string | null) {
  const [readingsSnap, setReadingsSnap] = useState<Snapshot<TelemetryReading[]> | null>(null);
  const [stateSnap, setStateSnap] = useState<Snapshot<Record<string, ParsedZone>> | null>(null);
  const [fallbackSnap, setFallbackSnap] = useState<Snapshot<Record<string, ParsedZone>> | null>(null);
  // Auditoría C2: la vigencia se recalcula con el reloj, no solo al llegar un snapshot.
  const now = useNow(FRESHNESS_TICK_MS);

  useEffect(() => {
    if (!greenhouseId) return;

    // 1. Documento resumen greenhouses/{id}/state/latest (T4.1 / T8.3)
    const stateRef = doc(db, 'greenhouses', greenhouseId, 'state', 'latest');
    const unsubState = onSnapshot(
      stateRef,
      (snap) => {
        const zones: Record<string, ParsedZone> = {};
        if (snap.exists()) {
          for (const [key, val] of Object.entries(snap.data() as Record<string, unknown>)) {
            if (key === 'updatedAt' || !val || typeof val !== 'object') continue;
            zones[key] = parseZone(key, val as Record<string, unknown>);
          }
        }
        setStateSnap({ greenhouseId, data: zones });
      },
      (err) => {
        console.error('Error fetching state/latest:', err);
        setStateSnap({ greenhouseId, data: {} });
      },
    );

    // 2. Últimas lecturas greenhouses/{id}/readings (gráficas y respaldo por zona)
    const q = query(
      collection(db, 'greenhouses', greenhouseId, 'readings'),
      orderBy('timestamp', 'desc'),
      limit(90),
    );
    const unsubReadings = onSnapshot(
      q,
      (snapshot) => {
        const newestFirst: TelemetryReading[] = [];
        const fallback: Record<string, ParsedZone> = {};
        for (const docSnap of snapshot.docs) {
          const d = docSnap.data() as Record<string, unknown>;
          const zoneId = String(d.zoneId ?? d.sector ?? 'zona-1');
          const parsed = parseZone(zoneId, d, (v) => (v === 'airTemp' ? d.airTemp ?? d.temperature : d[v]));
          // La primera lectura (más reciente) de cada zona sirve de respaldo si
          // state/latest no la trae.
          if (!fallback[zoneId]) fallback[zoneId] = parsed;
          // Sin hora no se puede ubicar en la gráfica.
          const timestamp = parseTimestamp(d.timestamp);
          if (!timestamp) continue;
          const reading = { id: docSnap.id, zoneId, crop: parsed.crop, timestamp } as TelemetryReading;
          for (const v of ZONE_VARIABLES) reading[v] = parsed.variables[v].value;
          newestFirst.push(reading);
        }
        setReadingsSnap({ greenhouseId, data: newestFirst.reverse() });
        setFallbackSnap({ greenhouseId, data: fallback });
      },
      (error) => {
        console.error('Error fetching telemetry readings:', error);
        setReadingsSnap({ greenhouseId, data: [] });
        setFallbackSnap({ greenhouseId, data: {} });
      },
    );

    return () => {
      unsubState();
      unsubReadings();
    };
  }, [greenhouseId]);

  // Al cambiar de invernadero no se muestran, ni por un momento, los datos del anterior.
  const current = <T,>(snap: Snapshot<T> | null): T | null =>
    snap && snap.greenhouseId === greenhouseId ? snap.data : null;
  const readings = current(readingsSnap);
  const stateZones = current(stateSnap);
  const fallbackZones = current(fallbackSnap);

  // state/latest manda; las lecturas solo cubren zonas que no estén ahí.
  const zonesById = useMemo(() => {
    const merged = { ...(fallbackZones ?? {}), ...(stateZones ?? {}) };
    const out: Record<string, ZoneLatestState> = {};
    for (const [id, zone] of Object.entries(merged)) out[id] = withFreshness(zone, now);
    return out;
  }, [fallbackZones, stateZones, now]);

  const activeReadings = readings ?? [];
  return {
    readings: activeReadings,
    latestReading: activeReadings.length > 0 ? activeReadings[activeReadings.length - 1] : null,
    zonesById,
    loading: greenhouseId ? readings === null && stateZones === null : false,
  };
}
