import type { TelemetryReading } from '../hooks/useTelemetry';

/**
 * T7.3 (#77) — Exportación del histórico a CSV (parte de HU-07).
 *
 * Formato "largo" con las columnas que pide la historia de usuario:
 * `fecha,zona,variable,valor` — una fila por cada una de las 7 variables
 * hidropónicas de cada lectura (contrato v0.2, docs/contrato-datos.md §2.1).
 *
 * `buildCsv` es puro (no toca el DOM) para poder probarlo con `node --test`;
 * la descarga real vive en `downloadCsv`.
 */

/** Clave numérica de una lectura que se exporta al CSV. */
export type CsvVariableKey =
  | 'airTemp'
  | 'humidity'
  | 'light'
  | 'ph'
  | 'ec'
  | 'solutionTemp'
  | 'tankLevel';

/** Las 7 variables del contrato v0.2 con su etiqueta para el archivo. */
export const CSV_VARIABLES: ReadonlyArray<{ key: CsvVariableKey; label: string }> = [
  { key: 'airTemp', label: 'Temperatura del Aire (°C)' },
  { key: 'humidity', label: 'Humedad Relativa (%)' },
  { key: 'light', label: 'Luz Ambiental (lux)' },
  { key: 'ph', label: 'pH de la Solución' },
  { key: 'ec', label: 'Conductividad (EC) (mS/cm)' },
  { key: 'solutionTemp', label: 'Temp. de la Solución (°C)' },
  { key: 'tankLevel', label: 'Nivel del Tanque (%)' },
];

/** Encabezado que pide HU-07: fecha, zona, variable, valor. */
export const CSV_HEADER = 'fecha,zona,variable,valor';

/** Escapa un campo CSV según RFC 4180 (comas, comillas y saltos de línea). */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Genera el contenido del CSV con BOM UTF-8 para que Excel reconozca
 * los acentos (ñ, á, °). Una fila por variable de cada lectura.
 */
export function buildCsv(readings: ReadonlyArray<TelemetryReading>): string {
  const rows: string[] = [CSV_HEADER];

  for (const r of readings) {
    const fecha = r.timestamp.toISOString();
    const zona = csvEscape(r.zoneId);
    for (const { key, label } of CSV_VARIABLES) {
      rows.push(`${fecha},${zona},${csvEscape(label)},${r[key]}`);
    }
  }

  return '\uFEFF' + rows.join('\n');
}

/** Nombre de archivo: `greentech_historico_<zona>_<AAAA-MM-DD>.csv`. */
export function buildCsvFilename(zoneLabel: string, now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  const safeZone =
    zoneLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'zona';
  return `greentech_historico_${safeZone}_${stamp}.csv`;
}

/** Genera el CSV y dispara su descarga en el navegador. */
export function downloadCsv(
  readings: ReadonlyArray<TelemetryReading>,
  zoneLabel: string,
): void {
  const blob = new Blob([buildCsv(readings)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildCsvFilename(zoneLabel);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
