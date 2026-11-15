/**
 * Reglas de la subcolección zones (HU-04 #63, T4.1 #64) contra el emulador.
 *   pnpm test:emulator
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, setLogLevel } from 'firebase/firestore';

// Proyecto propio: node --test corre cada archivo en paralelo y clearFirestore es por proyecto.
const PROJECT_ID = 'demo-green-tech-zones';
const GH = 'gh-zonas';
let testEnv;

before(async () => {
  setLogLevel('error');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'greenhouses', GH), { name: 'GH', inviteCode: 'GT-1', memberIds: ['uid-admin', 'uid-op'] });
    await setDoc(doc(db, 'greenhouses', GH, 'members', 'uid-admin'), { role: 'admin' });
    await setDoc(doc(db, 'greenhouses', GH, 'members', 'uid-op'), { role: 'operador' });
    await setDoc(doc(db, 'greenhouses', GH, 'zones', 'zona-1'), { name: 'Zona 1', crop: 'jitomate' });
  });
});

const zoneRef = (db, id) => doc(db, 'greenhouses', GH, 'zones', id);

describe('Reglas de zonas (T4.1 #64)', () => {
  it('el admin crea, renombra, cambia cultivo y borra una zona', async () => {
    const db = testEnv.authenticatedContext('uid-admin').firestore();
    await assertSucceeds(
      setDoc(zoneRef(db, 'zona-2'), { name: 'Mesa norte', crop: 'lechuga', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(updateDoc(zoneRef(db, 'zona-2'), { name: 'Mesa sur', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(zoneRef(db, 'zona-2'), { crop: 'jitomate' }));
    await assertSucceeds(deleteDoc(zoneRef(db, 'zona-2')));
  });

  it('el operador lee las zonas pero no puede crearlas, editarlas ni borrarlas', async () => {
    const db = testEnv.authenticatedContext('uid-op').firestore();
    await assertSucceeds(getDoc(zoneRef(db, 'zona-1')));
    await assertFails(setDoc(zoneRef(db, 'zona-2'), { name: 'X', crop: 'lechuga' }));
    await assertFails(updateDoc(zoneRef(db, 'zona-1'), { name: 'Otra' }));
    await assertFails(deleteDoc(zoneRef(db, 'zona-1')));
  });

  it('quien no es miembro no puede ni leer', async () => {
    const db = testEnv.authenticatedContext('uid-intruso').firestore();
    await assertFails(getDoc(zoneRef(db, 'zona-1')));
  });

  it('rechaza cultivos fuera de jitomate/lechuga, nombres vacíos o largos y campos extra', async () => {
    const db = testEnv.authenticatedContext('uid-admin').firestore();
    await assertFails(setDoc(zoneRef(db, 'zona-3'), { name: 'Hierbas', crop: 'albahaca' }));
    await assertFails(setDoc(zoneRef(db, 'zona-3'), { name: '', crop: 'lechuga' }));
    await assertFails(setDoc(zoneRef(db, 'zona-3'), { name: 'x'.repeat(61), crop: 'lechuga' }));
    await assertFails(setDoc(zoneRef(db, 'zona-3'), { name: 'Z', crop: 'lechuga', thresholds: {} }));
    await assertFails(updateDoc(zoneRef(db, 'zona-1'), { crop: 'pepino' }));
  });

  it('rechaza ids de zona que el sensor no podría mandar', async () => {
    const db = testEnv.authenticatedContext('uid-admin').firestore();
    await assertFails(setDoc(zoneRef(db, 'Zona 3'), { name: 'Z', crop: 'lechuga' }));
  });
});
