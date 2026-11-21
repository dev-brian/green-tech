import type { GreenhouseThresholds } from './thresholdsService';

/**
 * T5.2 (#45) — Perfiles de umbrales por cultivo hidropónico (HU-05).
 *
 * Valores por defecto de las 7 variables para **jitomate** y **lechuga**,
 * tomados del criterio de la historia (punto de partida a validar con un
 * agrónomo o docente):
 *
 * - pH 5.5–6.5 en ambos
 * - EC lechuga 0.8–1.2 mS/cm · EC jitomate 2.0–3.5 mS/cm
 * - Temperatura de la solución 18–24 °C
 *
 * Son **idénticos** a `DEFAULT_CROP_THRESHOLDS` de
 * `simulator/core/hydroponicModel.ts`, para que lo que muestra la PWA coincida
 * con lo que evalúa el backend (los umbrales personalizados guardados en
 * `greenhouses/{id}.thresholds` se fusionan sobre este perfil en ambos lados).
 * Las copias son intencionales (cada módulo debe seguir siendo puro), y
 * `tests/cropProfiles.test.ts` los compara para que no se desincronicen.
 *
 * Módulo puro (sin Firebase) para probarlo con `node --test`.
 */

export type CropType = 'jitomate' | 'lechuga';

export const CROP_PROFILES: Record<CropType, GreenhouseThresholds> = {
  jitomate: {
    airTemp: { redMin: 12, yellowMin: 18, yellowMax: 28, redMax: 33 },
    humidity: { redMin: 40, yellowMin: 55, yellowMax: 80, redMax: 90 },
    light: { redMin: 5000, yellowMin: 15000, yellowMax: 55000, redMax: 75000 },
    ph: { redMin: 5.0, yellowMin: 5.5, yellowMax: 6.5, redMax: 7.0 },
    ec: { redMin: 1.5, yellowMin: 2.0, yellowMax: 3.5, redMax: 4.2 },
    solutionTemp: { redMin: 14, yellowMin: 18, yellowMax: 24, redMax: 27 },
    tankLevel: { redMin: 20, yellowMin: 40, yellowMax: 100, redMax: 100 },
  },
  lechuga: {
    airTemp: { redMin: 10, yellowMin: 15, yellowMax: 24, redMax: 28 },
    humidity: { redMin: 45, yellowMin: 60, yellowMax: 80, redMax: 90 },
    light: { redMin: 4000, yellowMin: 12000, yellowMax: 40000, redMax: 60000 },
    ph: { redMin: 5.0, yellowMin: 5.5, yellowMax: 6.5, redMax: 7.0 },
    ec: { redMin: 0.5, yellowMin: 0.8, yellowMax: 1.2, redMax: 1.6 },
    solutionTemp: { redMin: 14, yellowMin: 18, yellowMax: 24, redMax: 26 },
    tankLevel: { redMin: 20, yellowMin: 40, yellowMax: 100, redMax: 100 },
  },
};

/** Cultivos soportados, en el orden en que se muestran en la UI. */
export const CROP_OPTIONS: readonly CropType[] = ['jitomate', 'lechuga'];

/**
 * Perfil por defecto para un cultivo. Cualquier valor desconocido (o ausente)
 * cae en `jitomate`, igual que hace el backend al interpretar una lectura.
 */
export function defaultThresholdsFor(crop?: string | null): GreenhouseThresholds {
  return crop === 'lechuga' ? CROP_PROFILES.lechuga : CROP_PROFILES.jitomate;
}

type PartialThresholds = Partial<Record<keyof GreenhouseThresholds, Partial<GreenhouseThresholds[keyof GreenhouseThresholds]>>>;

/**
 * Umbrales efectivos de un cultivo a partir del documento `greenhouses/{id}`.
 *
 * Cada cultivo guarda sus umbrales personalizados en
 * `thresholdsByCrop.{cultivo}`; así, editar lechuga ya no cambia cómo se
 * evalúan las zonas de jitomate. El campo viejo `thresholds` (uno solo para
 * todo el invernadero, de antes de los perfiles) se respeta solo para
 * jitomate, que era el cultivo por defecto cuando se guardó.
 *
 * Debe coincidir con `resolveStoredThresholds` de
 * `simulator/core/storedThresholds.ts` (lo comprueba
 * `tests/cropProfiles.test.ts`).
 */
export function resolveCropThresholds(
  data: Record<string, unknown> | undefined | null,
  crop?: string | null,
): GreenhouseThresholds {
  const key: CropType = crop === 'lechuga' ? 'lechuga' : 'jitomate';
  const base = CROP_PROFILES[key];
  const byCrop = data?.thresholdsByCrop as Partial<Record<CropType, PartialThresholds>> | undefined;
  const stored: PartialThresholds | undefined =
    byCrop?.[key] ?? (key === 'jitomate' ? (data?.thresholds as PartialThresholds | undefined) : undefined);
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
