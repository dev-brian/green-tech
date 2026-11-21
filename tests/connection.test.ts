import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dataTimeLabel, newestDate, offlineBannerText } from '../src/lib/connection.ts';

/** T10.2 (#60) — "Sin conexión · datos de las HH:MM" (HU-10). */
describe('offlineBannerText (HU-10, T10.2)', () => {
  const now = new Date(2026, 10, 21, 18, 30);

  it('muestra la hora del dato en 24 h', () => {
    assert.equal(offlineBannerText(new Date(2026, 10, 21, 14, 5), now), 'Sin conexión · datos de las 14:05');
  });

  it('si el dato es de otro día, agrega la fecha', () => {
    const label = dataTimeLabel(new Date(2026, 10, 20, 9, 7), now);
    assert.match(label, /^20 nov, 09:07$/);
  });

  it('sin datos guardados lo dice', () => {
    assert.equal(offlineBannerText(null, now), 'Sin conexión · todavía no hay datos guardados en este equipo');
  });

  it('newestDate toma la más reciente e ignora nulos', () => {
    const a = new Date(2026, 10, 21, 10, 0);
    const b = new Date(2026, 10, 21, 11, 0);
    assert.equal(newestDate([a, null, b, undefined]), b);
    assert.equal(newestDate([]), null);
  });
});
