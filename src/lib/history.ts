/**
 * Histórico de lecturas (HU-07 #74, T7.2 #76).
 *
 * Funciones puras, sin Firebase, para que `node --test` las pruebe sin el SDK
 * del navegador. El acceso a Firestore está en `historyService.ts`.
 *
 * - 24 h: lecturas crudas de `greenhouses/{id}/readings` (contrato §2.2).
 * - 7 días: promedios por hora de `greenhouses/{id}/readingsHourly`
 *   (contrato §2.3), así se leen como máximo 168 documentos por zona.
 */
import type { HydroponicVariable } from './sensorThresholds';

export type HistoryRange = '24h' | '7d';

export const HISTORY_RANGES: { value: HistoryRange; label: string; hours: number }[] = [
  { value: '24h', label: 'Últimas 24 horas', hours: 24 },
  { value: '7d', label: 'Últimos 7 días', hours: 24 * 7 },
];

/** Las 7 variables, en el mismo orden que el dashboard. */
export const HISTORY_VARIABLES: HydroponicVariable[] = [
  'airTemp',
  'humidity',
  'light',
  'ph',
  'ec',
  'solutionTemp',
  'tankLevel',
];

/** Un punto de la gráfica: `t` en milisegundos y el valor de cada variable. */
export type HistoryPoint = { t: number } & Partial<Record<HydroponicVariable, number>>;

/** Máximo de puntos que se dibujan; con más, la línea no se ve mejor y pesa. */
export const MAX_CHART_POINTS = 288;

export function rangeHours(range: HistoryRange): number {
  return HISTORY_RANGES.find((r) => r.value === range)?.hours ?? 24;
}

/** Desde cuándo se piden datos para el rango elegido. */
export function rangeStart(range: HistoryRange, now: Date): Date {
  return new Date(now.getTime() - rangeHours(range) * 60 * 60 * 1000);
}

/** Acepta Timestamp de Firestore, Date, texto ISO o milisegundos. */
export function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate();
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function finite(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** Documento de `readings` → punto. Null si no trae fecha. */
export function parseReadingDoc(data: Record<string, unknown>): HistoryPoint | null {
  const date = toDate(data.timestamp);
  if (!date) return null;
  const point: HistoryPoint = { t: date.getTime() };
  for (const v of HISTORY_VARIABLES) {
    // Lecturas viejas guardaban la temperatura del aire como `temperature`.
    const value = finite(data[v] ?? (v === 'airTemp' ? data.temperature : undefined));
    if (value !== undefined) point[v] = value;
  }
  return point;
}

/** Documento de `readingsHourly` → punto con el promedio de cada variable. */
export function parseHourlyDoc(data: Record<string, unknown>): HistoryPoint | null {
  const date = toDate(data.hour);
  if (!date) return null;
  const point: HistoryPoint = { t: date.getTime() };
  for (const v of HISTORY_VARIABLES) {
    const stats = data[v];
    if (stats && typeof stats === 'object' && 'avg' in stats) {
      const value = finite((stats as { avg: unknown }).avg);
      if (value !== undefined) point[v] = value;
    }
  }
  return point;
}

/** Ordena por fecha y quita puntos repetidos en el mismo instante. */
export function sortPoints(points: HistoryPoint[]): HistoryPoint[] {
  const byTime = new Map<number, HistoryPoint>();
  for (const p of points) byTime.set(p.t, { ...byTime.get(p.t), ...p });
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

/**
 * Reduce la serie a `max` puntos promediando grupos consecutivos.
 * Cada variable se promedia solo con los valores que existen en el grupo.
 */
export function downsample(points: HistoryPoint[], max = MAX_CHART_POINTS): HistoryPoint[] {
  if (max < 1 || points.length <= max) return points;
  const size = Math.ceil(points.length / max);
  const out: HistoryPoint[] = [];
  for (let i = 0; i < points.length; i += size) {
    const group = points.slice(i, i + size);
    const point: HistoryPoint = { t: Math.round(group.reduce((s, p) => s + p.t, 0) / group.length) };
    for (const v of HISTORY_VARIABLES) {
      const values = group.map((p) => p[v]).filter((x): x is number => x !== undefined);
      if (values.length > 0) point[v] = values.reduce((s, x) => s + x, 0) / values.length;
    }
    out.push(point);
  }
  return out;
}

/** Valores de una variable en la serie, sin huecos. */
export function seriesValues(points: HistoryPoint[], variable: HydroponicVariable): number[] {
  return points.map((p) => p[variable]).filter((x): x is number => x !== undefined);
}

/**
 * Rango del eje Y: incluye los datos y la banda ideal, para que las líneas de
 * umbral siempre se vean, con un margen de 10 %.
 */
export function yDomain(
  values: number[],
  ideal: { min: number; max: number },
): [number, number] {
  const lo = Math.min(ideal.min, ...values);
  const hi = Math.max(ideal.max, ...values);
  const pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.1 || 1;
  return [lo - pad, hi + pad];
}
