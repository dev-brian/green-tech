import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { statusFor, THRESHOLDS, worstOf } from '../src/lib/sensorThresholds.ts';

describe('statusFor', () => {
  const t = THRESHOLDS.temperature;

  it('devuelve green dentro del rango óptimo', () => {
    assert.equal(statusFor(22, t), 'green');
  });

  it('devuelve yellow en los bordes de precaución', () => {
    assert.equal(statusFor(15, t), 'yellow');
    assert.equal(statusFor(30, t), 'yellow');
  });

  it('devuelve red fuera de los límites críticos', () => {
    assert.equal(statusFor(10, t), 'red');
    assert.equal(statusFor(35, t), 'red');
  });
});

describe('worstOf', () => {
  it('prioriza red sobre yellow y green', () => {
    assert.equal(worstOf('green', 'yellow', 'red'), 'red');
  });

  it('prioriza yellow sobre green', () => {
    assert.equal(worstOf('green', 'yellow'), 'yellow');
  });

  it('devuelve green cuando todos están en green', () => {
    assert.equal(worstOf('green', 'green'), 'green');
  });
});
