import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import {
  DEFAULT_CROP_THRESHOLDS,
  evaluateLevel,
  validateIngestPayload,
} from '../simulator/core/hydroponicModel.ts';
import { InMemoryTelemetryStorage } from '../simulator/core/alertAndActuatorEngine.ts';
import { createIngestHttpServer } from '../simulator/server.ts';
import { buildIngestPayload, measure, seededRng } from '../greenhouse-sim/devices/sensorNode.ts';
import { applyCommand, parseCommand } from '../greenhouse-sim/model/commands.ts';
import { DEVICE_IDS, VARIABLES, type WorldState } from '../greenhouse-sim/model/types.ts';
import { createWorld, stepWorld, trueReadings } from '../greenhouse-sim/model/world.ts';
import { Publisher } from '../greenhouse-sim/publisher/publisher.ts';
import { BUILTIN_SCENARIOS } from '../greenhouse-sim/scenarios/library.ts';
import {
  advanceRun,
  isRunFinished,
  parseScenario,
  runDurationSec,
  startRun,
  stopRun,
} from '../greenhouse-sim/scenarios/runner.ts';
import { Simulation } from '../greenhouse-sim/simulation.ts';

const START = new Date('2026-11-14T10:00:00').getTime();
const KEY = 'test-device-key-sim';
const ZONE_IDS = ['zona-1', 'zona-2', 'zona-3'];

/** Semáforo del backend aplicado al estado real de una zona. */
function levelOf(world: WorldState, zoneId: string, variable: (typeof VARIABLES)[number]) {
  const zone = world.zones.find((z) => z.config.id === zoneId)!;
  return evaluateLevel(trueReadings(zone)[variable], DEFAULT_CROP_THRESHOLDS[zone.config.crop][variable]);
}

function scenario(id: string) {
  const found = BUILTIN_SCENARIOS.find((s) => s.id === id);
  assert.ok(found, `falta el escenario ${id}`);
  return found;
}

