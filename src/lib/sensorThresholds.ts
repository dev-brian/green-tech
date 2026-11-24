export type SensorStatus = 'green' | 'yellow' | 'red' | 'offline';
export type BackendLevel = 'ok' | 'warn' | 'critical';

export type HydroponicVariable =
  | 'airTemp'
  | 'humidity'
  | 'light'
  | 'ph'
  | 'ec'
  | 'solutionTemp'
  | 'tankLevel';

export interface ThresholdRange {
  redMin: number;
  yellowMin: number;
  yellowMax: number;
  redMax: number;
}

export function statusFor(value: number, t: ThresholdRange): SensorStatus {
  if (value < t.redMin || value > t.redMax) return 'red';
  if (value < t.yellowMin || value > t.yellowMax) return 'yellow';
  return 'green';
}

export function levelToStatus(level: string | undefined): SensorStatus {
  if (level === 'critical' || level === 'red') return 'red';
  if (level === 'warn' || level === 'yellow') return 'yellow';
  if (level === 'ok' || level === 'green') return 'green';
  return 'offline';
}

// "El eslabón más débil": el estado combinado es el peor de las variables.
export function worstOf(...statuses: SensorStatus[]): SensorStatus {
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('yellow')) return 'yellow';
  if (statuses.includes('green')) return 'green';
  return 'offline';
}

export const worstStatus = worstOf;
