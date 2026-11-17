import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CROP_PROFILES,
  CROP_OPTIONS,
  defaultThresholdsFor,
} from '../src/lib/cropProfiles.ts';
import { validateThresholds } from '../src/lib/thresholdValidation.ts';
import { DEFAULT_CROP_THRESHOLDS } from '../simulator/core/hydroponicModel.ts';

/**
 * T5.2 (#45) — Perfiles de jitomate y lechuga (HU-05).
 * Valida el criterio: "Hay valores por defecto de las 7 variables para
 * jitomate y lechuga hidropónicos".
 */

const VARIABLES = [
  'airTemp', 'humidity', 'light', 'ph', 'ec', 'solutionTemp', 'tankLevel',
] as const;

describe('CROP_PROFILES (HU-05, T5.2)', () => {
  it('expone los dos cultivos con las 7 variables', () => {
    assert.deepEqual([...CROP_OPTIONS], ['jitomate', 'lechuga']);
    for (const crop of CROP_OPTIONS) {
      assert.deepEqual(Object.keys(CROP_PROFILES[crop]).sort(), [...VARIABLES].sort());
    }
  });

  it('cumple los valores del criterio de la historia', () => {
    for (const crop of CROP_OPTIONS) {
      const { ph, solutionTemp } = CROP_PROFILES[crop];
      // pH 5.5–6.5 en ambos
      assert.equal(ph.yellowMin, 5.5, `${crop}: pH mínimo`);
      assert.equal(ph.yellowMax, 6.5, `${crop}: pH máximo`);
      // Solución 18–24 °C en ambos
      assert.equal(solutionTemp.yellowMin, 18, `${crop}: solución mínima`);
      assert.equal(solutionTemp.yellowMax, 24, `${crop}: solución máxima`);
    }
    // EC lechuga 0.8–1.2 mS/cm
    assert.equal(CROP_PROFILES.lechuga.ec.yellowMin, 0.8);
    assert.equal(CROP_PROFILES.lechuga.ec.yellowMax, 1.2);
    // EC jitomate 2.0–3.5 mS/cm
    assert.equal(CROP_PROFILES.jitomate.ec.yellowMin, 2.0);
    assert.equal(CROP_PROFILES.jitomate.ec.yellowMax, 3.5);
  });

  it('los dos perfiles son distintos (la EC los diferencia)', () => {
    assert.notDeepEqual(CROP_PROFILES.jitomate.ec, CROP_PROFILES.lechuga.ec);
  });

  it('ambos perfiles pasan la validación del formulario (T5.3)', () => {
    for (const crop of CROP_OPTIONS) {
      const errors = validateThresholds(CROP_PROFILES[crop]);
      assert.deepEqual(errors, {}, `${crop} debe ser válido`);
    }
  });
});

describe('defaultThresholdsFor', () => {
  it('devuelve el perfil del cultivo pedido', () => {
    assert.deepEqual(defaultThresholdsFor('jitomate'), CROP_PROFILES.jitomate);
    assert.deepEqual(defaultThresholdsFor('lechuga'), CROP_PROFILES.lechuga);
  });

  it('cae en jitomate con cultivo ausente o desconocido (igual que el backend)', () => {
    assert.equal(defaultThresholdsFor(undefined), CROP_PROFILES.jitomate);
    assert.equal(defaultThresholdsFor(null), CROP_PROFILES.jitomate);
    assert.equal(defaultThresholdsFor('papa'), CROP_PROFILES.jitomate);
  });
});

/**
 * Revisión de PR: `CROP_PROFILES` (PWA) y `DEFAULT_CROP_THRESHOLDS` (backend)
 * son copias intencionales del mismo criterio —una por lado, para que cada
 * módulo siga siendo puro y sin dependencias cruzadas—, así que esta prueba
 * existe para que **no se desincronicen**: si alguien cambia un umbral en un
 * solo lado, aquí falla con el cultivo y la variable exactos.
 */
describe('CROP_PROFILES ↔ DEFAULT_CROP_THRESHOLDS (sincronía PWA/backend)', () => {
  it('expone los mismos cultivos', () => {
    assert.deepEqual(
      [...CROP_OPTIONS].sort(),
      Object.keys(DEFAULT_CROP_THRESHOLDS).sort(),
    );
  });

  it('cada cultivo trae las mismas 7 variables con exactamente los mismos números', () => {
    for (const crop of CROP_OPTIONS) {
      const frontend = CROP_PROFILES[crop];
      const backend = DEFAULT_CROP_THRESHOLDS[crop];

      assert.deepEqual(
        Object.keys(frontend).sort(),
        Object.keys(backend).sort(),
        `${crop}: lista de variables distinta`,
      );

      for (const variable of VARIABLES) {
        assert.deepEqual(
          frontend[variable],
          backend[variable],
          `${crop}.${variable}: la PWA y el backend ya no usan el mismo umbral`,
        );
      }
    }
  });

  it('los dos objetos completos son idénticos (detecta claves de más o de menos)', () => {
    assert.deepEqual(CROP_PROFILES, DEFAULT_CROP_THRESHOLDS);
  });
});
