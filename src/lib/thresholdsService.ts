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
