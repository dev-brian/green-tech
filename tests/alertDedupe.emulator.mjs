/**
 * Auditoría C4 contra el emulador de Firestore: el adaptador real
 * (FirestoreTelemetryStorage) no duplica alertas aunque un operador la atienda
 * con su sesión (pasando por firestore.rules) ni aunque lleguen lecturas a la vez.
 *
 *   pnpm test:emulator
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, updateDoc, serverTimestamp, setLogLevel } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { processIngestedReading } from '../simulator/core/alertAndActuatorEngine.ts';
import { FirestoreTelemetryStorage, OPEN_ALERTS_DOC } from '../simulator/core/firestoreStorage.ts';

// Proyecto propio: node --test corre cada archivo en paralelo y clearFirestore es por proyecto.
const PROJECT_ID = 'demo-green-tech-alert-dedupe';
const GH = 'gh-c4';
const base = { airTemp: 23, humidity: 65, light: 28000, ph: 6.0, ec: 2.6, solutionTemp: 21, tankLevel: 80 };

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

let testEnv;
let adminApp;
let adminDb;
let storage;
let minute = 0;

const ingest = (readings) =>
  processIngestedReading(
    {
      greenhouseId: GH,
      zoneId: 'zona-1',
      crop: 'jitomate',
      timestamp: new Date(Date.UTC(2026, 10, 17, 12, minute++)).toISOString(),
      readings: { ...base, ...readings },
    },
    storage,
  );

const phAlerts = async () =>
  (await adminDb.collection(`greenhouses/${GH}/alerts`).where('variable', '==', 'ph').get()).docs;

before(async () => {
  setLogLevel('error');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  adminApp = initializeApp({ projectId: PROJECT_ID }, 'alert-dedupe-test');
  adminDb = getFirestore(adminApp);
  storage = new FirestoreTelemetryStorage(adminDb);
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await adminDb.doc(`greenhouses/${GH}`).set({ name: 'C4', inviteCode: 'GT-C4', memberIds: ['uid-op'] });
  await adminDb.doc(`greenhouses/${GH}/members/uid-op`).set({ role: 'operador' });
});

after(async () => {
  await deleteApp(adminApp);
  await testEnv.cleanup();
});

describe('C4 — FirestoreTelemetryStorage', () => {
  it('atender desde la PWA no provoca alertas nuevas; se cierra al volver a rango', async () => {
    const first = await ingest({ ph: 7.5 });
    const id = first.createdAlerts[0].id;

    const op = testEnv.authenticatedContext('uid-op').firestore();
    await assertSucceeds(
      updateDoc(doc(op, `greenhouses/${GH}/alerts/${id}`), {
        status: 'attended',
        attendedBy: 'uid-op',
        attendedAt: serverTimestamp(),
      }),
    );

    for (let i = 0; i < 5; i++) {
      const r = await ingest({ ph: 7.5 });
      assert.equal(r.createdAlerts.length, 0);
    }
    assert.equal((await phAlerts()).length, 1);

    const pointer = await adminDb.doc(`greenhouses/${GH}/state/${OPEN_ALERTS_DOC}`).get();
    assert.equal(pointer.get('zona-1')?.ph, id);

    const back = await ingest({ ph: 6.0 });
    assert.deepEqual(back.resolvedAlertIds, [id]);
    const [alert] = await phAlerts();
    assert.equal(alert.get('status'), 'auto_resolved');
    assert.ok(alert.get('resolvedAt') instanceof Timestamp);
    assert.equal(alert.get('attendedBy'), 'uid-op');

    const after = await adminDb.doc(`greenhouses/${GH}/state/${OPEN_ALERTS_DOC}`).get();
    assert.equal(after.get('zona-1')?.ph, undefined, 'el puntero se borra al cerrar');
  });

  it('lecturas simultáneas crean una sola alerta', async () => {
    await Promise.all(Array.from({ length: 6 }, () => ingest({ ph: 7.5 })));
    assert.equal((await phAlerts()).length, 1);
  });

  it('adopta la copia más reciente que dejó el error y cierra las demás', async () => {
    const col = adminDb.collection(`greenhouses/${GH}/alerts`);
    const legacy = (minuteOf, status) => ({
      zoneId: 'zona-1',
      variable: 'ph',
      severity: 'critical',
      value: 7.5,
      message: 'pH crítico',
      status,
      createdAt: Timestamp.fromDate(new Date(Date.UTC(2026, 10, 16, 20, minuteOf))),
      attendedBy: status === 'attended' ? 'uid-op' : null,
      attendedAt: null,
      resolvedAt: null,
    });
    await col.doc('old-1').set(legacy(0, 'attended'));
    await col.doc('old-2').set(legacy(5, 'attended'));
    await col.doc('old-3').set(legacy(10, 'new'));

    const r = await ingest({ ph: 7.5 });
    assert.equal(r.createdAlerts.length, 0, 'no crea otra: ya había una abierta');

    const byId = Object.fromEntries((await phAlerts()).map((d) => [d.id, d.data()]));
    assert.equal(Object.keys(byId).length, 3);
    assert.equal(byId['old-3'].status, 'new');
    assert.equal(byId['old-1'].status, 'auto_resolved');
    assert.equal(byId['old-1'].supersededBy, 'old-3');
    assert.equal(byId['old-2'].status, 'auto_resolved');

    const pointer = await adminDb.doc(`greenhouses/${GH}/state/${OPEN_ALERTS_DOC}`).get();
    assert.equal(pointer.get('zona-1')?.ph, 'old-3');
  });
});
