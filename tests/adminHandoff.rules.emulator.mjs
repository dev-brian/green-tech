/**
 * Ceder la administración y eliminar un invernadero desde la PWA (26 nov 2026).
 * Antes no había forma: un admin no podía salir (R1) ni borrar su cuenta en la
 * app. Prueba que el flujo de la PWA pasa las reglas sin cambiarlas.
 *
 *   pnpm test:emulator
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, updateDoc, writeBatch, arrayRemove, setDoc, setLogLevel } from 'firebase/firestore';

const PROJECT_ID = 'demo-green-tech-handoff';
const GH = 'gh-h';
const CODE = 'GT-H4ND0FF1';
let env;

const as = (uid) => env.authenticatedContext(uid).firestore();

before(async () => {
  setLogLevel('error');
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'greenhouses', GH), { name: 'Demo', inviteCode: CODE, memberIds: ['admin', 'op'] });
    await setDoc(doc(db, 'greenhouses', GH, 'members', 'admin'), { role: 'admin' });
    await setDoc(doc(db, 'greenhouses', GH, 'members', 'op'), { role: 'operador' });
    await setDoc(doc(db, 'greenhouse_invites', CODE), { greenhouseId: GH });
  });
});

after(async () => {
  await env?.cleanup();
});

/** Como deleteWorkspace() de la PWA: código de invitación + invernadero en un batch. */
function deleteBatch(uid) {
  const db = as(uid);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'greenhouse_invites', CODE));
  batch.delete(doc(db, 'greenhouses', GH));
  return batch.commit();
}

describe('ceder la administración', () => {
  it('el admin hace admin a un operador, y ese nuevo admin lo saca', async () => {
    await assertSucceeds(updateDoc(doc(as('admin'), 'greenhouses', GH, 'members', 'op'), { role: 'admin' }));
    const db = as('op');
    const batch = writeBatch(db);
    batch.update(doc(db, 'greenhouses', GH), { memberIds: arrayRemove('admin') });
    batch.delete(doc(db, 'greenhouses', GH, 'members', 'admin'));
    await assertSucceeds(batch.commit());
  });

  it('un operador no puede hacerse admin ni cambiar roles', async () => {
    await assertFails(updateDoc(doc(as('op'), 'greenhouses', GH, 'members', 'op'), { role: 'admin' }));
    await assertFails(updateDoc(doc(as('op'), 'greenhouses', GH, 'members', 'admin'), { role: 'operador' }));
  });
});

describe('eliminar el invernadero', () => {
  it('el admin lo borra junto con su código; el operador deja de verlo', async () => {
    await assertSucceeds(deleteBatch('admin'));
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      if ((await getDoc(doc(db, 'greenhouses', GH))).exists()) throw new Error('el invernadero sigue');
      if ((await getDoc(doc(db, 'greenhouse_invites', CODE))).exists()) throw new Error('el código sigue');
    });
    await assertFails(getDoc(doc(as('op'), 'greenhouses', GH, 'members', 'op')));
  });

  it('un operador no puede borrarlo', async () => {
    await assertFails(deleteBatch('op'));
  });
});
