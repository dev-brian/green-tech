import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateReadings,
  hourBucketStart,
  hourlyDocId,
  mergeIntoHourly,
  retentionCutoffs,
} from '../simulator/core/hourlyAggregation.ts';
import {
  InMemoryTelemetryStorage,
  processIngestedReading,
} from '../simulator/core/alertAndActuatorEngine.ts';
import type { HydroponicReadings } from '../simulator/core/hydroponicModel.ts';

const base: HydroponicReadings = {
  airTemp: 22,
  humidity: 65,
  light: 30000,
  ph: 6.0,
  ec: 2.4,
  solutionTemp: 21,
  tankLevel: 80,
};

describe('T7.1 (#75) — Promedios por hora (readingsHourly)', () => {
  it('agrupa por hora UTC con id {zoneId}_{yyyyMMddHH}', () => {
    assert.equal(hourlyDocId('zona-1', '2026-11-15T04:59:59.000Z'), 'zona-1_2026111504');
    assert.equal(hourlyDocId('zona-2', '2026-01-02T23:00:00.000Z'), 'zona-2_2026010223');
    assert.equal(hourBucketStart('2026-11-15T04:37:12.345Z').toISOString(), '2026-11-15T04:00:00.000Z');
    assert.throws(() => hourlyDocId('zona-1', 'no-es-fecha'));
  });

  it('calcula avg, min y max de forma incremental', () => {
    const a = mergeIntoHourly(null, 'zona-1', '2026-11-15T04:01:00.000Z', { ...base, ph: 6.0 });
    const b = mergeIntoHourly(a, 'zona-1', '2026-11-15T04:02:00.000Z', { ...base, ph: 7.0 });
    const c = mergeIntoHourly(b, 'zona-1', '2026-11-15T04:03:00.000Z', { ...base, ph: 5.0 });

    assert.equal(c.count, 3);
    assert.equal(c.hour, '2026-11-15T04:00:00.000Z');
    assert.equal(c.zoneId, 'zona-1');
    assert.ok(Math.abs(c.ph.avg - 6.0) < 1e-9);
    assert.equal(c.ph.min, 5.0);
    assert.equal(c.ph.max, 7.0);
    assert.deepEqual(c.tankLevel, { avg: 80, min: 80, max: 80 });
  });

  it('cada lectura ingerida actualiza el documento de su zona y hora', async () => {
    const storage = new InMemoryTelemetryStorage();
    const ingest = (zoneId: string, timestamp: string, ph: number) =>
      processIngestedReading(
        { greenhouseId: 'gh-1', zoneId, crop: 'lechuga', timestamp, readings: { ...base, ph } },
        storage,
      );

    await ingest('zona-1', '2026-11-15T04:10:00.000Z', 6.0);
    await ingest('zona-1', '2026-11-15T04:20:00.000Z', 6.4);
    await ingest('zona-1', '2026-11-15T05:00:00.000Z', 5.8);
    await ingest('zona-2', '2026-11-15T04:30:00.000Z', 6.1);

    const hourly = storage.hourly['gh-1'];
    assert.deepEqual(Object.keys(hourly).sort(), [
      'zona-1_2026111504',
      'zona-1_2026111505',
      'zona-2_2026111504',
    ]);
    assert.equal(hourly['zona-1_2026111504'].count, 2);
    assert.ok(Math.abs(hourly['zona-1_2026111504'].ph.avg - 6.2) < 1e-9);
    assert.equal(hourly['zona-1_2026111505'].count, 1);
  });

  it('el relleno da el mismo resultado que la ingesta en línea, sin importar el orden', () => {
    const rows = [
      { zoneId: 'zona-1', timestamp: '2026-11-15T04:20:00.000Z', ...base, ec: 2.0 },
      { zoneId: 'zona-1', timestamp: '2026-11-15T04:10:00.000Z', ...base, ec: 3.0 },
    ];
    const aggs = aggregateReadings(rows);
    const doc = aggs.get('zona-1_2026111504');
    assert.ok(doc);
    assert.equal(doc.count, 2);
    assert.ok(Math.abs(doc.ec.avg - 2.5) < 1e-9);
    assert.equal(doc.ec.min, 2.0);
    assert.equal(doc.ec.max, 3.0);
  });

  it('purga lecturas de más de 7 días y promedios de más de 30', async () => {
    const storage = new InMemoryTelemetryStorage();
    const now = new Date('2026-11-30T12:00:00.000Z');
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
    const ingest = (timestamp: string) =>
      processIngestedReading(
        { greenhouseId: 'gh-1', zoneId: 'zona-1', crop: 'jitomate', timestamp, readings: base },
        storage,
      );

    await ingest(daysAgo(40)); // fuera de los dos plazos
    await ingest(daysAgo(10)); // lectura vieja, promedio todavía vigente
    await ingest(daysAgo(1)); // vigente en los dos

    const result = await storage.pruneExpired('gh-1', now);
    assert.deepEqual(result, { readingsDeleted: 2, hourlyDeleted: 1 });
    assert.equal(storage.readings['gh-1'].length, 1);
    assert.equal(Object.keys(storage.hourly['gh-1']).length, 2);

    const cut = retentionCutoffs(now);
    assert.equal(cut.readingsBefore.toISOString(), '2026-11-23T12:00:00.000Z');
    assert.equal(cut.hourlyBefore.toISOString(), '2026-10-31T12:00:00.000Z');
  });
});
