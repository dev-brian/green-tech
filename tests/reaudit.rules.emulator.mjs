/**
 * Reauditoría (25 nov 2026): huecos de firestore.rules que no cubrían las
 * pruebas de C1. Cada prueba describe lo que DEBERÍA pasar.
 *
 * Las que hoy fallan están marcadas con `todo` y el texto del hallazgo: node
 * las corre y las muestra como "# TODO" sin romper CI. Al corregir la regla,
 * quita el `todo` y la prueba queda como protección.
 *
 *   pnpm test:emulator
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDocs, collection, setDoc, updateDoc, writeBatch, arrayRemove, setLogLevel } from 'firebase/firestore';

// Proyecto propio: node --test corre cada archivo en paralelo y clearFirestore es por proyecto.
const PROJECT_ID = 'demo-green-tech-reaudit';
const GH = 'gh-r';
const CODE = 'GT-R2D2X';
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
    await setDoc(doc(db, 'greenhouses', GH), { name: 'Reaudit', inviteCode: CODE, memberIds: ['admin', 'op'] });
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
  });
});

after(async () => {
  await env?.cleanup();
});

describe('Reauditoría — lo que ya está bien', () => {
  it('el operador atiende una alerta abierta con su uid', async () => {
    await assertSucceeds(
      updateDoc(doc(as('op'), 'greenhouses', GH, 'alerts', 'abierta'), { status: 'attended', attendedBy: 'op' }),
    );
  });

  it('nadie puede listar los códigos de invitación', async () => {
    await assertFails(getDocs(collection(as('extrano'), 'greenhouse_invites')));
  });
});

describe('Reauditoría — huecos abiertos', () => {
  it(
    'el único admin no puede salir y dejar el invernadero sin administrador',
    { todo: 'R1: isLeavingGreenhouse deja salir al último admin; el invernadero queda sin nadie que gestione umbrales, zonas ni códigos' },
    async () => {
      const batch = writeBatch(as('admin'));
      batch.update(doc(as('admin'), 'greenhouses', GH), { memberIds: arrayRemove('admin') });
      batch.delete(doc(as('admin'), 'greenhouses', GH, 'members', 'admin'));
      await assertFails(batch.commit());
    },
  );

  it(
    'el único admin no puede quitarse el rol a sí mismo',
    { todo: 'R1: members/{uid} update solo exige ser admin; el último admin puede pasarse a operador' },
    async () => {
      await assertFails(updateDoc(doc(as('admin'), 'greenhouses', GH, 'members', 'admin'), { role: 'operador' }));
    },
  );

  it(
    'al crear un invernadero no se aceptan campos desconocidos ni umbrales inválidos',
    { todo: 'R2: isValidGreenhouseCreate no limita las claves; se pueden crear thresholds invertidos o basura que luego lee el backend' },
    async () => {
      const db = as('nuevo');
      await assertFails(
        setDoc(doc(db, 'greenhouses', 'gh-basura'), {
          name: 'X',
          inviteCode: 'GT-AAAAA',
          memberIds: ['nuevo'],
          thresholds: { ph: { redMin: 9, yellowMin: 8, yellowMax: 1, redMax: 0 } },
          basura: 'a'.repeat(5000),
        }),
      );
    },
  );

  it(
    'no se puede "atender" una alerta que el sistema ya cerró',
    { todo: 'R3: isValidAlertAcknowledge no mira el estado anterior; una alerta auto_resolved vuelve a "attended"' },
    async () => {
      await assertFails(
        updateDoc(doc(as('op'), 'greenhouses', GH, 'alerts', 'cerrada'), { status: 'attended', attendedBy: 'op' }),
      );
    },
  );

  it(
    'la hora de atención la pone el servidor, no el teléfono',
    { todo: 'R3: attendedAt acepta cualquier valor (texto, 1999…); el historial de quién atendió y cuándo no es confiable' },
    async () => {
      await assertFails(
        updateDoc(doc(as('op'), 'greenhouses', GH, 'alerts', 'abierta'), {
          status: 'attended',
          attendedBy: 'op',
          attendedAt: '1999-01-01T00:00:00.000Z',
        }),
      );
    },
  );
});
