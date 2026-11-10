import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateIngestPayload,
  DEFAULT_CROP_THRESHOLDS,
} from '../simulator/core/hydroponicModel.ts';
import {
  InMemoryTelemetryStorage,
  processIngestedReading,
} from '../simulator/core/alertAndActuatorEngine.ts';
import {
  createInitialReadings,
  stepZoneReadings,
} from '../simulator/core/simulatorEngine.ts';
import { createIngestHttpServer } from '../simulator/server.ts';

const DEVICE_KEY = 'test-device-key-123';

describe('T2.1 (#37) — Validación de ingestTelemetry (clave, unidades y rangos físicos)', () => {
  const validPayload = {
    greenhouseId: 'gh-1',
    zoneId: 'zona-1',
    crop: 'jitomate',
    timestamp: '2026-11-08T12:00:00.000Z',
    readings: {
      airTemp: 24.0,
      humidity: 65,
      light: 30000,
      ph: 6.0,
      ec: 2.5,
      solutionTemp: 21.0,
      tankLevel: 85,
    },
  };

  it('rechaza peticiones sin x-device-key o con clave incorrecta (401)', () => {
    const res1 = validateIngestPayload(validPayload, undefined, DEVICE_KEY);
    assert.equal(res1.valid, false);
    if (!res1.valid) assert.equal(res1.status, 401);

    const res2 = validateIngestPayload(validPayload, 'wrong-key', DEVICE_KEY);
    assert.equal(res2.valid, false);
    if (!res2.valid) assert.equal(res2.status, 401);
  });

  it('rechaza valores fuera del rango físico válido con 422 (ej. pH > 14 o tanque < 0)', () => {
    const badPh = {
      ...validPayload,
      readings: { ...validPayload.readings, ph: 15.2 },
    };
    const resPh = validateIngestPayload(badPh, DEVICE_KEY, DEVICE_KEY);
    assert.equal(resPh.valid, false);
    if (!resPh.valid) assert.equal(resPh.status, 422);

    const badTank = {
      ...validPayload,
      readings: { ...validPayload.readings, tankLevel: -5 },
    };
    const resTank = validateIngestPayload(badTank, DEVICE_KEY, DEVICE_KEY);
    assert.equal(resTank.valid, false);
    if (!resTank.valid) assert.equal(resTank.status, 422);
  });

  it('acepta las 7 variables hidropónicas dentro de rango', () => {
    const res = validateIngestPayload(validPayload, DEVICE_KEY, DEVICE_KEY);
    assert.equal(res.valid, true);
    if (res.valid) {
      assert.equal(res.data.greenhouseId, 'gh-1');
      assert.equal(res.data.zoneId, 'zona-1');
      assert.equal(res.data.readings.ph, 6.0);
    }
  });
});

describe('T6.1 (#48) y T6.3 (#50) — Evaluación de umbrales, desduplicación y auto-resolución (< 5 s)', () => {
  it('crea alerta en < 5 s al salir de rango, evita duplicados y resuelve automáticamente al volver a ok', async () => {
    const storage = new InMemoryTelemetryStorage();
    const startMs = Date.now();

    // 1. Lectura con pH crítico (7.5 > 7.0)
    const first = await processIngestedReading(
      {
        greenhouseId: 'gh-1',
        zoneId: 'zona-1',
        crop: 'jitomate',
        timestamp: '2026-11-08T12:00:00.000Z',
        readings: {
          airTemp: 23.0,
          humidity: 65,
          light: 28000,
          ph: 7.5,
          ec: 2.6,
          solutionTemp: 21.0,
          tankLevel: 80,
        },
      },
      storage,
    );

    const elapsedMs = Date.now() - startMs;
    assert.ok(elapsedMs < 5000, `La alerta debe crearse en menos de 5 s (tomó ${elapsedMs} ms)`);
    assert.equal(first.createdAlerts.length, 1);
    assert.equal(first.createdAlerts[0].variable, 'ph');
    assert.equal(first.createdAlerts[0].severity, 'critical');
    assert.equal(first.zoneState.ph.level, 'critical');
    assert.equal(first.actuators.phDoser.on, true);

    // 2. Segunda lectura consecutiva con pH alto -> NO duplica la alerta activa
    const second = await processIngestedReading(
      {
        greenhouseId: 'gh-1',
        zoneId: 'zona-1',
        crop: 'jitomate',
        timestamp: '2026-11-08T12:01:00.000Z',
        readings: {
          airTemp: 23.0,
          humidity: 65,
          light: 28000,
          ph: 7.6,
          ec: 2.6,
          solutionTemp: 21.0,
          tankLevel: 80,
        },
      },
      storage,
    );

    assert.equal(second.createdAlerts.length, 0);
    assert.equal(storage.alerts['gh-1'].length, 1);

    // 3. Tercera lectura con pH de regreso en rango óptimo (6.0) -> auto_resolved y apaga dosificadora
    const third = await processIngestedReading(
      {
        greenhouseId: 'gh-1',
        zoneId: 'zona-1',
        crop: 'jitomate',
        timestamp: '2026-11-08T12:02:00.000Z',
        readings: {
          airTemp: 23.0,
          humidity: 65,
          light: 28000,
          ph: 6.0,
          ec: 2.6,
          solutionTemp: 21.0,
          tankLevel: 80,
        },
      },
      storage,
    );

    assert.equal(third.resolvedAlertIds.length, 1);
    assert.equal(storage.alerts['gh-1'][0].status, 'auto_resolved');
    assert.equal(storage.alerts['gh-1'][0].resolvedAt, '2026-11-08T12:02:00.000Z');
    assert.equal(third.actuators.phDoser.on, false);
  });
});

