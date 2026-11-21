import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authErrorMessage, shouldFallBackToRedirect } from '../src/lib/authErrors.ts';

const err = (code: string) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });

describe('mensajes de inicio de sesión (auditoría A9, #35)', () => {
  it('no muestra el texto en inglés de Firebase', () => {
    for (const code of ['auth/network-request-failed', 'auth/popup-blocked', 'auth/algo-nuevo']) {
      const msg = authErrorMessage(err(code));
      assert.ok(msg && !msg.includes('Firebase'), code);
    }
  });

  it('cerrar la ventana de Google no es un error', () => {
    assert.equal(authErrorMessage(err('auth/popup-closed-by-user')), null);
    assert.equal(authErrorMessage(err('auth/cancelled-popup-request')), null);
  });

  it('sin red lo dice claro', () => {
    assert.match(authErrorMessage(err('auth/network-request-failed')) ?? '', /conexión/);
  });

  it('un error sin código da un mensaje genérico en español', () => {
    assert.match(authErrorMessage(new Error('boom')) ?? '', /No se pudo iniciar sesión/);
  });

  it('usa redirección solo si la ventana emergente no se puede abrir', () => {
    assert.equal(shouldFallBackToRedirect(err('auth/popup-blocked')), true);
    assert.equal(shouldFallBackToRedirect(err('auth/operation-not-supported-in-this-environment')), true);
    assert.equal(shouldFallBackToRedirect(err('auth/network-request-failed')), false);
  });
});
