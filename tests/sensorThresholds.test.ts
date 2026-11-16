import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { statusFor, THRESHOLDS, worstOf, levelToStatus } from '../src/lib/sensorThresholds.ts';

describe('statusFor (7 variables hidropónicas)', () => {
  const t = THRESHOLDS.airTemp;

  it('devuelve green dentro del rango óptimo de airTemp', () => {
    assert.equal(statusFor(22, t), 'green');
  });

  it('devuelve yellow en los bordes de precaución de airTemp', () => {
    assert.equal(statusFor(15, t), 'yellow');
    assert.equal(statusFor(30, t), 'yellow');
  });

  it('devuelve red fuera de los límites críticos de airTemp', () => {
    assert.equal(statusFor(10, t), 'red');
    assert.equal(statusFor(35, t), 'red');
  });

  it('evalúa pH, EC y nivel de tanque hidropónico correctamente', () => {
    assert.equal(statusFor(6.0, THRESHOLDS.ph), 'green');
    assert.equal(statusFor(4.8, THRESHOLDS.ph), 'red');
    assert.equal(statusFor(1.8, THRESHOLDS.ec), 'green');
    assert.equal(statusFor(3.2, THRESHOLDS.ec), 'red');
    assert.equal(statusFor(80, THRESHOLDS.tankLevel), 'green');
    assert.equal(statusFor(15, THRESHOLDS.tankLevel), 'red');
  });

  it('convierte level de state/latest (ok/warn/critical) a SensorStatus', () => {
    assert.equal(levelToStatus('ok'), 'green');
    assert.equal(levelToStatus('warn'), 'yellow');
    assert.equal(levelToStatus('critical'), 'red');
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
