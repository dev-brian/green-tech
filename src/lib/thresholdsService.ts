import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { ThresholdRange } from './sensorThresholds';
import { CROP_PROFILES, defaultThresholdsFor } from './cropProfiles';

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

/**
 * Umbrales por defecto (T5.2 #45): perfil de **jitomate**, el mismo cultivo
 * que usa el backend cuando una lectura no trae `crop`.
 */
export const DEFAULT_THRESHOLDS: GreenhouseThresholds = CROP_PROFILES.jitomate;

/**
 * Lee los umbrales hidropónicos del invernadero. Si no existen en Firestore,
 * devuelve los valores por defecto del `crop` indicado (jitomate o lechuga).
 */
export async function getThresholds(
  greenhouseId: string,
  crop?: string,
): Promise<GreenhouseThresholds> {
  const base = defaultThresholdsFor(crop);
  const snap = await getDoc(doc(db, 'greenhouses', greenhouseId));
  if (!snap.exists()) return base;

  const data = snap.data();
  const stored = data.thresholds as Partial<GreenhouseThresholds> | undefined;

  if (!stored) return base;

  return {
    airTemp:      { ...base.airTemp,      ...stored.airTemp      },
    humidity:     { ...base.humidity,     ...stored.humidity     },
    light:        { ...base.light,        ...stored.light        },
    ph:           { ...base.ph,           ...stored.ph           },
    ec:           { ...base.ec,           ...stored.ec           },
    solutionTemp: { ...base.solutionTemp, ...stored.solutionTemp },
    tankLevel:    { ...base.tankLevel,    ...stored.tankLevel    },
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
 * Guarda los umbrales en Firestore. Solo debe llamarse con rol admin
 * (lo hace cumplir `firestore.rules`: `allow update: if isAdmin(...)`).
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
 * Restaura los umbrales por defecto del `crop` indicado en Firestore.
 */
export async function resetThresholds(
  greenhouseId: string,
  crop?: string,
): Promise<void> {
  await updateThresholds(greenhouseId, defaultThresholdsFor(crop));
}
