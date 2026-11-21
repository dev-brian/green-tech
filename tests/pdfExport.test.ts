import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPdfSummary,
  buildPdfFilename,
  formatReadingsRange,
} from '../src/lib/pdfExport.ts';
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

describe('buildPdfSummary (HU-07, T7.4)', () => {
  it('devuelve una fila por cada una de las 7 variables', () => {
    const rows = buildPdfSummary([makeReading()]);
    assert.equal(rows.length, 7);
    assert.deepEqual(
      rows.map((r) => r.label),
      [
        'Temperatura del Aire (°C)',
        'Humedad Relativa (%)',
        'Luz Ambiental (lux)',
        'pH de la Solución',
        'Conductividad (EC) (mS/cm)',
        'Temp. de la Solución (°C)',
        'Nivel del Tanque (%)',
      ],
    );
  });

  it('calcula promedio, mínimo y máximo redondeados a 1 decimal', () => {
    const rows = buildPdfSummary([
      makeReading({ airTemp: 20 }),
      makeReading({ id: 'r2', airTemp: 30 }),
      makeReading({ id: 'r3', airTemp: 25.55 }),
    ]);
    const airTemp = rows.find((r) => r.label === 'Temperatura del Aire (°C)')!;
    assert.equal(airTemp.avg, 25.2); // (20+30+25.55)/3 = 25.183…
    assert.equal(airTemp.min, 20);
    assert.equal(airTemp.max, 30);
  });

  it('con lecturas vacías devuelve ninguna fila', () => {
    assert.deepEqual(buildPdfSummary([]), []);
  });
});

describe('buildPdfFilename', () => {
  it('normaliza la zona, usa la fecha y extensión .pdf', () => {
    const name = buildPdfFilename('Zona 1 · Lechuga NFT', new Date('2026-11-14T05:00:00Z'));
    assert.equal(name, 'greentech_historico_zona_1_lechuga_nft_2026-11-14.pdf');
  });

  it('usa "zona" cuando la etiqueta queda vacía', () => {
    const name = buildPdfFilename('·', new Date('2026-11-14T05:00:00Z'));
    assert.equal(name, 'greentech_historico_zona_2026-11-14.pdf');
  });
});

describe('formatReadingsRange', () => {
  it('muestra el primer y último timestamp de las lecturas', () => {
    const range = formatReadingsRange([
      makeReading({ timestamp: new Date('2026-11-13T08:00:00Z') }),
      makeReading({ id: 'r2', timestamp: new Date('2026-11-14T14:30:00Z') }),
      makeReading({ id: 'r3', timestamp: new Date('2026-11-14T10:00:00Z') }),
    ]);
    // Orden depende de la zona horaria local y del formato exacto del ICU;
    // solo verificamos ambos extremos por fecha.
    assert.ok(range.includes('–'), 'usa el separador de rango');
    assert.match(range, /13.?nov/i);
    assert.match(range, /14.?nov/i);
  });

  it('con lecturas vacías devuelve un guion', () => {
    assert.equal(formatReadingsRange([]), '—');
  });
});
