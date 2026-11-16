/**
 * Histórico (HU-07 #74, T7.2 #76): funciones puras de la página de histórico.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  downsample,
  parseHourlyDoc,
  parseReadingDoc,
  rangeStart,
  seriesValues,
  sortPoints,
  yDomain,
  type HistoryPoint,
} from '../src/lib/history.ts';

const fakeTimestamp = (iso: string) => ({ toDate: () => new Date(iso) });

describe('Histórico (T7.2 #76)', () => {
  it('calcula el inicio de 24 h y 7 días', () => {
    const now = new Date('2026-11-16T18:00:00Z');
    assert.equal(rangeStart('24h', now).toISOString(), '2026-11-15T18:00:00.000Z');
    assert.equal(rangeStart('7d', now).toISOString(), '2026-11-09T18:00:00.000Z');
  });

  it('lee una lectura cruda con Timestamp y acepta el campo viejo temperature', () => {
    const p = parseReadingDoc({
      zoneId: 'zona-1',
      timestamp: fakeTimestamp('2026-11-16T10:00:00Z'),
      temperature: 24.5,
      ph: 6.1,
      ec: '2.3',
      light: 'n/a',
    });
    assert.deepEqual(p, { t: Date.parse('2026-11-16T10:00:00Z'), airTemp: 24.5, ph: 6.1, ec: 2.3 });
  });

  it('descarta lecturas sin fecha', () => {
    assert.equal(parseReadingDoc({ ph: 6 }), null);
    assert.equal(parseHourlyDoc({ ph: { avg: 6 } }), null);
  });

  it('usa el promedio de cada variable en readingsHourly', () => {
    const p = parseHourlyDoc({
      zoneId: 'zona-1',
      hour: fakeTimestamp('2026-11-16T04:00:00Z'),
      count: 12,
      ph: { avg: 6.2, min: 6.0, max: 6.5 },
      tankLevel: { avg: 80, min: 79, max: 81 },
      humidity: { min: 50 },
    });
    assert.deepEqual(p, { t: Date.parse('2026-11-16T04:00:00Z'), ph: 6.2, tankLevel: 80 });
  });

  it('ordena por fecha y une puntos del mismo instante', () => {
    const sorted = sortPoints([
      { t: 3, ph: 6 },
      { t: 1, ph: 5 },
      { t: 3, ec: 2 },
    ]);
    assert.deepEqual(sorted, [{ t: 1, ph: 5 }, { t: 3, ph: 6, ec: 2 }]);
  });

  it('reduce la serie promediando grupos y sin inventar valores', () => {
    const points: HistoryPoint[] = Array.from({ length: 10 }, (_, i) => ({ t: i * 10, ph: i, ...(i < 4 ? { ec: 2 } : {}) }));
    const out = downsample(points, 5);
    assert.equal(out.length, 5);
    assert.deepEqual(out[0], { t: 5, ph: 0.5, ec: 2 });
    assert.deepEqual(out[4], { t: 85, ph: 8.5 });
    assert.equal(downsample(points, 20), points);
  });

  it('el eje Y incluye la banda ideal aunque los datos estén dentro', () => {
    const [lo, hi] = yDomain([6.0, 6.1], { min: 5.5, max: 6.5 });
    assert.ok(lo < 5.5 && hi > 6.5);
    const [lo2, hi2] = yDomain([7.4], { min: 5.5, max: 6.5 });
    assert.ok(hi2 > 7.4 && lo2 < 5.5);
    assert.deepEqual(seriesValues([{ t: 1, ph: 6 }, { t: 2 }], 'ph'), [6]);
  });
});
