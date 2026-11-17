import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FUTURE_SKEW_MS,
  STALE_THRESHOLD_MS,
  isStaleAt,
  parseTimestamp,
  parseVariable,
  parseZone,
  withFreshness,
} from '../src/lib/zoneFreshness.ts';

const NOW = Date.parse('2026-11-17T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000);

const healthy = (timestamp: unknown) => ({
  timestamp,
  crop: 'lechuga',
  airTemp: { value: 22, level: 'ok' },
  humidity: { value: 65, level: 'ok' },
  light: { value: 15000, level: 'ok' },
  ph: { value: 6.0, level: 'ok' },
  ec: { value: 1.0, level: 'ok' },
  solutionTemp: { value: 20, level: 'ok' },
  tankLevel: { value: 80, level: 'ok' },
});

describe('vigencia de la zona (auditoría C2)', () => {
  it('una zona sana y reciente queda en verde', () => {
    const zone = withFreshness(parseZone('zona-1', healthy(minutesAgo(1))), NOW);
    assert.equal(zone.isStale, false);
    assert.equal(zone.overallStatus, 'green');
  });

  it('la misma lectura pasa a gris cuando avanza el reloj, sin snapshot nuevo', () => {
    const parsed = parseZone('zona-1', healthy(minutesAgo(1)));
    assert.equal(withFreshness(parsed, NOW).overallStatus, 'green');
    const later = NOW + STALE_THRESHOLD_MS + 60_000;
    const zone = withFreshness(parsed, later);
    assert.equal(zone.isStale, true);
    assert.equal(zone.overallStatus, 'offline');
    assert.equal(zone.ph.status, 'offline');
    // El último valor se conserva para mostrarlo, pero sin color.
    assert.equal(zone.ph.value, 6.0);
  });

  it('una lectura sin timestamp no se toma como reciente', () => {
    const zone = withFreshness(parseZone('zona-1', healthy(undefined)), NOW);
    assert.equal(zone.timestamp, null);
    assert.equal(zone.isStale, true);
    assert.equal(zone.overallStatus, 'offline');
  });

  it('un timestamp ilegible cuenta como ausente', () => {
    assert.equal(parseTimestamp('no es fecha'), null);
    assert.equal(parseTimestamp(''), null);
    assert.equal(parseTimestamp(12345), null);
    assert.equal(parseTimestamp(new Date('x')), null);
  });

  it('acepta Timestamp de Firestore (objeto con toDate)', () => {
    const d = minutesAgo(2);
    assert.equal(parseTimestamp({ toDate: () => d })?.getTime(), d.getTime());
  });

  it('una hora en el futuro más allá del margen no deja la zona en verde', () => {
    const future = new Date(NOW + MAX_FUTURE_SKEW_MS + 60_000);
    assert.equal(isStaleAt(future, NOW), true);
    assert.equal(isStaleAt(new Date(NOW + 60_000), NOW), false);
  });

  it('el límite es estricto: justo en el umbral sigue vigente', () => {
    assert.equal(isStaleAt(new Date(NOW - STALE_THRESHOLD_MS), NOW), false);
    assert.equal(isStaleAt(new Date(NOW - STALE_THRESHOLD_MS - 1), NOW), true);
  });
});

describe('variables faltantes (sin valores inventados)', () => {
  it('una variable ausente queda en "sin dato", no en un valor por defecto', () => {
    const raw = healthy(minutesAgo(1)) as Record<string, unknown>;
    delete raw.ph;
    const zone = withFreshness(parseZone('zona-1', raw), NOW);
    assert.equal(zone.ph.value, null);
    assert.equal(zone.ph.status, 'offline');
    // Las demás siguen evaluándose.
    assert.equal(zone.overallStatus, 'green');
  });

  it('value no numérico cuenta como ausente', () => {
    assert.deepEqual(parseVariable({ value: 'abc', level: 'ok' }, 'ph'), { value: null, status: 'offline' });
    assert.deepEqual(parseVariable({ value: null }, 'ph'), { value: null, status: 'offline' });
    assert.deepEqual(parseVariable(undefined, 'tankLevel'), { value: null, status: 'offline' });
  });

  it('el level del backend manda sobre la tabla local', () => {
    // EC 2.75 es "ok" para jitomate en el backend aunque la tabla genérica diga otra cosa.
    assert.equal(parseVariable({ value: 2.75, level: 'ok' }, 'ec').status, 'green');
  });

  it('un número suelto (documento de readings) se evalúa con la tabla local', () => {
    assert.equal(parseVariable(4.2, 'ph').status, 'red');
  });

  it('una zona sin ninguna variable queda en gris aunque sea reciente', () => {
    const zone = withFreshness(parseZone('zona-1', { timestamp: minutesAgo(1) }), NOW);
    assert.equal(zone.overallStatus, 'offline');
  });
});
