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
 * - Si la lectura no trae `level` del backend, el color se calcula con los
 *   umbrales del cultivo de la zona (T5.1 #44): los que el admin guardó en el
 *   invernadero o, si no hay, el perfil por defecto del cultivo.
 */
import {
  levelToStatus,
  statusFor,
  worstOf,
  type HydroponicVariable,
  type SensorStatus,
  type ThresholdRange,
} from './sensorThresholds.ts';
import { defaultThresholdsFor } from './cropProfiles.ts';

/** Umbrales de las 7 variables para un cultivo. */
export type VariableThresholds = Record<HydroponicVariable, ThresholdRange>;

/** Devuelve los umbrales que aplican a una zona (según su cultivo). */
export type ThresholdsResolver = (zone: { zoneId: string; crop?: string }) => VariableThresholds;

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

/** Una variable tal como viene en la lectura, antes de evaluarla. */
export interface ParsedVariable {
  /** null = la lectura no trajo esta variable ("sin dato"). */
  value: number | null;
  /** Estado que calculó el backend; null si la lectura no lo trae. */
  level: SensorStatus | null;
}

/** Lo que se lee de Firestore, antes de aplicar umbrales y reloj. */
export interface ParsedZone {
  zoneId: string;
  crop?: string;
  /** null = la lectura no trae una hora válida. */
  timestamp: Date | null;
  variables: Record<HydroponicVariable, ParsedVariable>;
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

/** Acepta `{ value, level }` (state/latest) o un número suelto (readings). */
export function readVariable(raw: unknown): ParsedVariable {
  if (raw && typeof raw === 'object' && 'value' in raw) {
    const obj = raw as { value?: unknown; level?: unknown };
    const value = toFiniteNumber(obj.value);
    if (value === null) return { value: null, level: null };
    return { value, level: typeof obj.level === 'string' ? levelToStatus(obj.level) : null };
  }
  return { value: toFiniteNumber(raw), level: null };
}

/** El `level` que calculó el backend tiene prioridad sobre los umbrales locales. */
export function evaluateVariable(parsed: ParsedVariable, range: ThresholdRange): ZoneVariableState {
  if (parsed.value === null) return { value: null, status: 'offline' };
  return { value: parsed.value, status: parsed.level ?? statusFor(parsed.value, range) };
}

/**
 * Lee y evalúa una variable. Sin `range` usa el perfil por defecto de jitomate,
 * el mismo que usa el backend cuando una lectura no trae `crop`.
 */
export function parseVariable(
  raw: unknown,
  variable: HydroponicVariable,
  range: ThresholdRange = defaultThresholdsFor()[variable],
): ZoneVariableState {
  return evaluateVariable(readVariable(raw), range);
}

/** Convierte una entrada de state/latest o un documento de readings. */
export function parseZone(
  zoneId: string,
  raw: Record<string, unknown>,
  pick: (variable: HydroponicVariable) => unknown = (v) => raw[v],
): ParsedZone {
  const variables = {} as Record<HydroponicVariable, ParsedVariable>;
  for (const v of ZONE_VARIABLES) variables[v] = readVariable(pick(v));
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

/**
 * Aplica los umbrales de la zona y el reloj: una zona vieja pasa entera a gris.
 * Sin `thresholds` usa el perfil por defecto del cultivo de la zona.
 */
export function withFreshness(
  zone: ParsedZone,
  nowMs: number,
  thresholds: VariableThresholds = defaultThresholdsFor(zone.crop),
): ZoneLatestState {
  const isStale = isStaleAt(zone.timestamp, nowMs);
  const out = {
    zoneId: zone.zoneId,
    crop: zone.crop,
    timestamp: zone.timestamp,
    isStale,
  } as ZoneLatestState;
  for (const v of ZONE_VARIABLES) {
    const s = evaluateVariable(zone.variables[v], thresholds[v]);
    out[v] = isStale ? { value: s.value, status: 'offline' } : s;
  }
  out.overallStatus = isStale ? 'offline' : worstOf(...ZONE_VARIABLES.map((v) => out[v].status));
  return out;
}
