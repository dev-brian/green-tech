/**
 * Reauditoría (25 nov 2026): huecos de firestore.rules que no cubrían las
 * pruebas de C1 (R1 a R4), ya corregidos. Cada bloque prueba el ataque y que
 * el uso normal de la PWA y de la app Flutter siga funcionando.
 *
 *   pnpm test:emulator
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDocs, collection, setDoc, updateDoc, deleteDoc, writeBatch, arrayRemove, arrayUnion, serverTimestamp, setLogLevel,
} from 'firebase/firestore';

// Proyecto propio: node --test corre cada archivo en paralelo y clearFirestore es por proyecto.
const PROJECT_ID = 'demo-green-tech-reaudit';
const GH = 'gh-r';
const CODE = 'GT-R2D2X3Y4';
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
    await setDoc(doc(db, 'greenhouses', GH), { name: 'Reaudit', inviteCode: CODE, memberIds: ['admin', 'op', 'admin2'] });
    await setDoc(doc(db, 'greenhouses', GH, 'members', 'admin2'), { role: 'admin' });
    await setDoc(doc(db, 'greenhouses', GH, 'members', 'admin'), { role: 'admin' });
    await setDoc(doc(db, 'greenhouses', GH, 'members', 'op'), { role: 'operador' });
    await setDoc(doc(db, 'greenhouse_invites', CODE), { greenhouseId: GH });
    await setDoc(doc(db, 'greenhouses', GH, 'alerts', 'cerrada'), {
      status: 'auto_resolved',
      resolvedAt: '2026-11-25T10:00:00.000Z',
      variable: 'ph',
      zoneId: 'zona-1',
    });
    await setDoc(doc(db, 'greenhouses', GH, 'alerts', 'abierta'), { status: 'new', variable: 'ec', zoneId: 'zona-1' });
    await setDoc(doc(db, 'greenhouses', 'gh-viejo'), { name: 'Viejo', inviteCode: 'GT-VIEJ5', memberIds: ['admin'] });
    await setDoc(doc(db, 'greenhouses', 'gh-viejo', 'members', 'admin'), { role: 'admin' });
    await setDoc(doc(db, 'greenhouse_invites', 'GT-VIEJ5'), { greenhouseId: 'gh-viejo' });
  });
});

/** Unión como la hacen la PWA y la app Flutter: memberIds + members/{uid} en un batch. */
function joinBatch(uid, gh, code) {
  const db = as(uid);
  const batch = writeBatch(db);
  batch.update(doc(db, 'greenhouses', gh), { memberIds: arrayUnion(uid) });
  batch.set(doc(db, 'greenhouses', gh, 'members', uid), { role: 'operador', inviteCode: code, email: null, name: null });
  return batch.commit();
}

/** Salida como la hacen la PWA y la app Flutter. */
function leaveBatch(uid, gh = GH) {
  const db = as(uid);
  const batch = writeBatch(db);
  batch.update(doc(db, 'greenhouses', gh), { memberIds: arrayRemove(uid) });
  batch.delete(doc(db, 'greenhouses', gh, 'members', uid));
  return batch.commit();
}

after(async () => {
  await env?.cleanup();
});

describe('R1 — siempre queda un admin', () => {
  it('un admin no puede salir del invernadero, ni siendo el único ni habiendo otro', async () => {
    await assertFails(leaveBatch('admin'));
    await assertFails(leaveBatch('admin', 'gh-viejo'));
  });

  it('un admin no puede quitarse el rol, ni borrar su propio documento, ni sacarse de memberIds', async () => {
    await assertFails(updateDoc(doc(as('admin'), 'greenhouses', GH, 'members', 'admin'), { role: 'operador' }));
    await assertFails(deleteDoc(doc(as('admin'), 'greenhouses', GH, 'members', 'admin')));
    await assertFails(updateDoc(doc(as('admin'), 'greenhouses', GH), { memberIds: arrayRemove('admin') }));
  });

  it('otro admin sí puede quitarle el rol y después ese operador sale normal', async () => {
    await assertSucceeds(updateDoc(doc(as('admin2'), 'greenhouses', GH, 'members', 'admin'), { role: 'operador' }));
    await assertSucceeds(leaveBatch('admin'));
  });

  it('el admin sigue expulsando a otros y el operador sigue saliendo solo', async () => {
    const db = as('admin');
    const kick = writeBatch(db);
    kick.update(doc(db, 'greenhouses', GH), { memberIds: arrayRemove('admin2') });
    kick.delete(doc(db, 'greenhouses', GH, 'members', 'admin2'));
    await assertSucceeds(kick.commit());
    await assertSucceeds(leaveBatch('op'));
  });
});

