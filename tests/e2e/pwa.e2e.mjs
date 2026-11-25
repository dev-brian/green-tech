/**
 * Pruebas de punta a punta de la PWA en un navegador real (Chromium).
 *
 * Arma el sistema completo en local, sin tocar el proyecto de producción:
 *   - el build de la PWA con VITE_FIREBASE_EMULATORS=true, servido con `vite preview`;
 *   - los emuladores de Auth y Firestore con las firestore.rules del repo;
 *   - el servidor HTTP de ingesta real (simulator/server.ts) escribiendo con el
 *     adaptador real (FirestoreTelemetryStorage), igual que en producción.
 *
 * Cada prueba es un paso del recorrido de un usuario y depende de las
 * anteriores (admin crea el invernadero → llega una lectura → el operador se
 * une → atiende la alerta → …), por eso el archivo corre en orden.
 *
 *   pnpm test:e2e
 *
 * Inicio de sesión: el botón "Continuar con Google" necesita apis.google.com,
 * así que aquí se entra con correo y contraseña de usuarios creados en el
 * emulador (window.__GT_E2E__, solo existe en el build de pruebas). El resto
 * del flujo (onAuthStateChanged, invernaderos, rol, reglas) es el real.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createIngestHttpServer } from '../../simulator/server.ts';
import { FirestoreTelemetryStorage } from '../../simulator/core/firestoreStorage.ts';

const PROJECT_ID = process.env.E2E_PROJECT_ID ?? 'demo-green-tech-e2e';
const PREVIEW_PORT = Number(process.env.E2E_PREVIEW_PORT ?? 4180);
const BASE = `http://127.0.0.1:${PREVIEW_PORT}/green-tech/`;
const DEVICE_KEY = 'e2e-device-key';
const PASSWORD = 'secreto-e2e-123';
const ADMIN = { uid: 'e2e-admin', email: 'ana@e2e.test', displayName: 'Ana Admin' };
const OPERATOR = { uid: 'e2e-op', email: 'oscar@e2e.test', displayName: 'Óscar Operador' };
const STRANGER = { uid: 'e2e-extrano', email: 'eve@e2e.test', displayName: 'Eve Extraña' };
const HEALTHY = { airTemp: 23, humidity: 65, light: 28000, ph: 6.0, ec: 2.6, solutionTemp: 21, tankLevel: 80 };
/** Lo que la PWA debe tardar como máximo en mostrar un cambio que ya está en Firestore. */
const LIVE_MS = 5000;

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

let previewServer;
let ingestServer;
let ingestUrl;
let browser;
let adminApp;
let db;
let greenhouseId;
let inviteCode;
const pages = {};
const consoleErrors = [];

async function ingest(zoneId, readings, crop = 'jitomate') {
  const res = await fetch(`${ingestUrl}/ingestTelemetry`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-key': DEVICE_KEY },
    body: JSON.stringify({ greenhouseId, zoneId, crop, readings: { ...HEALTHY, ...readings } }),
  });
  const body = await res.json();
  assert.equal(res.status, 201, `la ingesta respondió ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function alertsFor(variable) {
  const snap = await db.collection(`greenhouses/${greenhouseId}/alerts`).where('variable', '==', variable).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Abre un contexto nuevo (como otro teléfono) con la sesión de `user`. */
async function openAs(user, { viewport = { width: 390, height: 844 } } = {}) {
  const context = await browser.newContext({ viewport, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[${user.email}] ${m.text()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`[${user.email}] pageerror: ${err.message}`));
  await page.goto(`${BASE}#/login`);
  await page.getByRole('button', { name: 'Aceptar y continuar' }).click();
  await signIn(page, user);
  return page;
}

/**
 * Entra y recarga: así la app arranca con la sesión guardada, que es el mismo
 * camino que sigue al volver de Google (la pantalla espera a saber los
 * invernaderos antes de decidir entre tablero y onboarding).
 */
