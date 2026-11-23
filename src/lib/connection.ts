/**
 * T10.2 (#60) — Texto del aviso de conexión (HU-10).
 *
 * Criterio: "en modo avión veo el último estado y un aviso
 * 'Sin conexión · datos de las HH:MM'". La hora es la del dato más reciente
 * que la PWA tiene guardado (no la hora actual), para que quede claro qué tan
 * viejo es lo que se ve.
 *
 * Módulo puro para probarlo con `node --test`.
 */

const TIME_FMT = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
const DAY_FMT = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "14:05", o "20 nov, 14:05" si el dato no es de hoy. */
export function dataTimeLabel(latest: Date, now: Date = new Date()): string {
  const time = TIME_FMT.format(latest);
  return sameDay(latest, now) ? time : `${DAY_FMT.format(latest).replace('.', '')}, ${time}`;
}

export function offlineBannerText(latest: Date | null, now: Date = new Date()): string {
  if (!latest) return 'Sin conexión · todavía no hay datos guardados en este equipo';
  return `Sin conexión · datos de las ${dataTimeLabel(latest, now)}`;
}

/** Fecha más reciente de una lista (ignora nulos). */
export function newestDate(dates: Iterable<Date | null | undefined>): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (d && !Number.isNaN(d.getTime()) && (!best || d > best)) best = d;
  }
  return best;
}
