/**
 * T6.6 (#53) — HU-06 (#47): "Dado que nadie tiene la app abierta, cuando una
 * lectura sale de rango, entonces se crea una alerta en menos de 5 s."
 *
 * Prueba de punta a punta contra el emulador de Firestore:
 *   sensor ──POST /ingestTelemetry──▶ servidor de ingesta (simulator/server.ts)
 *          ──Admin SDK──▶ Firestore (emulador) ──onSnapshot con reglas──▶ cliente de un operador
 *
 * El reloj empieza antes del POST y se detiene cuando el cliente del operador
 * (con sesión y pasando por firestore.rules) recibe la alerta nueva.
 *
 *   pnpm test:emulator
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, onSnapshot, query, where, setLogLevel } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createIngestHttpServer } from '../simulator/server.ts';
import { FirestoreTelemetryStorage } from '../simulator/core/firestoreStorage.ts';

// Proyecto propio: node --test corre cada archivo en paralelo y clearFirestore es por proyecto.
const PROJECT_ID = 'demo-green-tech-latency';
const GH = 'gh-latencia';
const DEVICE_KEY = 'clave-de-prueba-latencia';
const LIMIT_MS = 5000;
const ROUNDS = 5;

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

let testEnv;
let adminApp;
let server;
let baseUrl;

const okReadings = { airTemp: 23, humidity: 65, light: 30000, ph: 6.0, ec: 2.5, solutionTemp: 21, tankLevel: 80 };

before(async () => {
  setLogLevel('error');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await testEnv.clearFirestore();

  adminApp = initializeApp({ projectId: PROJECT_ID }, 'latency-test');
  const adminDb = getFirestore(adminApp);
  await adminDb.doc(`greenhouses/${GH}`).set({ name: 'Latencia', inviteCode: 'GT-LAT', memberIds: ['uid-op'] });
  await adminDb.doc(`greenhouses/${GH}/members/uid-op`).set({ role: 'operador' });

  ({ server } = createIngestHttpServer({ deviceKey: DEVICE_KEY, storage: new FirestoreTelemetryStorage(adminDb) }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (adminApp) await deleteApp(adminApp);
  if (testEnv) await testEnv.cleanup();
});

async function ingest(zoneId, readings) {
  const res = await fetch(`${baseUrl}/ingestTelemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-device-key': DEVICE_KEY },
    body: JSON.stringify({ greenhouseId: GH, zoneId, crop: 'jitomate', timestamp: new Date().toISOString(), readings }),
  });
  assert.equal(res.status, 201, `la ingesta debe responder 201 (respondió ${res.status}: ${await res.clone().text()})`);
  return res.json();
}

/**
 * Manda una lectura fuera de rango y mide cuánto tarda el cliente del operador
 * en ver la alerta nueva de esa zona y variable.
 */
async function measureAlertLatency(zoneId) {
  const operatorDb = testEnv.authenticatedContext('uid-op').firestore();
  const q = query(
    collection(operatorDb, 'greenhouses', GH, 'alerts'),
    where('zoneId', '==', zoneId),
    where('status', '==', 'new'),
  );

  // Esperar a que el listener esté activo (primer snapshot vacío) antes de medir.
  let resolveAlert;
  let rejectAlert;
  const alertSeen = new Promise((res, rej) => {
    resolveAlert = res;
    rejectAlert = rej;
  });
  let first = true;
  let readyResolve;
  const ready = new Promise((r) => (readyResolve = r));
  const unsub = onSnapshot(
    q,
    (snap) => {
      if (first) {
        first = false;
        readyResolve();
        return;
      }
      const alert = snap.docs.map((d) => d.data()).find((a) => a.variable === 'ph');
      if (alert) resolveAlert({ at: performance.now(), alert });
    },
    (err) => rejectAlert(err),
  );

  try {
    await ready;
    const t0 = performance.now();
    // pH 7.6 está por arriba del rojo (7.0) para jitomate.
    const body = await ingest(zoneId, { ...okReadings, ph: 7.6 });
    const ingestMs = performance.now() - t0;

    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`la alerta no llegó al operador en ${LIMIT_MS * 2} ms`)), LIMIT_MS * 2),
    );
    const { at, alert } = await Promise.race([alertSeen, timeout]);
    return { totalMs: at - t0, ingestMs, alert, body };
  } finally {
    unsub();
  }
}

describe('T6.6 (#53) — latencia de alertas < 5 s en el emulador', () => {
  it('con la app cerrada, una lectura fuera de rango crea la alerta y el operador la ve en menos de 5 s', async (t) => {
    // Primera lectura del invernadero, sin calentar nada: el peor caso real.
    const { totalMs, ingestMs, alert, body } = await measureAlertLatency('zona-1');
    t.diagnostic(`primera lectura: ingesta ${ingestMs.toFixed(0)} ms, alerta visible ${totalMs.toFixed(0)} ms`);

    assert.ok(body.createdAlertsCount >= 1, 'la ingesta debe reportar la alerta creada');
    assert.equal(alert.severity, 'critical');
    assert.equal(alert.status, 'new');
    assert.equal(alert.value, 7.6);
    assert.ok(totalMs < LIMIT_MS, `la alerta tardó ${totalMs.toFixed(0)} ms (límite ${LIMIT_MS} ms)`);
  });

  it(`en ${ROUNDS} zonas seguidas, ninguna alerta tarda 5 s o más`, async (t) => {
    const times = [];
    for (let i = 0; i < ROUNDS; i++) {
      const { totalMs } = await measureAlertLatency(`zona-lat-${i + 1}`);
      times.push(totalMs);
    }
    const sorted = [...times].sort((a, b) => a - b);
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];
    t.diagnostic(`latencias (ms): ${times.map((x) => x.toFixed(0)).join(', ')} · mediana ${median.toFixed(0)} · máx ${max.toFixed(0)}`);
    assert.ok(max < LIMIT_MS, `la peor alerta tardó ${max.toFixed(0)} ms (límite ${LIMIT_MS} ms)`);
  });

  it('no duplica la alerta activa si la variable sigue fuera de rango', async () => {
    await ingest('zona-dup', { ...okReadings, ph: 7.6 });
    const second = await ingest('zona-dup', { ...okReadings, ph: 7.8 });
    assert.equal(second.createdAlertsCount, 0);
  });
});
