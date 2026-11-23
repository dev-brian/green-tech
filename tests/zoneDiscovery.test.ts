/**
 * El ciclo programado simula las zonas que cada invernadero registró en la PWA.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  capZones,
  pickZones,
  zonesFromDocs,
  zonesFromLatestState,
} from '../simulator/core/zoneDiscovery.ts';

describe('Descubrimiento de zonas para el simulador', () => {
  it('usa las zonas registradas con su cultivo, en orden natural', () => {
    const zones = zonesFromDocs([
      { id: 'zona-10', data: { name: 'Lechugas', crop: 'lechuga' } },
      { id: 'zona-2', data: { name: 'Tomate B', crop: 'jitomate' } },
      { id: 'zona-1', data: { name: 'Tomate A', crop: 'jitomate' } },
    ]);
    assert.deepEqual(
      zones.map((z) => [z.zoneId, z.crop]),
      [
        ['zona-1', 'jitomate'],
        ['zona-2', 'jitomate'],
        ['zona-10', 'lechuga'],
      ],
    );
  });

  it('descarta documentos de zona sin cultivo válido', () => {
    const zones = zonesFromDocs([
      { id: 'zona-1', data: { name: 'Ok', crop: 'lechuga' } },
      { id: 'zona-2', data: { name: 'Mal', crop: 'fresa' } },
    ]);
    assert.deepEqual(zones.map((z) => z.zoneId), ['zona-1']);
  });

  it('sin zonas registradas usa las de state/latest y su cultivo (jitomate por defecto)', () => {
    const zones = zonesFromLatestState({
      'zona-3': { crop: 'lechuga', color: 'green' },
      'zona-1': { color: 'yellow' },
      updatedAt: 'no es zona',
    });
    assert.deepEqual(
      zones.map((z) => [z.zoneId, z.crop]),
      [
        ['zona-1', 'jitomate'],
        ['zona-3', 'lechuga'],
      ],
    );
    assert.deepEqual(zonesFromLatestState(undefined), []);
  });

  it('prefiere las zonas registradas sobre las vistas en el estado', () => {
    const registered = [{ zoneId: 'zona-1', name: 'A', crop: 'lechuga' as const }];
    const fromState = [{ zoneId: 'zona-9', name: 'zona-9', crop: 'jitomate' as const }];
    assert.equal(pickZones(registered, fromState).source, 'registradas');
    assert.deepEqual(pickZones(registered, fromState).zones, registered);
    assert.equal(pickZones([], fromState).source, 'estado');
  });

  it('respeta el tope total de zonas por ciclo', () => {
    const gh = (id: string, n: number) => ({
      greenhouseId: id,
      source: 'registradas' as const,
      zones: Array.from({ length: n }, (_, i) => ({
        zoneId: `zona-${i + 1}`,
        name: `Z${i + 1}`,
        crop: 'jitomate' as const,
      })),
    });
    const capped = capZones([gh('a', 3), gh('b', 3), gh('c', 3)], 5);
    assert.deepEqual(
      capped.map((g) => [g.greenhouseId, g.zones.length]),
      [
        ['a', 3],
        ['b', 2],
      ],
    );
  });
});

describe('Zonas reales en el simulador interactivo', async () => {
  const { toSimZones, adaptScenarioZones } = await import('../greenhouse-sim/model/realZones.ts');
  const { BUILTIN_SCENARIOS } = await import('../greenhouse-sim/scenarios/library.ts');

  it('arma una nave por zona registrada con su cultivo', () => {
    const zones = toSimZones([
      { zoneId: 'zona-1', name: 'Tomate A', crop: 'jitomate' },
      { zoneId: 'zona-2', name: 'Lechugas', crop: 'lechuga' },
    ]);
    assert.deepEqual(
      zones.map((z) => [z.id, z.crop, z.system]),
      [
        ['zona-1', 'jitomate', 'DWC'],
        ['zona-2', 'lechuga', 'NFT'],
      ],
    );
  });

  it('los escenarios incluidos solo apuntan a zonas que existen', () => {
    const ids = ['mesa-a', 'mesa-b'];
    for (const scenario of BUILTIN_SCENARIOS) {
      for (const step of adaptScenarioZones(scenario, ids).steps) {
        const zone = (step.command as { zone?: string }).zone;
        if (zone !== undefined) assert.ok(zone === 'all' || ids.includes(zone), `${scenario.id}: ${zone}`);
      }
    }
  });

  it('con las zonas de ejemplo deja los escenarios igual', () => {
    const ids = ['zona-1', 'zona-2', 'zona-3'];
    for (const scenario of BUILTIN_SCENARIOS) {
      assert.deepEqual(adaptScenarioZones(scenario, ids), scenario);
    }
  });
});
