import {
  DEFAULT_CROP_THRESHOLDS,
  type CropThresholds,
  type CropType,
  type HydroponicVariable,
  type VariableThresholdRange,
} from './hydroponicModel.ts';

type PartialThresholds = Partial<Record<HydroponicVariable, Partial<VariableThresholdRange>>>;

/**
 * Umbrales efectivos de un cultivo a partir del documento `greenhouses/{id}`.
 *
 * Cada cultivo guarda los suyos en `thresholdsByCrop.{cultivo}` (los edita la
 * PWA). El campo viejo `thresholds`, de antes de los perfiles por cultivo, solo
 * se aplica a jitomate. Misma lógica que `resolveCropThresholds` de
 * `src/lib/cropProfiles.ts`.
 */
export function resolveStoredThresholds(
  data: Record<string, unknown> | undefined | null,
  crop: CropType,
): CropThresholds {
  const base = DEFAULT_CROP_THRESHOLDS[crop];
  const byCrop = data?.thresholdsByCrop as Partial<Record<CropType, PartialThresholds>> | undefined;
  const stored: PartialThresholds | undefined =
    byCrop?.[crop] ?? (crop === 'jitomate' ? (data?.thresholds as PartialThresholds | undefined) : undefined);
  if (!stored) return base;
  return {
    airTemp: { ...base.airTemp, ...stored.airTemp },
    humidity: { ...base.humidity, ...stored.humidity },
    light: { ...base.light, ...stored.light },
    ph: { ...base.ph, ...stored.ph },
    ec: { ...base.ec, ...stored.ec },
    solutionTemp: { ...base.solutionTemp, ...stored.solutionTemp },
    tankLevel: { ...base.tankLevel, ...stored.tankLevel },
  };
}
