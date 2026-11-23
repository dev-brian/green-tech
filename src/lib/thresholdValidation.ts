import type { GreenhouseThresholds } from './thresholdsService';

/**
 * T5.3 (#46) — Validación del formulario de umbrales (HU-05).
 *
 * Regla central del criterio de aceptación: **no se puede guardar un mínimo
 * mayor o igual al máximo**. Además, los cuatro rangos de cada variable
 * deben quedar ordenados para que el semáforo tenga sentido:
 *
 *   redMin ≤ yellowMin ≤ yellowMax ≤ redMax
 *   (con redMin < redMax y yellowMin < yellowMax estrictos)
 *
 * `tankLevel` usa `yellowMax === redMax` (100 %) en los valores por defecto,
 * por lo que las desigualdades exteriores son no estrictas.
 *
 * Todo es puro y sin dependencias de Firebase para probarlo con `node --test`.
 */

export type ThresholdVariableKey = keyof GreenhouseThresholds;

/** Mensaje de error por variable; ausente (`undefined`) = variable válida. */
export type ThresholdErrors = Partial<Record<ThresholdVariableKey, string>>;

type Range = GreenhouseThresholds[ThresholdVariableKey];

/** Reglas aplicadas a los cuatro campos de una variable. */
function validateRange(range: Range): string | null {
  const { redMin, yellowMin, yellowMax, redMax } = range;

  const values = [redMin, yellowMin, yellowMax, redMax];
  if (!values.every((v) => Number.isFinite(v))) {
    return 'Ingresa un valor numérico válido.';
  }

  // Criterio de HU-05: mínimo < máximo (tanto crítico como óptimo).
  if (redMin >= redMax) {
    return 'El mínimo crítico debe ser menor que el máximo crítico.';
  }
  if (yellowMin >= yellowMax) {
    return 'El mínimo de precaución debe ser menor que el máximo de precaución.';
  }

  // Los rangos no se pueden cruzar (los extremos contienen a los óptimos).
  if (redMin > yellowMin) {
    return 'El mínimo crítico no puede ser mayor que el mínimo de precaución.';
  }
  if (yellowMax > redMax) {
    return 'El máximo de precaución no puede ser mayor que el máximo crítico.';
  }

  return null;
}

/**
 * Valida las 7 variables del formulario de umbrales.
 * Devuelve el primer error de cada variable (o ninguna entrada si es válida).
 */
export function validateThresholds(thresholds: GreenhouseThresholds): ThresholdErrors {
  const errors: ThresholdErrors = {};
  (Object.keys(thresholds) as ThresholdVariableKey[]).forEach((key) => {
    const message = validateRange(thresholds[key]);
    if (message) errors[key] = message;
  });
  return errors;
}

/** `true` si hay al menos una variable con error (bloquea el guardado). */
export function hasThresholdErrors(errors: ThresholdErrors): boolean {
  return Object.keys(errors).length > 0;
}
