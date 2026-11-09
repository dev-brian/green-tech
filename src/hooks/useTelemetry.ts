import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  THRESHOLDS,
  statusFor,
  worstStatus,
  levelToStatus,
  type HydroponicVariable,
  type SensorStatus,
} from '../lib/sensorThresholds';

export interface TelemetryReading {
  id: string;
  greenhouseId: string;
  nodeId: string;
  zoneId: string;
  crop?: string;
  timestamp: Date;
  airTemp: number;
  humidity: number;
  light: number;
  ph: number;
  ec: number;
  solutionTemp: number;
  tankLevel: number;
  semaphoreStatus: 'green' | 'yellow' | 'red';
}

export interface ZoneVariableState {
  value: number;
  status: SensorStatus;
}

export interface ZoneLatestState {
  zoneId: string;
  crop?: string;
  timestamp: Date;
  isStale: boolean;
  overallStatus: SensorStatus;
  airTemp: ZoneVariableState;
  humidity: ZoneVariableState;
  light: ZoneVariableState;
  ph: ZoneVariableState;
  ec: ZoneVariableState;
  solutionTemp: ZoneVariableState;
  tankLevel: ZoneVariableState;
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos sin lectura -> offline (gris)

function parseTimestamp(raw: unknown): Date {
  if (raw instanceof Timestamp) return raw.toDate();
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string') {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function parseZoneVar(
  rawVar: unknown,
  fallbackNum: number,
  variable: HydroponicVariable,
  isStale: boolean,
): ZoneVariableState {
  if (rawVar && typeof rawVar === 'object' && 'value' in rawVar) {
    const obj = rawVar as { value?: unknown; level?: unknown };
    const value = Number(obj.value ?? fallbackNum);
    const computed =
      typeof obj.level === 'string'
        ? levelToStatus(obj.level)
        : statusFor(value, THRESHOLDS[variable]);
    return {
      value,
      status: isStale ? 'offline' : computed,
    };
  }
  const value = typeof rawVar === 'number' ? rawVar : fallbackNum;
  return {
    value,
    status: isStale ? 'offline' : statusFor(value, THRESHOLDS[variable]),
  };
}

export function useTelemetry(greenhouseId: string | null) {
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [stateDocZones, setStateDocZones] = useState<Record<string, ZoneLatestState>>({});
  const [fallbackZones, setFallbackZones] = useState<Record<string, ZoneLatestState>>({});
  const [fetchingReadings, setFetchingReadings] = useState(true);
  const [fetchingState, setFetchingState] = useState(true);

  useEffect(() => {
    if (!greenhouseId) return;

    // 1. Suscripción al documento resumen greenhouses/{id}/state/latest (T4.1 / T8.3)
    const stateRef = doc(db, 'greenhouses', greenhouseId, 'state', 'latest');
    const unsubState = onSnapshot(
      stateRef,
      (snap) => {
        if (!snap.exists()) {
          setStateDocZones({});
          setFetchingState(false);
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        const zones: Record<string, ZoneLatestState> = {};

        for (const [key, val] of Object.entries(data)) {
          if (key === 'updatedAt' || !val || typeof val !== 'object') continue;
          const z = val as Record<string, unknown>;
          const timestamp = parseTimestamp(z.timestamp);
          const isStale = Date.now() - timestamp.getTime() > STALE_THRESHOLD_MS;

          const airTemp = parseZoneVar(z.airTemp, 22, 'airTemp', isStale);
          const humidity = parseZoneVar(z.humidity, 65, 'humidity', isStale);
          const light = parseZoneVar(z.light, 15000, 'light', isStale);
          const ph = parseZoneVar(z.ph, 6.0, 'ph', isStale);
          const ec = parseZoneVar(z.ec, 1.8, 'ec', isStale);
          const solutionTemp = parseZoneVar(z.solutionTemp, 20, 'solutionTemp', isStale);
          const tankLevel = parseZoneVar(z.tankLevel, 80, 'tankLevel', isStale);

          const overallStatus: SensorStatus = isStale
            ? 'offline'
            : worstStatus(
                airTemp.status,
                humidity.status,
                light.status,
                ph.status,
                ec.status,
                solutionTemp.status,
                tankLevel.status,
              );

          zones[key] = {
            zoneId: key,
            crop: typeof z.crop === 'string' ? z.crop : undefined,
            timestamp,
            isStale,
            overallStatus,
            airTemp,
            humidity,
            light,
            ph,
            ec,
            solutionTemp,
            tankLevel,
          };
        }

        setStateDocZones(zones);
        setFetchingState(false);
      },
      (err) => {
        console.error('Error fetching state/latest:', err);
        setFetchingState(false);
      },
    );

    // 2. Suscripción al histórico greenhouses/{id}/readings
    const q = query(
      collection(db, 'greenhouses', greenhouseId, 'readings'),
      orderBy('timestamp', 'desc'),
      limit(90),
    );

    const unsubReadings = onSnapshot(
      q,
      (snapshot) => {
        const data: TelemetryReading[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const airTemp = Number(d.airTemp ?? d.temperature ?? 0);
          const humidity = Number(d.humidity ?? 0);
          const light = Number(d.light ?? 0);
          const ph = Number(d.ph ?? 6.0);
          const ec = Number(d.ec ?? 1.6);
          const solutionTemp = Number(d.solutionTemp ?? airTemp);
          const tankLevel = Number(d.tankLevel ?? 80);

          const worst = worstStatus(
            statusFor(airTemp, THRESHOLDS.airTemp),
            statusFor(humidity, THRESHOLDS.humidity),
            statusFor(light, THRESHOLDS.light),
            statusFor(ph, THRESHOLDS.ph),
            statusFor(ec, THRESHOLDS.ec),
            statusFor(solutionTemp, THRESHOLDS.solutionTemp),
            statusFor(tankLevel, THRESHOLDS.tankLevel),
          );

          return {
            id: docSnap.id,
            greenhouseId,
            nodeId: String(d.nodeId ?? 'ESP32-SIM'),
            zoneId: String(d.zoneId ?? d.sector ?? 'zona-1'),
            crop: typeof d.crop === 'string' ? d.crop : undefined,
            timestamp: parseTimestamp(d.timestamp),
            airTemp,
            humidity,
            light,
            ph,
            ec,
            solutionTemp,
            tankLevel,
            semaphoreStatus:
              worst === 'red' || worst === 'yellow' ? worst : 'green',
          };
        });

        const chronological = [...data].reverse();
        const nowMs = Date.now();
        const computedFallbacks: Record<string, ZoneLatestState> = {};
        for (let i = chronological.length - 1; i >= 0; i--) {
          const r = chronological[i];
          if (!computedFallbacks[r.zoneId]) {
            const isStale = nowMs - r.timestamp.getTime() > STALE_THRESHOLD_MS;
            const airTemp = parseZoneVar(r.airTemp, r.airTemp, 'airTemp', isStale);
            const humidity = parseZoneVar(r.humidity, r.humidity, 'humidity', isStale);
            const light = parseZoneVar(r.light, r.light, 'light', isStale);
            const ph = parseZoneVar(r.ph, r.ph, 'ph', isStale);
            const ec = parseZoneVar(r.ec, r.ec, 'ec', isStale);
            const solutionTemp = parseZoneVar(r.solutionTemp, r.solutionTemp, 'solutionTemp', isStale);
            const tankLevel = parseZoneVar(r.tankLevel, r.tankLevel, 'tankLevel', isStale);

            computedFallbacks[r.zoneId] = {
              zoneId: r.zoneId,
              crop: r.crop,
              timestamp: r.timestamp,
              isStale,
              overallStatus: isStale
                ? 'offline'
                : worstStatus(
                    airTemp.status,
                    humidity.status,
                    light.status,
                    ph.status,
                    ec.status,
                    solutionTemp.status,
                    tankLevel.status,
                  ),
              airTemp,
              humidity,
              light,
              ph,
              ec,
              solutionTemp,
              tankLevel,
            };
          }
        }
        setReadings(chronological);
        setFallbackZones(computedFallbacks);
        setFetchingReadings(false);
      },
      (error) => {
        console.error('Error fetching telemetry readings:', error);
        setFetchingReadings(false);
      },
    );

    return () => {
      unsubState();
      unsubReadings();
    };
  }, [greenhouseId]);

  // Combinar zonas de state/latest con fallback de readings si falta alguna zona
  const zonesById = useMemo(() => {
    if (!greenhouseId) return {};
    return { ...fallbackZones, ...stateDocZones };
  }, [greenhouseId, fallbackZones, stateDocZones]);

  const activeReadings = greenhouseId ? readings : [];
  const latestReading =
    activeReadings.length > 0 ? activeReadings[activeReadings.length - 1] : null;
  const activeLoading = greenhouseId ? fetchingReadings && fetchingState : false;

  return {
    readings: activeReadings,
    latestReading,
    zonesById,
    loading: activeLoading,
  };
}
