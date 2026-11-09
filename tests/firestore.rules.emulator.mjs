/**
 * Pruebas de integración contra Firebase Emulator (@firebase/rules-unit-testing).
 * Ejecución con el emulador activo:
 *   firebase emulators:exec --only firestore "node --test tests/firestore.rules.emulator.mjs"
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
  setLogLevel,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-green-tech-rules';
const GREENHOUSE_ID = 'gh-1';
const VALID_CODE = 'GT-ABCD2';

let testEnv;

before(async () => {
  setLogLevel('error');
  const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'greenhouses', GREENHOUSE_ID), {
      name: 'Invernadero Hidropónico Norte',
      inviteCode: VALID_CODE,
      memberIds: ['uid-admin', 'uid-operador'],
      createdAt: '2026-11-01T00:00:00.000Z',
    });
    await setDoc(doc(adminDb, 'greenhouses', GREENHOUSE_ID, 'members', 'uid-admin'), {
      role: 'admin',
      email: 'admin@greentech.mx',
      name: 'Admin User',
      joinedAt: '2026-11-01T00:00:00.000Z',
    });
    await setDoc(doc(adminDb, 'greenhouses', GREENHOUSE_ID, 'members', 'uid-operador'), {
      role: 'operador',
      email: 'operador@greentech.mx',
      name: 'Operador User',
      joinedAt: '2026-11-02T00:00:00.000Z',
    });
    await setDoc(doc(adminDb, 'greenhouses', GREENHOUSE_ID, 'readings', 'reading-1'), {
      zoneId: 'zona-1',
      timestamp: Timestamp.now(),
      airTemp: 23.5,
      humidity: 65,
      light: 28000,
      ph: 6.0,
      ec: 2.2,
      solutionTemp: 21.0,
      tankLevel: 85,
    });
    await setDoc(doc(adminDb, 'greenhouses', GREENHOUSE_ID, 'alerts', 'alert-sub-1'), {
      zoneId: 'zona-1',
      variable: 'ph',
      severity: 'critical',
      value: 7.4,
      message: 'pH crítico en zona-1: 7.4',
      status: 'new',
      createdAt: Timestamp.now(),
      attendedBy: null,
      attendedAt: null,
      resolvedAt: null,
    });
  });
});

describe('Firebase Emulator — Reglas de Firestore (HU-11)', () => {
  it('rechaza acceso de un usuario con sesión que no es miembro', async () => {
    const outsiderDb = testEnv.authenticatedContext('uid-intruso').firestore();
    await assertFails(getDoc(doc(outsiderDb, 'greenhouses', GREENHOUSE_ID)));
    await assertFails(getDoc(doc(outsiderDb, 'greenhouses', GREENHOUSE_ID, 'members', 'uid-admin')));
    await assertFails(getDoc(doc(outsiderDb, 'greenhouses', GREENHOUSE_ID, 'readings', 'reading-1')));
    await assertFails(getDoc(doc(outsiderDb, 'greenhouses', GREENHOUSE_ID, 'alerts', 'alert-sub-1')));
  });

  it('rechaza que un operador escale su rol a admin o edite el invernadero', async () => {
    const operatorDb = testEnv.authenticatedContext('uid-operador').firestore();
    await assertFails(
      updateDoc(doc(operatorDb, 'greenhouses', GREENHOUSE_ID, 'members', 'uid-operador'), {
        role: 'admin',
      }),
    );
    await assertFails(
      updateDoc(doc(operatorDb, 'greenhouses', GREENHOUSE_ID), { name: 'Editado por operador' }),
    );
    await assertFails(deleteDoc(doc(operatorDb, 'greenhouses', GREENHOUSE_ID)));
  });

  it('permite unirse solo como operador con código válido', async () => {
    const newUserDb = testEnv.authenticatedContext('uid-nuevo').firestore();

    const invalidBatch = writeBatch(newUserDb);
    invalidBatch.update(doc(newUserDb, 'greenhouses', GREENHOUSE_ID), {
      memberIds: ['uid-admin', 'uid-operador', 'uid-nuevo'],
    });
    invalidBatch.set(doc(newUserDb, 'greenhouses', GREENHOUSE_ID, 'members', 'uid-nuevo'), {
      role: 'operador',
      inviteCode: 'GT-FALSO',
    });
    await assertFails(invalidBatch.commit());

    const validBatch = writeBatch(newUserDb);
    validBatch.update(doc(newUserDb, 'greenhouses', GREENHOUSE_ID), {
      memberIds: ['uid-admin', 'uid-operador', 'uid-nuevo'],
    });
    validBatch.set(doc(newUserDb, 'greenhouses', GREENHOUSE_ID, 'members', 'uid-nuevo'), {
      role: 'operador',
      inviteCode: VALID_CODE,
    });
    await assertSucceeds(validBatch.commit());
  });
});
