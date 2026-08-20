export type SensorStatus = 'green' | 'yellow' | 'red' | 'offline';

export const THRESHOLDS = {
  temperature: { redMin: 12, yellowMin: 18, yellowMax: 27, redMax: 32 },
  humidity: { redMin: 40, yellowMin: 60, yellowMax: 80, redMax: 90 },
  soilMoisture: { redMin: 40, yellowMin: 60, yellowMax: 80, redMax: 90 },
};

export function statusFor(
  value: number,
  t: { redMin: number; yellowMin: number; yellowMax: number; redMax: number }
): SensorStatus {
  if (value < t.redMin || value > t.redMax) return 'red';
  if (value < t.yellowMin || value > t.yellowMax) return 'yellow';
  return 'green';
}

// "El eslabón más débil": el estado combinado es el peor de las variables.
export function worstOf(...statuses: SensorStatus[]): SensorStatus {
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('yellow')) return 'yellow';
  return 'green';
}
