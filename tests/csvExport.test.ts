import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCsv,
  buildCsvFilename,
  CSV_HEADER,
  CSV_VARIABLES,
} from '../src/lib/csvExport.ts';
import type { TelemetryReading } from '../src/hooks/useTelemetry.ts';

/** Lectura de prueba con el formato de useTelemetry (contrato v0.2). */
function makeReading(overrides: Partial<TelemetryReading> = {}): TelemetryReading {
  return {
    id: 'reading-1',
    greenhouseId: 'gh-test',
    nodeId: 'ESP32-SIM',
    zoneId: 'zona-1',
    crop: 'jitomate',
    timestamp: new Date('2026-11-14T12:00:00.000Z'),
    airTemp: 24.1,
    humidity: 68,
    light: 32000,
    ph: 6.1,
    ec: 2.4,
    solutionTemp: 21.5,
    tankLevel: 84,
    semaphoreStatus: 'green',
    ...overrides,
  };
}

describe('buildCsv (HU-07, T7.3)', () => {
  it('empieza con BOM UTF-8 y el encabezado fecha,zona,variable,valor', () => {
    const csv = buildCsv([makeReading()]);
    assert.ok(csv.startsWith('\uFEFF'), 'debe llevar BOM para Excel');
    assert.equal(csv.slice(1).split('\n')[0], CSV_HEADER);
    assert.equal(CSV_HEADER, 'fecha,zona,variable,valor');
  });

  it('genera una fila por cada una de las 7 variables de cada lectura', () => {
    const csv = buildCsv([makeReading()]);
    const lines = csv.slice(1).split('\n');
    assert.equal(lines.length, 1 + CSV_VARIABLES.length);
    assert.equal(CSV_VARIABLES.length, 7);
  });

  it('escribe fecha ISO, zona, etiqueta y valor en cada fila', () => {
    const csv = buildCsv([makeReading()]);
    const lines = csv.slice(1).split('\n');
    assert.equal(
      lines[1],
      '2026-11-14T12:00:00.000Z,zona-1,Temperatura del Aire (°C),24.1',
    );
    assert.ok(lines.some((l) => l.endsWith(',pH de la Solución,6.1')));
    assert.ok(lines.some((l) => l.endsWith(',Nivel del Tanque (%),84')));
  });

  it('exporta todas las zonas de las lecturas recibidas', () => {
    const csv = buildCsv([
      makeReading({ zoneId: 'zona-1' }),
      makeReading({ id: 'reading-2', zoneId: 'zona-2' }),
    ]);
    const lines = csv.slice(1).split('\n');
    assert.equal(lines.length, 1 + 2 * CSV_VARIABLES.length);
    assert.ok(lines.slice(1).every((l) => l.includes(',zona-1,') || l.includes(',zona-2,')));
  });

  it('escapa comas y comillas de la zona (RFC 4180)', () => {
    const csv = buildCsv([makeReading({ zoneId: 'zona "norte", bloque A' })]);
    const lines = csv.slice(1).split('\n');
    assert.equal(
      lines[1],
      '2026-11-14T12:00:00.000Z,"zona ""norte"", bloque A",Temperatura del Aire (°C),24.1',
    );
  });

  it('con lecturas vacías devuelve solo el encabezado', () => {
    const csv = buildCsv([]);
    assert.equal(csv, '\uFEFF' + CSV_HEADER);
  });
});

describe('buildCsvFilename', () => {
  it('normaliza la zona y usa la fecha en el nombre', () => {
    const name = buildCsvFilename('Zona 1 · Lechuga NFT', new Date('2026-11-14T05:00:00Z'));
    assert.equal(name, 'greentech_historico_zona_1_lechuga_nft_2026-11-14.csv');
  });

  it('usa "zona" cuando la etiqueta queda vacía', () => {
    const name = buildCsvFilename('·', new Date('2026-11-14T05:00:00Z'));
    assert.equal(name, 'greentech_historico_zona_2026-11-14.csv');
  });
});