async function withIngest<T>(
  fn: (ctx: { url: string; storage: InMemoryTelemetryStorage }) => Promise<T>,
): Promise<T> {
  const storage = new InMemoryTelemetryStorage();
  const { server } = createIngestHttpServer({ deviceKey: KEY, storage });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    return await fn({ url, storage });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('Simulador interactivo — modelo físico', () => {
  it('en operación normal las 7 variables se quedan en verde durante 48 horas', () => {
    const world = createWorld(START);
    for (let minute = 0; minute < 48 * 60; minute++) {
      stepWorld(world, 60);
      for (const zone of world.zones) {
        for (const key of VARIABLES) {
          assert.equal(
            levelOf(world, zone.config.id, key),
            'ok',
            `${zone.config.id}.${key} = ${trueReadings(zone)[key]} en el minuto ${minute}`,
          );
        }
      }
    }
  });

  it('"Sube el pH": pasa a amarillo, luego a rojo y se recupera al reponer el ácido', () => {
    const world = createWorld(START);
    stepWorld(world, 3600);
    const run = startRun(scenario('sube-ph'));
    const seen = new Set<string>();
    for (let t = 0; t <= runDurationSec(run) + 3600; t += 60) {
      advanceRun(run, world, 60);
      stepWorld(world, 60);
      seen.add(levelOf(world, 'zona-1', 'ph'));
      assert.equal(levelOf(world, 'zona-2', 'ph'), 'ok', 'las otras zonas no se alteran');
    }
    assert.ok(seen.has('warn') && seen.has('critical'));
    assert.equal(levelOf(world, 'zona-1', 'ph'), 'ok');
    assert.ok(isRunFinished(run));
  });

  it('corte de luz de noche: se apagan los equipos y la luz cae a rojo; al volver se recupera', () => {
    const world = createWorld(START);
    applyCommand(world, { type: 'clock.set', hour: 20 });
    stepWorld(world, 600);
    for (const id of ZONE_IDS) assert.equal(levelOf(world, id, 'light'), 'ok');

    applyCommand(world, { type: 'power.set', on: false });
    stepWorld(world, 600);
    for (const zone of world.zones) {
      assert.equal(levelOf(world, zone.config.id, 'light'), 'critical');
      for (const device of DEVICE_IDS) assert.equal(zone.devices[device].running, false);
    }

    applyCommand(world, { type: 'power.set', on: true });
    stepWorld(world, 600);
    for (const zone of world.zones) {
      assert.equal(levelOf(world, zone.config.id, 'light'), 'ok');
      assert.equal(zone.devices.recirculationPump.running, true);
    }
  });

  it('falla de la bomba de llenado: el nivel baja hasta amarillo y rojo', () => {
    const world = createWorld(START);
    applyCommand(world, { type: 'device.fault', zone: 'zona-2', device: 'refillValve', fault: 'failed' });
    const seen = new Set<string>();
    for (let minute = 0; minute < 24 * 60; minute++) {
      stepWorld(world, 60);
      seen.add(levelOf(world, 'zona-2', 'tankLevel'));
    }
    assert.ok(seen.has('warn') && seen.has('critical'));
  });

  it('la bomba de recirculación obedece la orden de apagado del backend y no rearma sin nivel', () => {
    const world = createWorld(START);
    const zone = world.zones[0];
    zone.backend = { recirculationPump: false, phDoser: false, nutrientDoser: false, ventilation: false };
    applyCommand(world, { type: 'tank.disturb', zone: 'zona-1', dLiters: -150 });
    applyCommand(world, { type: 'device.fault', zone: 'zona-1', device: 'refillValve', fault: 'failed' });
    stepWorld(world, 300);
    assert.equal(zone.devices.recirculationPump.running, false);
    zone.backend = { ...zone.backend, recirculationPump: true };
    stepWorld(world, 300);
    assert.equal(zone.devices.recirculationPump.running, false, 'sigue protegida por bajo nivel');
    applyCommand(world, { type: 'tank.disturb', zone: 'zona-1', dLiters: 100 });
    stepWorld(world, 60);
    assert.equal(zone.devices.recirculationPump.running, true);
  });

  it('todos los escenarios incluidos son válidos y dejan el invernadero sin fallas al terminar', () => {
    for (const builtin of BUILTIN_SCENARIOS) {
      const parsed = parseScenario(JSON.parse(JSON.stringify(builtin)), ZONE_IDS);
      assert.equal(parsed.steps.length, builtin.steps.length, builtin.id);

      for (const mode of ['completo', 'detenido'] as const) {
        const world = createWorld(START);
        const run = startRun(builtin);
        if (mode === 'completo') {
          for (let t = 0; t <= runDurationSec(run); t += 60) advanceRun(run, world, 60);
          assert.ok(isRunFinished(run), builtin.id);
        } else {
          advanceRun(run, world, 0);
          stopRun(run, world);
        }
        const label = `${builtin.id} (${mode})`;
        assert.equal(world.power.on, true, label);
        assert.equal(world.network.online, true, label);
        assert.equal(world.env.tempOffset, 0, label);
        for (const zone of world.zones) {
          assert.equal(zone.node.online, true, label);
          assert.equal(zone.tank.leakLph, 0, label);
          for (const device of DEVICE_IDS) assert.equal(zone.devices[device].fault, 'none', label);
          for (const key of VARIABLES) assert.equal(zone.node.sensors[key].mode, 'ok', label);
        }
      }
    }
  });

  it('rechaza comandos mal formados', () => {
    assert.throws(() => parseCommand({ type: 'device.fault', zone: 'zona-9', device: 'fans', fault: 'failed' }, ZONE_IDS));
    assert.throws(() => parseCommand({ type: 'tank.disturb', zone: 'zona-1', dPh: 99 }, ZONE_IDS));
    assert.throws(() => parseCommand({ type: 'borrar.todo' }, ZONE_IDS));
  });
});

describe('Simulador interactivo — mismo contrato que un sensor real', () => {
  it('el cuerpo que arma el nodo pasa la validación de la ingesta sin campos extra', () => {
    const world = createWorld(START);
    const zone = world.zones[1];
    const payload = buildIngestPayload('gh-1', zone, measure(zone, seededRng(7)), new Date(START));
    assert.deepEqual(Object.keys(payload).sort(), ['crop', 'greenhouseId', 'readings', 'timestamp', 'zoneId']);
    assert.deepEqual(Object.keys(payload.readings).sort(), [...VARIABLES].sort());
    assert.equal(validateIngestPayload(payload, KEY, KEY).valid, true);
  });

  it('una sonda de temperatura desconectada produce una lectura que la ingesta rechaza con 422', () => {
    const world = createWorld(START);
    applyCommand(world, { type: 'sensor.fault', zone: 'zona-1', variable: 'solutionTemp', mode: 'disconnected' });
    const zone = world.zones[0];
    const payload = buildIngestPayload('gh-1', zone, measure(zone, seededRng(7)), new Date(START));
    const result = validateIngestPayload(payload, KEY, KEY);
    assert.equal(result.valid, false);
    if (!result.valid) assert.equal(result.status, 422);
  });

  it('publica por POST /ingestTelemetry y el backend deja state/latest, alertas y actuadores', async () => {
    await withIngest(async ({ url, storage }) => {
      const publisher = new Publisher({ ingestUrl: url, deviceKey: KEY, greenhouseId: 'gh-sim' });
      const sim = new Simulation({ publisher, startTimeMs: START, rng: seededRng(1) });
      await sim.publishCycle(new Date('2026-11-14T16:00:00Z'));

      assert.deepEqual(Object.keys(storage.latestState['gh-sim']).sort(), ZONE_IDS);
      assert.equal(storage.readings['gh-sim'].length, 3);
      assert.equal(storage.latestState['gh-sim']['zona-1'].timestamp, '2026-11-14T16:00:00.000Z');
      assert.equal((storage.alerts['gh-sim'] ?? []).length, 0, 'el estado normal no genera alertas');

      // Sube el pH: el backend crea la alerta y ordena la dosificadora.
      sim.command({ type: 'device.fault', zone: 'zona-1', device: 'phDoser', fault: 'failed' });
      sim.command({ type: 'tank.disturb', zone: 'zona-1', dPh: 1.3 });
      await sim.publishCycle();
      const alerts = storage.alerts['gh-sim'];
      assert.equal(alerts.length, 1);
      assert.equal(alerts[0].variable, 'ph');
      assert.equal(alerts[0].severity, 'critical');
      assert.equal(sim.snapshot().zones[0].backend.levels?.ph, 'critical');

      await sim.publishCycle();
      assert.equal(sim.world.zones[0].backend?.phDoser, true, 'lee la orden por GET /actuatorsState');
      assert.equal(storage.alerts['gh-sim'].length, 1, 'sin duplicados');

      // Se repara: el pH baja y el backend resuelve la alerta.
      sim.command({ type: 'device.fault', zone: 'zona-1', device: 'phDoser', fault: 'none' });
      sim.speed = 60;
      sim.advance(120);
      await sim.publishCycle();
      assert.equal(storage.alerts['gh-sim'][0].status, 'auto_resolved');
    });
  });

  it('con una clave incorrecta la ingesta rechaza y nada se guarda', async () => {
    await withIngest(async ({ url, storage }) => {
      const publisher = new Publisher({ ingestUrl: url, deviceKey: 'otra-clave', greenhouseId: 'gh-sim' });
      const sim = new Simulation({ publisher, startTimeMs: START });
      await sim.publishCycle();
      assert.equal(publisher.stats.rejected, 3);
      assert.equal(publisher.stats.sent, 0);
      assert.equal(storage.readings['gh-sim'], undefined);
      assert.ok(sim.snapshot().zones.every((z) => z.node.led === 'rejected'));
    });
  });

  it('sin internet guarda las lecturas y al volver las reenvía en orden con su hora original', async () => {
    await withIngest(async ({ url, storage }) => {
      const publisher = new Publisher({ ingestUrl: url, deviceKey: KEY, greenhouseId: 'gh-sim' });
      const sim = new Simulation({ publisher, startTimeMs: START, zones: [
        { id: 'zona-1', name: 'Zona 1', crop: 'lechuga', cropLabel: 'Lechuga', system: 'NFT', tankCapacityL: 200 },
      ] });
      sim.command({ type: 'network.set', online: false });
      await sim.publishCycle(new Date('2026-11-14T16:00:00Z'));
      await sim.publishCycle(new Date('2026-11-14T16:01:00Z'));
      assert.equal(publisher.queueSize(), 2);
      assert.equal(storage.readings['gh-sim'], undefined);

      sim.command({ type: 'network.set', online: true });
      await sim.publishCycle(new Date('2026-11-14T16:02:00Z'));
      assert.equal(publisher.queueSize(), 0);
      assert.deepEqual(
        storage.readings['gh-sim'].map((r) => r.timestamp),
        ['2026-11-14T16:00:00.000Z', '2026-11-14T16:01:00.000Z', '2026-11-14T16:02:00.000Z'],
      );
    });
  });

  it('si la ingesta no responde, la lectura se conserva para reintentar', async () => {
    const publisher = new Publisher({ ingestUrl: 'http://127.0.0.1:9', deviceKey: KEY, greenhouseId: 'gh-sim', timeoutMs: 500 });
    const sim = new Simulation({ publisher, startTimeMs: START });
    await sim.publishCycle();
    assert.equal(publisher.queueSize(), 3);
    assert.ok(sim.snapshot().zones.every((z) => z.node.led === 'queued'));
  });
});

describe('Clave de dispositivo sin valor por defecto', () => {
  it('la ingesta no arranca si falta DEVICE_INGEST_KEY', () => {
    const saved = process.env.DEVICE_INGEST_KEY;
    delete process.env.DEVICE_INGEST_KEY;
    try {
      assert.throws(() => createIngestHttpServer(), /DEVICE_INGEST_KEY/);
    } finally {
      if (saved !== undefined) process.env.DEVICE_INGEST_KEY = saved;
    }
  });
});