async function signIn(page, user) {
  await page.waitForFunction(() => '__GT_E2E__' in window);
  await page.evaluate(([email, pw]) => window.__GT_E2E__.signIn(email, pw), [user.email, PASSWORD]);
  await page.reload();
}

const text = (page) => page.locator('body').innerText();

async function waitForText(page, pattern, timeout = LIVE_MS) {
  try {
    await page.getByText(pattern).filter({ visible: true }).first().waitFor({ state: 'visible', timeout });
  } catch (err) {
    const body = await text(page).catch(() => '(sin texto)');
    throw new Error(`No apareció ${pattern} en ${timeout} ms en ${page.url()}.\nPantalla:\n${body.slice(0, 1500)}`, { cause: err });
  }
}

before(async () => {
  adminApp = initializeApp({ projectId: PROJECT_ID }, 'e2e');
  db = getFirestore(adminApp);
  // Empieza limpio: los emuladores pueden venir de una corrida anterior.
  const [host] = [process.env.FIRESTORE_EMULATOR_HOST];
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
  const auth = getAuth(adminApp);
  for (const u of [ADMIN, OPERATOR, STRANGER]) await auth.createUser({ ...u, password: PASSWORD });

  ({ server: ingestServer } = createIngestHttpServer({ deviceKey: DEVICE_KEY, storage: new FirestoreTelemetryStorage(db) }));
  await new Promise((r) => ingestServer.listen(0, '127.0.0.1', r));
  ingestUrl = `http://127.0.0.1:${ingestServer.address().port}`;

  previewServer = await preview({
    root: resolve(import.meta.dirname, '../..'),
    mode: 'production',
    build: { outDir: 'dist-e2e' },
    preview: { port: PREVIEW_PORT, strictPort: true, host: '127.0.0.1' },
    logLevel: 'warn',
  });
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await new Promise((r) => (previewServer ? previewServer.httpServer.close(r) : r()));
  await new Promise((r) => (ingestServer ? ingestServer.close(r) : r()));
  if (adminApp) await deleteApp(adminApp);
  if (consoleErrors.length) {
    console.log(`\nErrores de consola del navegador (${consoleErrors.length}):\n  ${consoleErrors.slice(0, 20).join('\n  ')}`);
  }
});

