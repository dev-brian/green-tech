import type { HydroponicVariable } from '../../model/types.ts';

const DECIMALS: Record<HydroponicVariable, number> = {
  airTemp: 1,
  humidity: 0,
  light: 0,
  ph: 2,
  ec: 2,
  solutionTemp: 1,
  tankLevel: 0,
};

export function formatValue(variable: HydroponicVariable, value: number): string {
  if (variable === 'light') return Math.round(value).toLocaleString('es-MX');
  return value.toFixed(DECIMALS[variable]);
}

export function formatClock(simTimeMs: number): string {
  return new Date(simTimeMs).toLocaleString('es-MX', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatAgo(timestamp: number | null, now: number): string {
  if (timestamp === null) return 'nunca';
  const s = Math.max(0, Math.round((now - timestamp) / 1000));
  if (s < 2) return 'ahora';
  return `hace ${formatDuration(s)}`;
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('es-MX', { hour12: false });
}
