/**
 * Vigencia de las lecturas por zona (auditoría C2, issue #71).
 *
 * Lógica pura, sin Firebase, para poder probarla con `node --test`.
 *
 * Reglas:
 * - Una zona pasa a "sin datos" (gris) cuando su última lectura tiene más de
 *   STALE_THRESHOLD_MS. La vigencia se vuelve a calcular con el reloj
 *   (useNow), no solo cuando llega un snapshot: si el sensor deja de enviar,
 *   no llega ningún snapshot y antes la pantalla se quedaba en verde.
 * - Una lectura sin `timestamp` (o con uno ilegible) no se toma como reciente:
 *   la zona queda en gris.
 * - Una hora más de MAX_FUTURE_SKEW_MS en el futuro tampoco cuenta como dato
 *   válido, para que un reloj mal puesto no deje la zona en verde para siempre.
 * - Si falta una variable se muestra "sin dato" (value null, gris), nunca un
 *   valor inventado que caiga en rango.
 */
import {
  THRESHOLDS,
  levelToStatus,
  statusFor,
  worstOf,
  type HydroponicVariable,
  type SensorStatus,
} from './sensorThresholds.ts';

/**
 * 15 minutos: tres ciclos del motor de alertas, que corre cada 5 min en un cron
 * de GitHub que suele retrasarse varios minutos. Con 5 min la zona parpadearía
 * entre "en orden" y "sin datos" entre una corrida y otra.
 */
export const STALE_THRESHOLD_MS = 15 * 60 * 1000;
export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
/** Cada cuánto se vuelve a calcular la vigencia en pantalla. */
export const FRESHNESS_TICK_MS = 30 * 1000;

export const ZONE_VARIABLES: readonly HydroponicVariable[] = [
  'airTemp',
  'humidity',
  'light',
  'ph',
  'ec',
  'solutionTemp',
  'tankLevel',
];

export interface ZoneVariableState {
  /** null = la lectura no trajo esta variable ("sin dato"). */
  value: number | null;
  status: SensorStatus;
}

/** Lo que se lee de Firestore, antes de aplicar el reloj. */
export interface ParsedZone {
  zoneId: string;
  crop?: string;
  /** null = la lectura no trae una hora válida. */
  timestamp: Date | null;
  /** Estado de cada variable según la lectura, sin contar la vigencia. */
  variables: Record<HydroponicVariable, ZoneVariableState>;
}

export type ZoneLatestState = {
  zoneId: string;
  crop?: string;
  timestamp: Date | null;
  isStale: boolean;
  overallStatus: SensorStatus;
} & Record<HydroponicVariable, ZoneVariableState>;

/** Firestore Timestamp, Date o texto ISO. Cualquier otra cosa es null. */
export function parseTimestamp(raw: unknown): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (raw && typeof raw === 'object' && typeof (raw as { toDate?: unknown }).toDate === 'function') {
    const d = (raw as { toDate: () => unknown }).toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function toFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Acepta `{ value, level }` (state/latest) o un número suelto (readings).
 * El `level` que calculó el backend tiene prioridad sobre la tabla local.
 */
export function parseVariable(raw: unknown, variable: HydroponicVariable): ZoneVariableState {
  if (raw && typeof raw === 'object' && 'value' in raw) {
    const obj = raw as { value?: unknown; level?: unknown };
    const value = toFiniteNumber(obj.value);
    if (value === null) return { value: null, status: 'offline' };
    const status =
      typeof obj.level === 'string' ? levelToStatus(obj.level) : statusFor(value, THRESHOLDS[variable]);
    return { value, status };
  }
  const value = toFiniteNumber(raw);
  if (value === null) return { value: null, status: 'offline' };
  return { value, status: statusFor(value, THRESHOLDS[variable]) };
}

/** Convierte una entrada de state/latest o un documento de readings. */
export function parseZone(
  zoneId: string,
  raw: Record<string, unknown>,
  pick: (variable: HydroponicVariable) => unknown = (v) => raw[v],
): ParsedZone {
  const variables = {} as Record<HydroponicVariable, ZoneVariableState>;
  for (const v of ZONE_VARIABLES) variables[v] = parseVariable(pick(v), v);
  return {
    zoneId,
    crop: typeof raw.crop === 'string' ? raw.crop : undefined,
    timestamp: parseTimestamp(raw.timestamp),
    variables,
  };
}

/** ¿La lectura ya no sirve para decir "en orden"? */
export function isStaleAt(timestamp: Date | null, nowMs: number): boolean {
  if (!timestamp) return true;
  const age = nowMs - timestamp.getTime();
  return age > STALE_THRESHOLD_MS || age < -MAX_FUTURE_SKEW_MS;
}

/** Aplica el reloj: una zona vieja pasa entera a gris. */
export function withFreshness(zone: ParsedZone, nowMs: number): ZoneLatestState {
  const isStale = isStaleAt(zone.timestamp, nowMs);
  const out = {
    zoneId: zone.zoneId,
    crop: zone.crop,
    timestamp: zone.timestamp,
    isStale,
  } as ZoneLatestState;
  for (const v of ZONE_VARIABLES) {
    const s = zone.variables[v];
    out[v] = isStale ? { value: s.value, status: 'offline' } : s;
  }
  out.overallStatus = isStale ? 'offline' : worstOf(...ZONE_VARIABLES.map((v) => out[v].status));
  return out;
}