describe('R2 — el invernadero se valida al crearlo', () => {
  const nuevo = (extra = {}) => ({
    name: 'Nuevo', inviteCode: 'GT-NUEVO2345', inviteCodeCreatedAt: '2026-11-25T12:00:00.000Z',
    memberIds: ['nuevo'], createdAt: '2026-11-25T12:00:00.000Z', ...extra,
  });

  it('rechaza claves desconocidas y umbrales colados en la creación', async () => {
    await assertFails(setDoc(doc(as('nuevo'), 'greenhouses', 'gh-b1'), nuevo({ basura: 'a'.repeat(5000) })));
    await assertFails(setDoc(doc(as('nuevo'), 'greenhouses', 'gh-b2'), nuevo({
      thresholds: { ph: { redMin: 9, yellowMin: 8, yellowMax: 1, redMax: 0 } },
    })));
  });

  it('crear como lo hace la PWA (invernadero + admin + invitación en un batch) sigue funcionando', async () => {
    const db = as('nuevo');
    const batch = writeBatch(db);
    batch.set(doc(db, 'greenhouses', 'gh-ok'), nuevo());
    batch.set(doc(db, 'greenhouses', 'gh-ok', 'members', 'nuevo'), { role: 'admin', email: 'n@x', name: 'N', joinedAt: 'x' });
    batch.set(doc(db, 'greenhouse_invites', 'GT-NUEVO2345'), { greenhouseId: 'gh-ok', createdAt: 'x' });
    await assertSucceeds(batch.commit());
  });
});

describe('R3 — atender alertas', () => {
  it('el operador atiende una alerta abierta con la hora del servidor (PWA y Flutter)', async () => {
    await assertSucceeds(updateDoc(doc(as('op'), 'greenhouses', GH, 'alerts', 'abierta'), {
      status: 'attended', attendedBy: 'op', attendedAt: serverTimestamp(),
    }));
  });

  it('no se puede "atender" una alerta que el sistema ya cerró', async () => {
    await assertFails(updateDoc(doc(as('op'), 'greenhouses', GH, 'alerts', 'cerrada'), {
      status: 'attended', attendedBy: 'op', attendedAt: serverTimestamp(),
    }));
  });

  it('la hora de atención no la elige el teléfono', async () => {
    await assertFails(updateDoc(doc(as('op'), 'greenhouses', GH, 'alerts', 'abierta'), {
      status: 'attended', attendedBy: 'op', attendedAt: '1999-01-01T00:00:00.000Z',
    }));
  });

  it('una alerta ya atendida no se vuelve a firmar con otro uid', async () => {
    await assertSucceeds(updateDoc(doc(as('op'), 'greenhouses', GH, 'alerts', 'abierta'), {
      status: 'attended', attendedBy: 'op', attendedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(as('admin'), 'greenhouses', GH, 'alerts', 'abierta'), {
      status: 'attended', attendedBy: 'admin', attendedAt: serverTimestamp(),
    }));
  });
});

describe('R4 — códigos de invitación difíciles de adivinar', () => {
  it('con un código largo vigente, unirse funciona', async () => {
    await assertSucceeds(joinBatch('nuevo', GH, CODE));
  });

  it('un código viejo de 5 caracteres ya no sirve para unirse', async () => {
    await assertFails(joinBatch('nuevo', 'gh-viejo', 'GT-VIEJ5'));
  });

  it('no se puede crear un invernadero ni regenerar el código con uno corto', async () => {
    await assertFails(setDoc(doc(as('nuevo'), 'greenhouses', 'gh-corto'), {
      name: 'Corto', inviteCode: 'GT-AB2C3', memberIds: ['nuevo'],
    }));
    await assertFails(updateDoc(doc(as('admin'), 'greenhouses', GH), { inviteCode: 'GT-AB2C3' }));
    await assertSucceeds(updateDoc(doc(as('admin'), 'greenhouses', GH), { inviteCode: 'GT-NUEVO2345' }));
  });

  it('nadie puede listar los códigos de invitación', async () => {
    await assertFails(getDocs(collection(as('extrano'), 'greenhouse_invites')));
  });
});
