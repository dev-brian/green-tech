import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPendingWrites, pendingText, subscribePendingWrites, trackWrite } from '../src/lib/pendingWrites.ts';

/** T10.3 (#61) — Marcar cambios pendientes de enviar (HU-10). */
describe('pendingWrites (HU-10, T10.3)', () => {
  it('cuenta la escritura mientras no se confirma y la quita al confirmarse', async () => {
    let resolve!: () => void;
    const write = new Promise<void>((r) => { resolve = r; });
    const seen: number[] = [];
    const unsub = subscribePendingWrites((p) => seen.push(p.length));
    trackWrite('Umbrales', write);
    assert.equal(getPendingWrites().length, 1);
    assert.equal(getPendingWrites()[0].label, 'Umbrales');
    resolve();
    await write;
    await Promise.resolve();
    assert.equal(getPendingWrites().length, 0);
    assert.deepEqual(seen, [1, 0]);
    unsub();
  });

  it('también la quita si falla', async () => {
    const write = Promise.reject(new Error('permiso'));
    await assert.rejects(trackWrite('Alerta', write));
    await Promise.resolve();
    assert.equal(getPendingWrites().length, 0);
  });

  it('texto en singular y plural', () => {
    assert.equal(pendingText(1), '1 cambio pendiente de enviar');
    assert.equal(pendingText(3), '3 cambios pendientes de enviar');
  });
});
