/**
 * Pruebas de integración contra Firebase Emulator (@firebase/rules-unit-testing).
 * Ejecución con el emulador activo:
 *   pnpm test:rules
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
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
  arrayUnion,
  arrayRemove,
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
    await setDoc(doc(adminDb, 'greenhouses', GREENHOUSE_ID, 'readingsHourly', 'zona-1_2026111512'), {
      zoneId: 'zona-1',
      hour: Timestamp.now(),
      count: 1,
      ph: { avg: 6.0, min: 6.0, max: 6.0 },
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
    await setDoc(doc(adminDb, 'greenhouse_invites', VALID_CODE), { greenhouseId: GREENHOUSE_ID });
    // Invernadero con un solo miembro que NO es admin (caso B de la auditoría)
    await setDoc(doc(adminDb, 'greenhouses', 'gh-solo'), { name: 'Solo', inviteCode: 'GT-ZZZZ9', memberIds: ['uid-solo'] });
    await setDoc(doc(adminDb, 'greenhouses', 'gh-solo', 'members', 'uid-solo'), { role: 'operador' });
    // Otro invernadero con su propio admin (caso C)
    await setDoc(doc(adminDb, 'greenhouses', 'gh-otro'), { name: 'Otro', inviteCode: 'GT-OTRO1', memberIds: ['uid-admin-otro'] });
    await setDoc(doc(adminDb, 'greenhouses', 'gh-otro', 'members', 'uid-admin-otro'), { role: 'admin' });
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
    await assertFails(getDoc(doc(outsiderDb, 'greenhouses', GREENHOUSE_ID, 'readingsHourly', 'zona-1_2026111512')));
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
    // Los promedios por hora (T7.1 #75) los lee cualquier miembro y solo los escribe el backend
    await assertSucceeds(getDoc(doc(operatorDb, 'greenhouses', GREENHOUSE_ID, 'readingsHourly', 'zona-1_2026111512')));
    await assertFails(
      setDoc(doc(adminDb, 'greenhouses', GREENHOUSE_ID, 'readingsHourly', 'zona-1_2026111512'), {
        zoneId: 'zona-1',
        count: 999,
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

// Huecos de la auditoría (C1 y relacionados). El PoC reproducía cada ataque
// con assertSucceeds; ahora todos deben fallar.
describe('Auditoría C1 — unión, roles, invitaciones y umbrales', () => {
  const gh = (db, id = GREENHOUSE_ID) => doc(db, 'greenhouses', id);
  const member = (db, uid, id = GREENHOUSE_ID) => doc(db, 'greenhouses', id, 'members', uid);

  it('A: un extraño no puede unirse solo con arrayUnion(memberIds) sin código', async () => {
    const db = testEnv.authenticatedContext('uid-intruso').firestore();
    await assertFails(updateDoc(gh(db), { memberIds: arrayUnion('uid-intruso') }));
    // Tampoco reescribiendo el mismo inviteCode para "probar" que lo conoce
    await assertFails(updateDoc(gh(db), { memberIds: arrayUnion('uid-intruso'), inviteCode: VALID_CODE }));
    // Ni creando solo el documento de miembro sin entrar a memberIds
    await assertFails(setDoc(member(db, 'uid-intruso'), { role: 'operador', inviteCode: VALID_CODE }));
    // Y por lo tanto no ve miembros ni atiende alertas
    await assertFails(getDoc(member(db, 'uid-admin')));
    await assertFails(
      updateDoc(doc(db, 'greenhouses', GREENHOUSE_ID, 'alerts', 'alert-sub-1'), { status: 'attended', attendedBy: 'uid-intruso' }),
    );
  });

  it('A: la unión legítima en batch con arrayUnion + members/{uid} y código vigente sigue funcionando', async () => {
    const db = testEnv.authenticatedContext('uid-nuevo').firestore();
    const batch = writeBatch(db);
    batch.update(gh(db), { memberIds: arrayUnion('uid-nuevo') });
    batch.set(member(db, 'uid-nuevo'), {
      role: 'operador', email: 'nuevo@greentech.mx', name: 'Nuevo', joinedAt: '2026-11-17T00:00:00.000Z', inviteCode: VALID_CODE,
    });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(gh(db)));
  });

  it('A: un expulsado no vuelve a entrar con el código viejo tras regenerarlo', async () => {
    const adminDb = testEnv.authenticatedContext('uid-admin').firestore();
    // Expulsar al operador y regenerar el código (como removeMember + regenerateInviteCode)
    const kick = writeBatch(adminDb);
    kick.update(gh(adminDb), { memberIds: arrayRemove('uid-operador') });
    kick.delete(member(adminDb, 'uid-operador'));
    await assertSucceeds(kick.commit());
    const rotate = writeBatch(adminDb);
    rotate.update(gh(adminDb), { inviteCode: 'GT-NUEVO7', inviteCodeCreatedAt: '2026-11-17T00:00:00.000Z' });
    rotate.set(doc(adminDb, 'greenhouse_invites', 'GT-NUEVO7'), { greenhouseId: GREENHOUSE_ID, createdAt: '2026-11-17T00:00:00.000Z' });
    rotate.delete(doc(adminDb, 'greenhouse_invites', VALID_CODE));
    await assertSucceeds(rotate.commit());

    const kickedDb = testEnv.authenticatedContext('uid-operador').firestore();
    const oldInvite = await assertSucceeds(getDoc(doc(kickedDb, 'greenhouse_invites', VALID_CODE)));
    assert.equal(oldInvite.exists(), false, 'el código viejo ya no debe resolver al invernadero');
    const rejoin = writeBatch(kickedDb);
    rejoin.update(gh(kickedDb), { memberIds: arrayUnion('uid-operador') });
    rejoin.set(member(kickedDb, 'uid-operador'), { role: 'operador', inviteCode: VALID_CODE });
    await assertFails(rejoin.commit());
    await assertFails(updateDoc(gh(kickedDb), { memberIds: arrayUnion('uid-operador') }));
  });

  it('B: un miembro único sin rol admin no puede borrar y recrear su documento como admin', async () => {
    const db = testEnv.authenticatedContext('uid-solo').firestore();
    await assertFails(deleteDoc(member(db, 'uid-solo', 'gh-solo')));
    await assertFails(setDoc(member(db, 'uid-solo', 'gh-solo'), { role: 'admin' }));
    await assertFails(updateDoc(gh(db, 'gh-solo'), { name: 'tomado' }));
  });

  it('B: salir del invernadero (memberIds + borrar el propio documento en batch) sigue permitido', async () => {
    const db = testEnv.authenticatedContext('uid-operador').firestore();
    const batch = writeBatch(db);
    batch.update(gh(db), { memberIds: arrayRemove('uid-operador') });
    batch.delete(member(db, 'uid-operador'));
    await assertSucceeds(batch.commit());
  });

  it('B: crear invernadero nuevo con su admin e invitación en batch sigue permitido', async () => {
    const db = testEnv.authenticatedContext('uid-creador').firestore();
    const batch = writeBatch(db);
    batch.set(gh(db, 'gh-nuevo'), {
      name: 'Nuevo', inviteCode: 'GT-NEW22', inviteCodeCreatedAt: '2026-11-17T00:00:00.000Z', memberIds: ['uid-creador'], createdAt: '2026-11-17T00:00:00.000Z',
    });
    batch.set(member(db, 'uid-creador', 'gh-nuevo'), { role: 'admin', email: 'c@x.mx', name: 'C', joinedAt: '2026-11-17T00:00:00.000Z' });
    batch.set(doc(db, 'greenhouse_invites', 'GT-NEW22'), { greenhouseId: 'gh-nuevo', createdAt: '2026-11-17T00:00:00.000Z' });
    await assertSucceeds(batch.commit());
  });

  it('C: el admin de otro invernadero no puede sobrescribir ni borrar un código ajeno', async () => {
    const db = testEnv.authenticatedContext('uid-admin-otro').firestore();
    await assertFails(setDoc(doc(db, 'greenhouse_invites', VALID_CODE), { greenhouseId: 'gh-otro' }));
    await assertFails(deleteDoc(doc(db, 'greenhouse_invites', VALID_CODE)));
    // Tampoco crear un código que no es el vigente de su invernadero
    await assertFails(setDoc(doc(db, 'greenhouse_invites', 'GT-LIBRE1'), { greenhouseId: 'gh-otro' }));
    // Ni el admin dueño puede redirigir su código a otro invernadero
    const adminDb = testEnv.authenticatedContext('uid-admin').firestore();
    await assertFails(setDoc(doc(adminDb, 'greenhouse_invites', VALID_CODE), { greenhouseId: 'gh-otro' }));
  });

  it('D: el admin no puede guardar umbrales invertidos, basura ni claves arbitrarias', async () => {
    const db = testEnv.authenticatedContext('uid-admin').firestore();
    await assertFails(updateDoc(gh(db), { thresholds: { ph: { redMin: 9, yellowMin: 8, yellowMax: 1, redMax: 0 } } }));
    await assertFails(updateDoc(gh(db), { thresholds: { ph: { redMin: 'a', yellowMin: 5.5, yellowMax: 6.5, redMax: 7 } } }));
    await assertFails(updateDoc(gh(db), { thresholds: { ph: { redMin: 5, yellowMin: 5.5, yellowMax: 6.5, redMax: 7, extra: 1 } } }));
    await assertFails(updateDoc(gh(db), { thresholds: { co2: { redMin: 1, yellowMin: 2, yellowMax: 3, redMax: 4 } } }));
    await assertFails(updateDoc(gh(db), { x: 'a'.repeat(1000) }));
    // El admin tampoco mete UIDs a memberIds sin su documento de miembro
    await assertFails(updateDoc(gh(db), { memberIds: arrayUnion('uid-amigo') }));
  });

  it('D: el admin guarda umbrales válidos (los 7 por defecto)', async () => {
    const db = testEnv.authenticatedContext('uid-admin').firestore();
    await assertSucceeds(updateDoc(gh(db), {
      thresholds: {
        airTemp: { redMin: 12, yellowMin: 18, yellowMax: 28, redMax: 33 },
        humidity: { redMin: 40, yellowMin: 55, yellowMax: 80, redMax: 90 },
        light: { redMin: 2000, yellowMin: 8000, yellowMax: 35000, redMax: 45000 },
        ph: { redMin: 5.0, yellowMin: 5.5, yellowMax: 6.5, redMax: 7.0 },
        ec: { redMin: 0.8, yellowMin: 1.2, yellowMax: 2.4, redMax: 3.0 },
        solutionTemp: { redMin: 14, yellowMin: 18, yellowMax: 24, redMax: 27 },
        tankLevel: { redMin: 20, yellowMin: 40, yellowMax: 100, redMax: 100 },
      },
    }));
  });
});
