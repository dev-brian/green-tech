/**
 * Zonas de cultivo (HU-04 #63): utilidades de la PWA (T4.1 #64, T4.2 #65)
 * y uso del cultivo de la zona en el motor de ingesta.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeZoneIds,
  nextZoneId,
  normalizeZoneName,
  parseZoneDoc,
  zoneDisplayName,
  zoneLabel,
} from '../src/lib/zones.ts';
import { InMemoryTelemetryStorage, processIngestedReading } from '../simulator/core/alertAndActuatorEngine.ts';

describe('Utilidades de zonas (T4.1 #64 / T4.2 #65)', () => {
  it('propone el siguiente id libre zona-N contando zonas registradas y las que mandan datos', () => {
    assert.equal(nextZoneId([]), 'zona-1');
    assert.equal(nextZoneId(['zona-1', 'zona-3', 'mesa-a']), 'zona-4');
    assert.equal(nextZoneId(['zona-9', 'zona-10']), 'zona-11');
  });

  it('limpia el nombre y rechaza vacíos o de más de 60 caracteres', () => {
    assert.equal(normalizeZoneName('  Mesa   norte '), 'Mesa norte');
    assert.equal(normalizeZoneName('   '), null);
    assert.equal(normalizeZoneName('x'.repeat(61)), null);
  });

  it('muestra el nombre del admin o uno derivado del id', () => {
    const zones = { 'zona-1': { name: 'Mesa norte', crop: 'lechuga' as const } };
    assert.equal(zoneDisplayName('zona-1', zones), 'Mesa norte');
    assert.equal(zoneDisplayName('zona-2', zones), 'Zona 2');
    assert.equal(zoneLabel('zona-1', zones, 'jitomate'), 'Mesa norte · Lechuga');
    assert.equal(zoneLabel('zona-2', zones, 'jitomate'), 'Zona 2 · Jitomate');
    assert.equal(zoneLabel('zona-5', undefined), 'Zona 5');
  });

  it('ignora documentos de zona incompletos o con cultivo desconocido', () => {
    assert.deepEqual(parseZoneDoc('zona-1', { name: 'A', crop: 'lechuga' }), {
      id: 'zona-1',
      name: 'A',
      crop: 'lechuga',
      createdAt: null,
    });
    assert.equal(parseZoneDoc('zona-1', { name: 'A', crop: 'albahaca' }), null);
    assert.equal(parseZoneDoc('zona-1', { crop: 'lechuga' }), null);
  });

  it('el filtro junta zonas registradas y vistas, sin repetir y en orden natural', () => {
    assert.deepEqual(mergeZoneIds(['zona-2', 'zona-10'], ['zona-1', 'zona-2'], ['']), ['zona-1', 'zona-2', 'zona-10']);
  });
});

describe('HU-04 (#63) — cada zona usa los umbrales de su cultivo', () => {
  const base = {
    greenhouseId: 'gh-1',
    zoneId: 'zona-1',
    timestamp: '2026-11-15T06:00:00.000Z',
    // EC 1.0 mS/cm: baja para jitomate, normal para lechuga.
    readings: { airTemp: 21, humidity: 65, light: 20000, ph: 6.0, ec: 1.0, solutionTemp: 20, tankLevel: 80 },
  };

  it('sin zona registrada usa el cultivo que manda el sensor', async () => {
    const storage = new InMemoryTelemetryStorage();
    const result = await processIngestedReading({ ...base, crop: 'jitomate' }, storage);
    assert.equal(result.zoneState.crop, 'jitomate');
    assert.notEqual(result.zoneState.ec.level, 'ok');
  });

  it('con zona registrada, el cultivo del admin manda sobre el del sensor y la alerta lleva su nombre', async () => {
    const storage = new InMemoryTelemetryStorage();
    storage.zones['gh-1'] = { 'zona-1': { name: 'Mesa norte', crop: 'lechuga' } };
    const asLettuce = await processIngestedReading({ ...base, crop: 'jitomate' }, storage);
    assert.equal(asLettuce.zoneState.crop, 'lechuga');
    assert.equal(asLettuce.zoneState.ec.level, 'ok');

    storage.zones['gh-1']['zona-1'].crop = 'jitomate';
    const asTomato = await processIngestedReading({ ...base, crop: 'lechuga' }, storage);
    assert.equal(asTomato.zoneState.crop, 'jitomate');
    const ecAlert = asTomato.createdAlerts.find((a) => a.variable === 'ec');
    assert.ok(ecAlert, 'debe crear alerta de EC con umbrales de jitomate');
    assert.match(ecAlert.message, /Mesa norte/);
  });
});
