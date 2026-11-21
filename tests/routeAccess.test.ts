import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAccess, decideRoute, ROUTE_ROLES } from '../src/lib/routeAccess.ts';

/** T1.1 (#34) — Menú y rutas por rol (HU-01). */
describe('canAccess (HU-01, T1.1)', () => {
  it('el operador no entra a Plantas; el admin sí', () => {
    assert.equal(canAccess('/plants', 'operador'), false);
    assert.equal(canAccess('/plants', 'admin'), true);
  });

  it('las pantallas de campo son para los dos roles', () => {
    for (const path of ['/dashboard', '/alerts', '/history', '/control', '/zones']) {
      assert.equal(canAccess(path, 'operador'), true, path);
      assert.equal(canAccess(path, 'admin'), true, path);
    }
  });
});

describe('decideRoute (HU-01, T1.1)', () => {
  const base = { loading: false, signedIn: true, hasWorkspace: true, requireWorkspace: true, role: 'operador' as const };

  it('espera mientras carga la sesión (no saca al usuario al recargar)', () => {
    assert.deepEqual(decideRoute({ ...base, loading: true, signedIn: false }), { kind: 'loading' });
  });

  it('sin sesión manda a login', () => {
    assert.deepEqual(decideRoute({ ...base, signedIn: false }), { kind: 'login' });
  });

  it('sin invernadero manda a onboarding, salvo en el propio onboarding', () => {
    assert.deepEqual(decideRoute({ ...base, hasWorkspace: false }), { kind: 'onboarding' });
    assert.deepEqual(decideRoute({ ...base, hasWorkspace: false, requireWorkspace: false }), { kind: 'allow' });
  });

  it('un operador que abre /plants a mano regresa al tablero', () => {
    assert.deepEqual(decideRoute({ ...base, allowedRoles: ROUTE_ROLES['/plants'] }), { kind: 'dashboard' });
    assert.deepEqual(decideRoute({ ...base, role: 'admin', allowedRoles: ROUTE_ROLES['/plants'] }), { kind: 'allow' });
  });
});