describe('PWA de punta a punta (navegador + emuladores + ingesta real)', () => {
  it('la landing carga, publica un manifiesto instalable y registra el service worker', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE);
    await waitForText(page, /green\s*tech/i);
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    assert.ok(manifestHref, 'falta <link rel="manifest">');
    const manifest = await (await fetch(new URL(manifestHref, BASE))).json();
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, '/green-tech/');
    for (const icon of manifest.icons) {
      const res = await fetch(new URL(icon.src, new URL(manifestHref, BASE)));
      assert.equal(res.status, 200, `ícono ${icon.src} no existe`);
    }
    assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'), 'falta ícono maskable de 512');
    const scope = await page.evaluate(async () => {
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]);
      return reg ? reg.scope : null;
    });
    assert.equal(scope, BASE, 'el service worker no quedó activo en /green-tech/');
    await context.close();
  });

  it('sin sesión, las pantallas protegidas mandan a iniciar sesión', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    for (const route of ['dashboard', 'alerts', 'zones', 'history', 'plants', 'control']) {
      await page.goto(`${BASE}#/${route}`);
      await page.waitForURL(/#\/login$/, { timeout: LIVE_MS });
    }
    await waitForText(page, 'Continuar con Google');
    await context.close();
  });

  it('el admin entra por primera vez, crea su invernadero y queda como administrador', async () => {
    const page = await openAs(ADMIN);
    pages.admin = page;
    await page.waitForURL(/#\/onboarding$/, { timeout: LIVE_MS });
    await page.getByPlaceholder('Ej. Invernadero Hidropónico Norte').fill('Invernadero E2E');
    await page.getByRole('button', { name: 'Crear Invernadero' }).click();
    await page.waitForURL(/#\/dashboard$/, { timeout: LIVE_MS });
    await waitForText(page, 'Todavía no llegan lecturas');

    const snap = await db.collection('greenhouses').where('memberIds', 'array-contains', ADMIN.uid).get();
    assert.equal(snap.size, 1);
    greenhouseId = snap.docs[0].id;
    inviteCode = snap.docs[0].data().inviteCode;
    assert.match(inviteCode, /^GT-[A-Z2-9]{8}$/);
    const member = await db.doc(`greenhouses/${greenhouseId}/members/${ADMIN.uid}`).get();
    assert.equal(member.data().role, 'admin');
    const invite = await db.doc(`greenhouse_invites/${inviteCode}`).get();
    assert.equal(invite.data().greenhouseId, greenhouseId);
  });

  it('una lectura fuera de rango por HTTP aparece en el tablero, en vivo, en menos de 5 s', async () => {
    const page = pages.admin;
    const started = Date.now();
    const res = await ingest('zona-1', { ph: 8.4 });
    assert.equal(res.createdAlertsCount, 1);
    await waitForText(page, '8.40');
    await waitForText(page, 'El agua está demasiado alcalina');
    const elapsed = Date.now() - started;
    assert.ok(elapsed < LIVE_MS, `tardó ${elapsed} ms`);
    const body = await text(page);
    assert.match(body, /1 crítica/);
    assert.match(body, /6 de 7 lecturas bien/);
  });

  it('el tablero se lee a 360 px sin desplazamiento horizontal', async () => {
    const page = pages.admin;
    await page.setViewportSize({ width: 360, height: 780 });
    await page.waitForTimeout(300);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(scrollWidth <= clientWidth, `la página mide ${scrollWidth} px en una pantalla de ${clientWidth} px`);
    await page.setViewportSize({ width: 390, height: 844 });
  });

  it('un extraño con sesión no ve el invernadero y un código inventado no lo une', async () => {
    const page = await openAs(STRANGER);
    pages.stranger = page;
    await page.waitForURL(/#\/onboarding$/, { timeout: LIVE_MS });
    await page.getByRole('button', { name: /Unirme/ }).first().click();
    await page.getByPlaceholder('GT-8X9B2K4M').fill('GT-ZZZZ9999');
    await page.getByRole('button', { name: 'Unirme como Operador' }).click();
    await waitForText(page, /no válido|inexistente/i);
    const gh = await db.doc(`greenhouses/${greenhouseId}`).get();
    assert.ok(!gh.data().memberIds.includes(STRANGER.uid));
  });

  it('el operador se une con el código desde la pantalla y entra con rol de operador', async () => {
    const page = await openAs(OPERATOR);
    pages.operator = page;
    await page.waitForURL(/#\/onboarding$/, { timeout: LIVE_MS });
    await page.getByRole('button', { name: /Unirme/ }).first().click();
    await page.getByPlaceholder('GT-8X9B2K4M').fill(inviteCode.toLowerCase());
    await page.getByRole('button', { name: 'Unirme como Operador' }).click();
    await page.waitForURL(/#\/dashboard$/, { timeout: LIVE_MS });
    await waitForText(page, '8.40');
    const member = await db.doc(`greenhouses/${greenhouseId}/members/${OPERATOR.uid}`).get();
    assert.equal(member.data().role, 'operador');
  });

  it('el operador no ve Plantas ni puede abrirla a mano, ni guardar umbrales', async () => {
    const page = pages.operator;
    const nav = await page.locator('nav, header').allInnerTexts();
    assert.ok(!nav.join(' ').includes('Plantas'), `el menú del operador muestra Plantas: ${nav.join(' | ')}`);
    await page.goto(`${BASE}#/plants`);
    await page.waitForURL(/#\/dashboard$/, { timeout: LIVE_MS });
    await page.goto(`${BASE}#/alerts`);
    await waitForText(page, 'Historial de alertas');
    assert.equal(await page.getByRole('button', { name: 'Guardar configuración' }).count(), 0, 'el operador ve "Guardar configuración" de umbrales');
  });

  it('el operador atiende la alerta, el admin lo ve en vivo y la siguiente lectura mala no la duplica (C4)', async () => {
    const page = pages.operator;
    await page.getByRole('button', { name: 'Marcar como atendida' }).first().click();
    let [alert] = await alertsFor('ph');
    for (let i = 0; i < 25 && alert.status !== 'attended'; i++) {
      await new Promise((r) => setTimeout(r, 200));
      [alert] = await alertsFor('ph');
    }
    assert.equal(alert.status, 'attended');
    assert.equal(alert.attendedBy, OPERATOR.uid);

    await pages.admin.goto(`${BASE}#/alerts`);
    await waitForText(pages.admin, /Atendida hace/);

    const res = await ingest('zona-1', { ph: 8.6 });
    assert.equal(res.createdAlertsCount, 0, 'la lectura siguiente creó otra alerta de pH');
    const all = await alertsFor('ph');
    assert.equal(all.length, 1, `hay ${all.length} alertas de pH`);
  });

  it('al volver a rango la alerta se cierra sola y el tablero pasa a "en orden"', async () => {
    const res = await ingest('zona-1', { ph: 6.0 });
    assert.equal(res.resolvedAlertsCount, 1);
    const [alert] = await alertsFor('ph');
    assert.equal(alert.status, 'auto_resolved');
    await pages.admin.goto(`${BASE}#/dashboard`);
    await waitForText(pages.admin, '7 de 7');
  });

  it('el admin registra la zona como lechuga y el tablero la evalúa con ese cultivo', async () => {
    const page = pages.admin;
    await page.goto(`${BASE}#/zones`);
    await page.getByRole('button', { name: 'Registrar' }).first().click();
    const dialog = page.locator('form, [role="dialog"]').last();
    const nameInput = dialog.locator('input[type="text"], input:not([type])').first();
    await nameInput.fill('Mesa norte');
    const crop = dialog.getByRole('combobox');
    if (await crop.count()) await crop.first().selectOption({ label: /Lechuga/ }).catch(() => crop.first().selectOption('lechuga'));
    else await dialog.getByText(/Lechuga/).first().click();
    await dialog.getByRole('button', { name: /Guardar|Registrar|Crear/ }).last().click();
    let zone;
    for (let i = 0; i < 25 && !zone?.exists; i++) {
      await new Promise((r) => setTimeout(r, 200));
      zone = await db.doc(`greenhouses/${greenhouseId}/zones/zona-1`).get();
    }
    assert.ok(zone.exists, 'no se guardó la zona');
    assert.equal(zone.data().name, 'Mesa norte');
    assert.equal(zone.data().crop, 'lechuga');

    // EC 2.6 está bien para jitomate pero es alta para lechuga (0.8 a 1.2).
    const res = await ingest('zona-1', { ec: 2.6 }, 'jitomate');
    assert.equal(res.zoneState.crop, 'lechuga', 'el backend no usó el cultivo que registró el admin');
    assert.notEqual(res.zoneState.ec.level, 'ok');
    await page.goto(`${BASE}#/dashboard`);
    await waitForText(page, 'Mesa norte');
    await waitForText(page, /Lechuga/);
  });

  it('el admin no ve "Abandonar" (dejaría el invernadero sin admin) y el código que comparte es largo (R1, R4)', async () => {
    const page = pages.admin;
    // En celular la configuración vive en el menú del invernadero; en escritorio hay botón.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}#/dashboard`);
    await page.getByRole('button', { name: 'Configuración del Invernadero' }).first().click();
    await waitForText(page, 'Como administrador no puedes abandonar');
    assert.equal(await page.getByRole('button', { name: 'Abandonar Invernadero' }).count(), 0);
    await waitForText(page, inviteCode);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
  });

  it('si el sensor deja de mandar, la zona pasa a "sin datos" aunque no llegue nada nuevo (C2)', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.clock.install();
    const page = await context.newPage();
    await page.goto(`${BASE}#/login`);
    await page.getByRole('button', { name: 'Aceptar y continuar' }).click();
    await signIn(page, ADMIN);
    await page.waitForURL(/#\/dashboard$/, { timeout: LIVE_MS });
    await waitForText(page, 'Mesa norte');
    assert.doesNotMatch(await text(page), /Sin datos recientes/);
    // 16 min sin lecturas nuevas; después dos ciclos del reloj de la pantalla (cada 30 s).
    await context.clock.fastForward('16:00');
    await context.clock.runFor(61_000);
    await waitForText(page, /Sin datos recientes|sin datos/i, 10000);
    await context.close();
  });

  it('sin red la PWA abre desde la caché con los últimos datos y avisa "Sin conexión"', async () => {
    const page = pages.operator;
    await page.goto(`${BASE}#/dashboard`);
    await waitForText(page, 'Mesa norte');
    await page.context().setOffline(true);
    try {
      await waitForText(page, /Sin conexión/);
      await page.reload();
      await waitForText(page, 'Mesa norte', 10000);
      await waitForText(page, /Sin conexión/);
    } finally {
      await page.context().setOffline(false);
    }
  });

  it('una alerta atendida sin red se envía sola al volver la conexión', async () => {
    const res = await ingest('zona-1', { tankLevel: 10 }, 'lechuga');
    assert.ok(res.createdAlertsCount >= 1);
    const page = pages.operator;
    await page.goto(`${BASE}#/alerts`);
    await waitForText(page, /Nivel del Tanque|tanque/i);
    await page.context().setOffline(true);
    try {
      await page.getByRole('button', { name: 'Marcar como atendida' }).first().click();
      await page.waitForTimeout(500);
      const [offlineAlert] = await alertsFor('tankLevel');
      assert.equal(offlineAlert.status, 'new', 'la escritura no debería llegar sin red');
    } finally {
      await page.context().setOffline(false);
    }
    let alert;
    for (let i = 0; i < 50; i++) {
      [alert] = await alertsFor('tankLevel');
      if (alert.status === 'attended') break;
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.equal(alert.status, 'attended', 'la alerta atendida sin red no se sincronizó al volver la red');
  });

  it('al cerrar sesión no queda el invernadero ni la caché de Firestore en el teléfono', async () => {
    const page = pages.operator;
    await page.goto(`${BASE}#/dashboard`);
    const opened = await page.getByRole('button', { name: /^[A-ZÓ]$/ }).first();
    await opened.click();
    // Salir borra la caché y recarga la página: se espera esa recarga.
    await Promise.all([
      page.waitForEvent('load', { timeout: 10000 }),
      page.getByRole('button', { name: /Cerrar sesión|Salir/ }).first().click(),
    ]);
    assert.match(page.url(), /#\/login$/);
    await waitForText(page, 'Continuar con Google');
    // Tras recargar, la app vuelve a abrir Firestore y crea la base de nuevo;
    // lo que importa es que no quede ningún documento del invernadero.
    const left = await page.evaluate(async () => {
      const names = (await indexedDB.databases()).map((d) => d.name).filter((n) => n && n.startsWith('firestore/'));
      let docs = 0;
      for (const name of names) {
        const idb = await new Promise((res, rej) => {
          const r = indexedDB.open(name);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        for (const store of ['remoteDocuments', 'remoteDocumentsV14', 'mutations', 'documentOverlays']) {
          if (!idb.objectStoreNames.contains(store)) continue;
          docs += await new Promise((res) => {
            const req = idb.transaction(store).objectStore(store).count();
            req.onsuccess = () => res(req.result);
            req.onerror = () => res(0);
          });
        }
        idb.close();
      }
      return { ws: localStorage.getItem('gt_active_workspace'), docs };
    });
    assert.equal(left.ws, null);
    assert.equal(left.docs, 0, `quedaron ${left.docs} documentos de Firestore en IndexedDB`);
  });
});
