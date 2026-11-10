/**
 * Pruebas de integración contra Firebase Emulator (@firebase/rules-unit-testing).
 * Ejecución con el emulador activo:
 *   pnpm test:rules
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
    await setDoc(doc(adminDb, 'greenhouses', GREENHOUSE_ID, 'state', 'latest'), {
      'zona-1': {
        zoneId: 'zona-1',
        crop: 'jitomate',
        timestamp: Timestamp.now(),
        level: 'ok',
      },
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
    await setDoc(doc(adminDb, 'users', 'uid-operador', 'fcmTokens', 'tok-1'), {
      token: 'fcm-token-operador',
      updatedAt: '2026-11-02T00:00:00.000Z',
    });
  });
});

describe('Firebase Emulator — Reglas de Firestore (HU-11 y Seguridad Backend)', () => {
  it('Criterio 1: rechaza acceso de lectura o escritura de un usuario con sesión que no es miembro', async () => {
    const outsiderDb = testEnv.authenticatedContext('uid-intruso').firestore();
    await assertFails(getDoc(doc(outsiderDb, 'greenhouses', GREENHOUSE_ID)));
    await assertFails(getDoc(doc(outsiderDb, 'greenhouses', GREENHOUSE_ID, 'members', 'uid-admin')));
    await assertFails(getDoc(doc(outsiderDb, 'greenhouses', GREENHOUSE_ID, 'readings', 'reading-1')));
    await assertFails(getDoc(doc(outsiderDb, 'greenhouses', GREENHOUSE_ID, 'state', 'latest')));
    await assertFails(getDoc(doc(outsiderDb, 'greenhouses', GREENHOUSE_ID, 'alerts', 'alert-sub-1')));
    await assertFails(
      updateDoc(doc(outsiderDb, 'greenhouses', GREENHOUSE_ID, 'alerts', 'alert-sub-1'), {
        status: 'attended',
        attendedBy: 'uid-intruso',
        attendedAt: '2026-11-08T00:00:00.000Z',
      }),
    );
  });

  it('Criterio 2: rechaza que un operador escale su rol a admin o edite/elimine el invernadero', async () => {
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

    const adminDb = testEnv.authenticatedContext('uid-admin').firestore();
    await assertSucceeds(
      updateDoc(doc(adminDb, 'greenhouses', GREENHOUSE_ID), { name: 'Editado por Admin' }),
    );
  });

  it('Criterio 3: permite unirse solo a sí mismo como operador con código de invitación válido', async () => {
    const newUserDb = testEnv.authenticatedContext('uid-nuevo').firestore();

    // Código incorrecto -> rechazado
    const invalidCodeBatch = writeBatch(newUserDb);
    invalidCodeBatch.update(doc(newUserDb, 'greenhouses', GREENHOUSE_ID), {
      memberIds: ['uid-admin', 'uid-operador', 'uid-nuevo'],
    });
    invalidCodeBatch.set(doc(newUserDb, 'greenhouses', GREENHOUSE_ID, 'members', 'uid-nuevo'), {
      role: 'operador',
      inviteCode: 'GT-FALSO',
    });
    await assertFails(invalidCodeBatch.commit());

    // Intentar unirse como admin -> rechazado
    const selfAdminBatch = writeBatch(newUserDb);
    selfAdminBatch.update(doc(newUserDb, 'greenhouses', GREENHOUSE_ID), {
      memberIds: ['uid-admin', 'uid-operador', 'uid-nuevo'],
    });
    selfAdminBatch.set(doc(newUserDb, 'greenhouses', GREENHOUSE_ID, 'members', 'uid-nuevo'), {
      role: 'admin',
      inviteCode: VALID_CODE,
    });
    await assertFails(selfAdminBatch.commit());

    // Unión válida como operador con código correcto -> permitido
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

  it('Criterio 4: bloquea creación de lecturas, estado y alertas desde cliente (incluso con ingestKey) y valida acuse de alerta con propio UID', async () => {
    const operatorDb = testEnv.authenticatedContext('uid-operador').firestore();
    const adminDb = testEnv.authenticatedContext('uid-admin').firestore();
    const unauthDb = testEnv.unauthenticatedContext().firestore();

    // Ningún cliente puede escribir en readings, state ni crear alertas, aunque mande gt-dev-device-key-2026
    await assertFails(
      setDoc(doc(unauthDb, 'greenhouses', GREENHOUSE_ID, 'readings', 'fake-reading'), {
        zoneId: 'zona-1',
        ph: 7.5,
        ingestKey: 'gt-dev-device-key-2026',
      }),
    );
    await assertFails(
      setDoc(doc(adminDb, 'greenhouses', GREENHOUSE_ID, 'readings', 'fake-reading-admin'), {
        zoneId: 'zona-1',
        ph: 7.5,
        ingestKey: 'gt-dev-device-key-2026',
      }),
    );
    await assertFails(
      setDoc(doc(operatorDb, 'greenhouses', GREENHOUSE_ID, 'state', 'latest'), {
        'zona-1': { level: 'critical' },
        ingestKey: 'gt-dev-device-key-2026',
      }),
    );
    await assertFails(
      setDoc(doc(operatorDb, 'greenhouses', GREENHOUSE_ID, 'alerts', 'fake-alert'), {
        zoneId: 'zona-1',
        variable: 'ph',
        severity: 'critical',
        status: 'new',
        ingestKey: 'gt-dev-device-key-2026',
      }),
    );

    // Atender alerta falsificando el UID de otro usuario o modificando value -> rechazado
    await assertFails(
      updateDoc(doc(operatorDb, 'greenhouses', GREENHOUSE_ID, 'alerts', 'alert-sub-1'), {
        status: 'attended',
        attendedBy: 'uid-admin',
        attendedAt: '2026-11-08T12:00:00.000Z',
      }),
    );
    await assertFails(
      updateDoc(doc(operatorDb, 'greenhouses', GREENHOUSE_ID, 'alerts', 'alert-sub-1'), {
        status: 'attended',
        attendedBy: 'uid-operador',
        attendedAt: '2026-11-08T12:00:00.000Z',
        value: 6.0,
      }),
    );

    // Atender alerta con el propio UID y solo campos permitidos -> permitido
    await assertSucceeds(
      updateDoc(doc(operatorDb, 'greenhouses', GREENHOUSE_ID, 'alerts', 'alert-sub-1'), {
        status: 'attended',
        attendedBy: 'uid-operador',
        attendedAt: '2026-11-08T12:00:00.000Z',
      }),
    );
  });

  it('Criterio 5: aísla tokens FCM por usuario y restringe escritura de actuadores a admin', async () => {
    const operatorDb = testEnv.authenticatedContext('uid-operador').firestore();
    const adminDb = testEnv.authenticatedContext('uid-admin').firestore();

    await assertSucceeds(getDoc(doc(operatorDb, 'users', 'uid-operador', 'fcmTokens', 'tok-1')));
    await assertFails(getDoc(doc(adminDb, 'users', 'uid-operador', 'fcmTokens', 'tok-1')));

    // Operador puede leer actuadores pero no modificarlos; Admin sí puede forzarlos
    await assertFails(
      setDoc(doc(operatorDb, 'greenhouses', GREENHOUSE_ID, 'actuators', 'zona-1'), {
        zoneId: 'zona-1',
        ventilation: { on: true, updatedBy: 'uid-operador' },
      }),
    );
    await assertSucceeds(
      setDoc(doc(adminDb, 'greenhouses', GREENHOUSE_ID, 'actuators', 'zona-1'), {
        zoneId: 'zona-1',
        ventilation: { on: true, updatedBy: 'uid-admin' },
      }),
    );
  });
});