describe('T2.2 (#38), T2.3 (#39) y T8.3 (#69) — Simulador hidropónico, escenarios y lazo cerrado HTTP', () => {
  it('simula deriva realista (pH sube, EC y tanque bajan) y corrige con actuadores encendidos', () => {
    const initial = createInitialReadings('jitomate');
    const drifted = stepZoneReadings(initial, 'jitomate', { deterministic: true });

    assert.ok(drifted.ph > initial.ph, 'El pH debe subir con la deriva natural');
    assert.ok(drifted.ec < initial.ec, 'La EC debe bajar con el consumo de nutrientes');
    assert.ok(drifted.tankLevel < initial.tankLevel, 'El nivel del tanque debe bajar');

    // Escenario forzado ph-alto (T2.3)
    const highPh = stepZoneReadings(initial, 'jitomate', {
      scenario: 'ph-alto',
      deterministic: true,
    });
    assert.ok(highPh.ph > DEFAULT_CROP_THRESHOLDS.jitomate.ph.redMax);

    // Lazo cerrado (T8.3): con phDoser encendido en modo normal, el pH disminuye
    const corrected = stepZoneReadings(highPh, 'jitomate', {
      scenario: 'normal',
      deterministic: true,
      actuators: {
        recirculationPump: { on: true, updatedAt: '', updatedBy: 'backend' },
        phDoser: { on: true, updatedAt: '', updatedBy: 'backend' },
        nutrientDoser: { on: false, updatedAt: '', updatedBy: 'backend' },
        ventilation: { on: false, updatedAt: '', updatedBy: 'backend' },
      },
    });
    assert.ok(corrected.ph < highPh.ph, 'La dosificadora de pH debe bajar el pH en lazo cerrado');
  });

  it('expone POST /ingestTelemetry y GET /actuatorsState por HTTP para el simulador', async () => {
    const { server } = createIngestHttpServer({ deviceKey: DEVICE_KEY });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const postRes = await fetch(`${baseUrl}/ingestTelemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-key': DEVICE_KEY,
        },
        body: JSON.stringify({
          greenhouseId: 'gh-http',
          zoneId: 'zona-1',
          crop: 'jitomate',
          readings: {
            airTemp: 35.0,
            humidity: 45,
            light: 35000,
            ph: 7.4,
            ec: 1.2,
            solutionTemp: 22.0,
            tankLevel: 15,
          },
        }),
      });
      assert.equal(postRes.status, 201);

      const actRes = await fetch(
        `${baseUrl}/actuatorsState?greenhouseId=gh-http&zoneId=zona-1`,
      );
      assert.equal(actRes.status, 200);
      const actJson = (await actRes.json()) as {
        recirculationPump: { on: boolean };
        phDoser: { on: boolean };
        nutrientDoser: { on: boolean };
        ventilation: { on: boolean };
      };
      // Tanque en 15% (< 20%) apaga la bomba; pH 7.4 enciende phDoser; EC 1.2 enciende nutrientDoser; airTemp 35 enciende ventilation
      assert.equal(actJson.recirculationPump.on, false);
      assert.equal(actJson.phDoser.on, true);
      assert.equal(actJson.nutrientDoser.on, true);
      assert.equal(actJson.ventilation.on, true);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});

describe('T11.4 (#29) y T6.2 (#49) — Eliminación de datos locales, alertas en el navegador y claves expuestas', () => {
  it('useTelemetrySource.ts tiene USE_LOCAL_DEMO_DATA = false y ya no llama a createAlert', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/hooks/useTelemetrySource.ts'),
      'utf8',
    );
    assert.match(src, /export const USE_LOCAL_DEMO_DATA = false;/);
    assert.doesNotMatch(src, /createAlert\(/);
  });

  it('firestore.rules y firestoreStorage.ts usan Admin SDK sin exponer ingestKey ni claves por defecto', () => {
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
    assert.doesNotMatch(rules, /gt-dev-device-key-2026/);
    assert.doesNotMatch(rules, /isValidBackendIngest/);
    assert.doesNotMatch(rules, /ingestKey/);
    assert.doesNotMatch(rules, /deviceKey/);

    const storageSrc = readFileSync(
      resolve(process.cwd(), 'simulator/core/firestoreStorage.ts'),
      'utf8',
    );
    assert.match(storageSrc, /firebase-admin\/firestore/);
    assert.doesNotMatch(storageSrc, /ingestKey/);
    assert.doesNotMatch(storageSrc, /gt-dev-device-key-2026/);
  });
});
