import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACTUATOR_ORDER, parseActuatorsDoc } from '../src/lib/actuators.ts';

describe('parseActuatorsDoc (auditoría A2)', () => {
  it('lee el documento que escribe el backend', () => {
    const z = parseActuatorsDoc('zona-1', {
      zoneId: 'zona-1',
      recirculationPump: { on: true, updatedAt: '2026-11-17T10:00:00Z', updatedBy: 'backend' },
      phDoser: { on: false, updatedAt: '2026-11-17T10:00:00Z', updatedBy: 'backend' },
      nutrientDoser: { on: true, updatedAt: '2026-11-17T10:00:00Z', updatedBy: 'backend' },
      ventilation: { on: false, updatedAt: '2026-11-17T10:00:00Z', updatedBy: 'backend' },
      updatedAt: '2026-11-17T10:00:00Z',
    });
    assert.equal(z.recirculationPump.on, true);
    assert.equal(z.phDoser.on, false);
    assert.equal(z.nutrientDoser.updatedBy, 'backend');
    assert.equal(z.updatedAt?.toISOString(), '2026-11-17T10:00:00.000Z');
  });

  it('no inventa estados: lo ausente o mal formado queda en null', () => {
    const z = parseActuatorsDoc('zona-2', { phDoser: { on: 'sí' }, ventilation: 'x' });
    for (const k of ACTUATOR_ORDER) assert.equal(z[k].on, null);
    assert.equal(z.updatedAt, null);
  });

  it('acepta Timestamp de Firestore', () => {
    const d = new Date('2026-11-17T09:00:00Z');
    const z = parseActuatorsDoc('zona-1', { updatedAt: { toDate: () => d } });
    assert.equal(z.updatedAt?.getTime(), d.getTime());
  });
});
