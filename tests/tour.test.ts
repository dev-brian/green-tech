import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUR_STEPS, stepsForRole, nextShowableIndex, resolveTarget, hasSeenTour, markTourSeen, tourStorageKey,
} from '../src/lib/tour.ts';

/** Recorrido guiado para usuarios nuevos. */
describe('stepsForRole', () => {
  it('el operador no ve el paso de Cultivos; el admin sí', () => {
    assert.equal(stepsForRole(false).some((s) => s.id === 'nav-cultivos'), false);
    assert.equal(stepsForRole(true).some((s) => s.id === 'nav-cultivos'), true);
  });
  it('los ids no se repiten y ningún texto lleva emojis', () => {
    assert.equal(new Set(TOUR_STEPS.map((s) => s.id)).size, TOUR_STEPS.length);
    for (const s of TOUR_STEPS) assert.doesNotMatch(s.title + s.body, /\p{Extended_Pictographic}/u, s.id);
  });
});

describe('nextShowableIndex', () => {
  const steps = [
    { id: 'a', title: '', body: '' },
    { id: 'b', title: '', body: '', targets: ['#no-esta'] },
    { id: 'c', title: '', body: '', targets: ['#no-esta', '#si-esta'] },
  ];
  const visible = (sel: string) => sel === '#si-esta';
  it('salta los pasos cuyo elemento no está en pantalla', () => {
    assert.equal(nextShowableIndex(steps, 1, 1, visible), 2);
    assert.equal(nextShowableIndex(steps, 1, -1, visible), 0);
  });
  it('devuelve -1 al pasar del último o del primero', () => {
    assert.equal(nextShowableIndex(steps, 3, 1, visible), -1);
    assert.equal(nextShowableIndex(steps, -1, -1, visible), -1);
  });
  it('usa el primer selector visible del paso', () => {
    assert.equal(resolveTarget(steps[2], visible), '#si-esta');
    assert.equal(resolveTarget(steps[0], visible), null);
  });
});

describe('visto / no visto', () => {
  it('se guarda por usuario', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    assert.equal(hasSeenTour(storage, 'u1'), false);
    markTourSeen(storage, 'u1');
    assert.equal(hasSeenTour(storage, 'u1'), true);
    assert.equal(hasSeenTour(storage, 'u2'), false);
    assert.equal(data.get(tourStorageKey('u1')), '1');
  });
  it('sin almacenamiento (ventana privada) no insiste ni truena', () => {
    const broken = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
    assert.equal(hasSeenTour(broken, 'u1'), true);
    assert.doesNotThrow(() => markTourSeen(broken, 'u1'));
    assert.equal(hasSeenTour(undefined, 'u1'), true);
  });
});
