import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateThresholds,
  hasThresholdErrors,
} from '../src/lib/thresholdValidation.ts';
import type { GreenhouseThresholds } from '../src/lib/thresholdsService.ts';

/**
 * T5.3 (#46) — Validación del formulario de umbrales (HU-05).
 * Los valores base son los mismos que usa el proyecto (válidos por definición).
 */

function makeThresholds(overrides: Partial<GreenhouseThresholds> = {}): GreenhouseThresholds {
  return {
    airTemp: { redMin: 12, yellowMin: 18, yellowMax: 28, redMax: 33 },
    humidity: { redMin: 40, yellowMin: 55, yellowMax: 80, redMax: 90 },
    light: { redMin: 2000, yellowMin: 8000, yellowMax: 35000, redMax: 45000 },
    ph: { redMin: 5.0, yellowMin: 5.5, yellowMax: 6.5, redMax: 7.0 },
    ec: { redMin: 0.8, yellowMin: 1.2, yellowMax: 2.4, redMax: 3.0 },
    solutionTemp: { redMin: 14, yellowMin: 18, yellowMax: 24, redMax: 27 },
    tankLevel: { redMin: 20, yellowMin: 40, yellowMax: 100, redMax: 100 },
    ...overrides,
  };
}

describe('validateThresholds (HU-05, T5.3)', () => {
  it('acepta los umbrales por defecto del proyecto', () => {
    const errors = validateThresholds(makeThresholds());
    assert.deepEqual(errors, {});
    assert.equal(hasThresholdErrors(errors), false);
  });

  it('rechaza un mínimo crítico mayor o igual al máximo crítico', () => {
    // Criterio de HU-05: "No se puede guardar un mínimo mayor o igual al máximo"
    const igual = validateThresholds(makeThresholds({ airTemp: { redMin: 20, yellowMin: 18, yellowMax: 28, redMax: 20 } }));
    assert.match(igual.airTemp!, /mínimo crítico debe ser menor que el máximo crítico/);

    const mayor = validateThresholds(makeThresholds({ ph: { redMin: 7.0, yellowMin: 5.5, yellowMax: 6.5, redMax: 6.0 } }));
    assert.match(mayor.ph!, /mínimo crítico debe ser menor que el máximo crítico/);
  });

  it('rechaza un mínimo de precaución mayor o igual al máximo de precaución', () => {
    const errors = validateThresholds(
      makeThresholds({ humidity: { redMin: 40, yellowMin: 70, yellowMax: 70, redMax: 90 } }),
    );
    assert.match(errors.humidity!, /mínimo de precaución debe ser menor que el máximo de precaución/);
  });

  it('rechaza rangos cruzados (crítico fuera del óptimo)', () => {
    const errors = validateThresholds(
      makeThresholds({
        ec: { redMin: 1.5, yellowMin: 1.2, yellowMax: 2.4, redMax: 3.0 },
      }),
    );
    assert.match(errors.ec!, /no puede ser mayor que el mínimo de precaución/);
  });

  it('rechaza un máximo de precaución por encima del máximo crítico', () => {
    const errors = validateThresholds(
      makeThresholds({
        solutionTemp: { redMin: 14, yellowMin: 18, yellowMax: 30, redMax: 27 },
      }),
    );
    assert.match(errors.solutionTemp!, /máximo de precaución no puede ser mayor que el máximo crítico/);
  });

  it('acepta yellowMax === redMax (caso del nivel del tanque al 100 %)', () => {
    const errors = validateThresholds(
      makeThresholds({ tankLevel: { redMin: 20, yellowMin: 40, yellowMax: 100, redMax: 100 } }),
    );
    assert.equal(errors.tankLevel, undefined);
  });

  it('marca solo la variable con problema', () => {
    const errors = validateThresholds(
      makeThresholds({ ph: { redMin: 6.5, yellowMin: 5.5, yellowMax: 6.5, redMax: 7.0 } }),
    );
    assert.deepEqual(Object.keys(errors), ['ph']);
    assert.equal(hasThresholdErrors(errors), true);
  });

  it('rechaza valores no numéricos', () => {
    const errors = validateThresholds(
      makeThresholds({ light: { redMin: Number.NaN, yellowMin: 8000, yellowMax: 35000, redMax: 45000 } }),
    );
    assert.match(errors.light!, /valor numérico válido/);
  });
});

describe('hasThresholdErrors', () => {
  it('es false sin errores y true con al menos uno', () => {
    assert.equal(hasThresholdErrors({}), false);
    assert.equal(hasThresholdErrors({ airTemp: 'x' }), true);
  });
});
