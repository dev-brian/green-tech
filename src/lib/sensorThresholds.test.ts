import { describe, expect, it } from 'vitest';
import { THRESHOLDS, statusFor, worstOf } from './sensorThresholds';

const t = THRESHOLDS.temperature; // rojo < 12, amarillo < 18, verde 18–27, amarillo > 27, rojo > 32

describe('statusFor', () => {
  it('marca verde dentro del rango ideal', () => {
    expect(statusFor(22, t)).toBe('green');
  });

  it('incluye los límites del rango verde', () => {
    expect(statusFor(t.yellowMin, t)).toBe('green');
    expect(statusFor(t.yellowMax, t)).toBe('green');
  });

  it('marca amarillo entre el rango ideal y el crítico', () => {
    expect(statusFor(15, t)).toBe('yellow');
    expect(statusFor(30, t)).toBe('yellow');
  });

  it('marca rojo fuera del rango crítico', () => {
    expect(statusFor(5, t)).toBe('red');
    expect(statusFor(40, t)).toBe('red');
  });
});

describe('worstOf', () => {
  it('devuelve rojo si alguna variable está en rojo', () => {
    expect(worstOf('green', 'yellow', 'red')).toBe('red');
  });

  it('devuelve amarillo si la peor variable está en amarillo', () => {
    expect(worstOf('green', 'yellow', 'green')).toBe('yellow');
  });

  it('devuelve verde si todas están en verde', () => {
    expect(worstOf('green', 'green')).toBe('green');
  });
});
