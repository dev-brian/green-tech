/**
 * Promedios por hora de las lecturas (T7.1 #75).
 *
 * Cada lectura que entra por /ingestTelemetry se suma al documento
 * greenhouses/{id}/readingsHourly/{zoneId}_{yyyyMMddHH} (hora UTC) con
 * { avg, min, max } por variable y el número de lecturas (count).
 * Las gráficas de 7 y 30 días de la PWA y de la app leen esta colección
 * en vez de miles de lecturas crudas (docs/contrato-datos.md, 2.3).
 */

import {
  VARIABLE_KEYS,
  type HydroponicReadings,
  type HydroponicVariable,
} from './hydroponicModel.ts';

/** Las lecturas crudas se conservan 7 días (contrato 2.2). */
export const READINGS_RETENTION_DAYS = 7;
/** Los promedios por hora se conservan 30 días (contrato 2.3). */
export const HOURLY_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface VariableStats {
  avg: number;
  min: number;
  max: number;
}

export type HourlyAggregate = {
  zoneId: string;
  /** Inicio de la hora en ISO 8601 (UTC). */
  hour: string;
  count: number;
} & Record<HydroponicVariable, VariableStats>;

/** Inicio de la hora UTC de una fecha. */
export function hourBucketStart(timestamp: string | Date): Date {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Fecha inválida para agrupar por hora: ${String(timestamp)}`);
  }
  d.setUTCMinutes(0, 0, 0);
  return d;
}

/** Id del documento: {zoneId}_{yyyyMMddHH} con la hora en UTC. */
export function hourlyDocId(zoneId: string, timestamp: string | Date): string {
  const h = hourBucketStart(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${h.getUTCFullYear()}${pad(h.getUTCMonth() + 1)}${pad(h.getUTCDate())}${pad(h.getUTCHours())}`;
  return `${zoneId}_${stamp}`;
}

/**
 * Suma una lectura al promedio de su hora. `prev` es el documento que ya
 * existe para esa zona y hora, o null si es la primera lectura de la hora.
 * El promedio se actualiza de forma incremental, sin guardar la suma.
 */
export function mergeIntoHourly(
  prev: HourlyAggregate | null,
  zoneId: string,
  timestamp: string,
  readings: HydroponicReadings,
): HourlyAggregate {
  const hour = hourBucketStart(timestamp).toISOString();
  const count = (prev?.count ?? 0) + 1;
  const next = { zoneId, hour, count } as HourlyAggregate;

  for (const key of VARIABLE_KEYS) {
    const value = readings[key];
    const old = prev?.[key];
    next[key] = old
      ? {
          avg: old.avg + (value - old.avg) / count,
          min: Math.min(old.min, value),
          max: Math.max(old.max, value),
        }
      : { avg: value, min: value, max: value };
  }
  return next;
}

/**
 * Agrupa una lista de lecturas en promedios por zona y hora.
 * Lo usa el relleno de datos viejos (simulator/backfillHourly.ts).
 */
export function aggregateReadings(
  readings: Array<{ zoneId: string; timestamp: string } & HydroponicReadings>,
): Map<string, HourlyAggregate> {
  const byDoc = new Map<string, HourlyAggregate>();
  const sorted = [...readings].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const r of sorted) {
    const id = hourlyDocId(r.zoneId, r.timestamp);
    byDoc.set(id, mergeIntoHourly(byDoc.get(id) ?? null, r.zoneId, r.timestamp, r));
  }
  return byDoc;
}

/** Fechas de corte: lo anterior a ellas se borra. */
export function retentionCutoffs(now: Date = new Date()): {
  readingsBefore: Date;
  hourlyBefore: Date;
} {
  return {
    readingsBefore: new Date(now.getTime() - READINGS_RETENTION_DAYS * DAY_MS),
    hourlyBefore: new Date(now.getTime() - HOURLY_RETENTION_DAYS * DAY_MS),
  };
}
