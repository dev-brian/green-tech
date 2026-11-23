import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { ThresholdRange } from './sensorThresholds';
import { CROP_PROFILES, defaultThresholdsFor, resolveCropThresholds, type CropType } from './cropProfiles';

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
 * Lee los umbrales del cultivo indicado (`thresholdsByCrop.{cultivo}`). Si no
 * hay personalizados, devuelve el perfil por defecto de ese cultivo.
 */
export async function getThresholds(
  greenhouseId: string,
  crop?: string,
): Promise<GreenhouseThresholds> {
  const snap = await getDoc(doc(db, 'greenhouses', greenhouseId));
  return resolveCropThresholds(snap.exists() ? snap.data() : undefined, crop);
}

/**
 * Lee el documento del invernadero una vez y devuelve los umbrales efectivos
 * de cada cultivo (para pantallas con zonas de cultivos distintos).
 */
export async function getThresholdsByCrop(
  greenhouseId: string,
): Promise<Record<CropType, GreenhouseThresholds>> {
  const snap = await getDoc(doc(db, 'greenhouses', greenhouseId));
  const data = snap.exists() ? snap.data() : undefined;
  return {
    jitomate: resolveCropThresholds(data, 'jitomate'),
    lechuga: resolveCropThresholds(data, 'lechuga'),
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
 * Guarda los umbrales de **un** cultivo en `thresholdsByCrop.{cultivo}`, sin
 * tocar los del otro. Solo admin (lo hace cumplir `firestore.rules`).
 */
export async function updateThresholds(
  greenhouseId: string,
  crop: string | undefined,
  thresholds: GreenhouseThresholds,
): Promise<void> {
  const key: CropType = crop === 'lechuga' ? 'lechuga' : 'jitomate';
  await updateDoc(doc(db, 'greenhouses', greenhouseId), {
    [`thresholdsByCrop.${key}`]: thresholds,
  });
}

/**
 * Restaura los umbrales por defecto del `crop` indicado en Firestore.
 */
export async function resetThresholds(
  greenhouseId: string,
  crop?: string,
): Promise<void> {
  await updateThresholds(greenhouseId, crop, defaultThresholdsFor(crop));
}
