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

export const THRESHOLDS: Record<HydroponicVariable, ThresholdRange> = {
  airTemp:      { redMin: 12,   yellowMin: 18,   yellowMax: 28,    redMax: 33 },
  humidity:     { redMin: 40,   yellowMin: 55,   yellowMax: 80,    redMax: 90 },
  light:        { redMin: 2000, yellowMin: 8000, yellowMax: 35000, redMax: 45000 },
  ph:           { redMin: 5.0,  yellowMin: 5.5,  yellowMax: 6.5,   redMax: 7.0 },
  ec:           { redMin: 0.8,  yellowMin: 1.2,  yellowMax: 2.4,   redMax: 3.0 },
  solutionTemp: { redMin: 14,   yellowMin: 18,   yellowMax: 24,    redMax: 27 },
  tankLevel:    { redMin: 20,   yellowMin: 40,   yellowMax: 100,   redMax: 100 },
};

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
