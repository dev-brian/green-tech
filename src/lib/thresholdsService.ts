import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { THRESHOLDS, type ThresholdRange } from './sensorThresholds';

export type { ThresholdRange };

export interface GreenhouseThresholds {
  airTemp:      ThresholdRange;
  humidity:     ThresholdRange;
  light:        ThresholdRange;
  ph:           ThresholdRange;
  ec:           ThresholdRange;
  solutionTemp: ThresholdRange;
  tankLevel:    ThresholdRange;
}

export const DEFAULT_THRESHOLDS: GreenhouseThresholds = {
  airTemp:      THRESHOLDS.airTemp,
  humidity:     THRESHOLDS.humidity,
  light:        THRESHOLDS.light,
  ph:           THRESHOLDS.ph,
  ec:           THRESHOLDS.ec,
  solutionTemp: THRESHOLDS.solutionTemp,
  tankLevel:    THRESHOLDS.tankLevel,
};

/**
 * Lee los umbrales hidropónicos del invernadero. Si no existen en Firestore,
 * devuelve los valores por defecto.
 */
export async function getThresholds(
  greenhouseId: string,
): Promise<GreenhouseThresholds> {
  const snap = await getDoc(doc(db, 'greenhouses', greenhouseId));
  if (!snap.exists()) return DEFAULT_THRESHOLDS;

  const data = snap.data();
  const stored = data.thresholds as Partial<GreenhouseThresholds> | undefined;

  if (!stored) return DEFAULT_THRESHOLDS;

  return {
    airTemp:      { ...DEFAULT_THRESHOLDS.airTemp,      ...stored.airTemp      },
    humidity:     { ...DEFAULT_THRESHOLDS.humidity,     ...stored.humidity     },
    light:        { ...DEFAULT_THRESHOLDS.light,        ...stored.light        },
    ph:           { ...DEFAULT_THRESHOLDS.ph,           ...stored.ph           },
    ec:           { ...DEFAULT_THRESHOLDS.ec,           ...stored.ec           },
    solutionTemp: { ...DEFAULT_THRESHOLDS.solutionTemp, ...stored.solutionTemp },
    tankLevel:    { ...DEFAULT_THRESHOLDS.tankLevel,    ...stored.tankLevel    },
  };
}

/**
 * Revisa que cada rango cumpla redMin ≤ yellowMin ≤ yellowMax ≤ redMax con
 * números finitos. Devuelve el mensaje de error o null. Las reglas de Firestore
 * rechazan lo mismo; validar aquí da un mensaje claro antes de guardar.
 */
export function validateThresholds(thresholds: GreenhouseThresholds): string | null {
  for (const [variable, r] of Object.entries(thresholds) as [string, ThresholdRange][]) {
    const values = [r.redMin, r.yellowMin, r.yellowMax, r.redMax];
    if (!values.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      return `Los umbrales de ${variable} deben ser números.`;
    }
    if (!(r.redMin <= r.yellowMin && r.yellowMin <= r.yellowMax && r.yellowMax <= r.redMax)) {
      return `Los umbrales de ${variable} deben ir en orden: crítico mín ≤ precaución mín ≤ precaución máx ≤ crítico máx.`;
    }
  }
  return null;
}

/**
 * Guarda los umbrales en Firestore. Solo debe llamarse con rol admin.
 */
export async function updateThresholds(
  greenhouseId: string,
  thresholds: GreenhouseThresholds,
): Promise<void> {
  await updateDoc(doc(db, 'greenhouses', greenhouseId), {
    thresholds,
  });
}

/**
 * Restaura los umbrales por defecto en Firestore.
 */
export async function resetThresholds(greenhouseId: string): Promise<void> {
  await updateThresholds(greenhouseId, DEFAULT_THRESHOLDS);
}
