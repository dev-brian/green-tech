import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ThresholdRange {
  yellowMin: number;
  yellowMax: number;
  redMin: number;
  redMax: number;
}

export interface GreenhouseThresholds {
  temperature:  ThresholdRange;
  humidity:     ThresholdRange;
  soilMoisture: ThresholdRange;
}

// ─── Valores de fábrica (SPECS.md §B) ────────────────────────────────────────

export const DEFAULT_THRESHOLDS: GreenhouseThresholds = {
  temperature:  { redMin: 12, yellowMin: 18, yellowMax: 27, redMax: 32 },
  humidity:     { redMin: 40, yellowMin: 60, yellowMax: 80, redMax: 90 },
  soilMoisture: { redMin: 40, yellowMin: 60, yellowMax: 80, redMax: 90 },
};

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Lee los umbrales del invernadero. Si no existen en Firestore,
 * devuelve los valores de fábrica.
 */
export async function getThresholds(
  greenhouseId: string,
): Promise<GreenhouseThresholds> {
  const snap = await getDoc(doc(db, 'greenhouses', greenhouseId));
  if (!snap.exists()) return DEFAULT_THRESHOLDS;

  const data = snap.data();
  const stored = data.thresholds as Partial<GreenhouseThresholds> | undefined;

  if (!stored) return DEFAULT_THRESHOLDS;

  // Merge con defaults por si faltan campos
  return {
    temperature:  { ...DEFAULT_THRESHOLDS.temperature,  ...stored.temperature  },
    humidity:     { ...DEFAULT_THRESHOLDS.humidity,      ...stored.humidity     },
    soilMoisture: { ...DEFAULT_THRESHOLDS.soilMoisture,  ...stored.soilMoisture },
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
 * Restaura los umbrales de fábrica en Firestore.
 */
export async function resetThresholds(greenhouseId: string): Promise<void> {
  await updateThresholds(greenhouseId, DEFAULT_THRESHOLDS);
}
