/**
 * Modelo hidropónico de 7 variables, límites físicos de validación
 * y umbrales por defecto para jitomate y lechuga (T2.1, T5.2, T6.1).
 * Cumple con docs/contrato-datos.md (v0.2).
 */

export type HydroponicVariable =
  | 'airTemp'
  | 'humidity'
  | 'light'
  | 'ph'
  | 'ec'
  | 'solutionTemp'
  | 'tankLevel';

export type AlertLevel = 'ok' | 'warn' | 'critical';
export type CropType = 'jitomate' | 'lechuga';

export interface HydroponicReadings {
  airTemp: number;
  humidity: number;
  light: number;
  ph: number;
  ec: number;
  solutionTemp: number;
  tankLevel: number;
}

export interface VariableMeta {
  key: HydroponicVariable;
  label: string;
  unit: string;
  group: 'ambiente' | 'solucion';
  physicalMin: number;
  physicalMax: number;
}

export const HYDROPONIC_VARIABLES: Record<HydroponicVariable, VariableMeta> = {
  airTemp: {
    key: 'airTemp',
    label: 'Temperatura del aire',
    unit: '°C',
    group: 'ambiente',
    physicalMin: -10,
    physicalMax: 60,
  },
  humidity: {
    key: 'humidity',
    label: 'Humedad relativa',
    unit: '%',
    group: 'ambiente',
    physicalMin: 0,
    physicalMax: 100,
  },
  light: {
    key: 'light',
    label: 'Luz',
    unit: 'lux',
    group: 'ambiente',
    physicalMin: 0,
    physicalMax: 150000,
  },
  ph: {
    key: 'ph',
    label: 'pH de la solución',
    unit: 'pH',
    group: 'solucion',
    physicalMin: 0,
    physicalMax: 14,
  },
  ec: {
    key: 'ec',
    label: 'Conductividad eléctrica (EC)',
    unit: 'mS/cm',
    group: 'solucion',
    physicalMin: 0,
    physicalMax: 10,
  },
  solutionTemp: {
    key: 'solutionTemp',
    label: 'Temperatura de la solución',
    unit: '°C',
    group: 'solucion',
    physicalMin: 0,
    physicalMax: 50,
  },
  tankLevel: {
    key: 'tankLevel',
    label: 'Nivel del tanque',
    unit: '%',
    group: 'solucion',
    physicalMin: 0,
    physicalMax: 100,
  },
};

export const VARIABLE_KEYS = Object.keys(HYDROPONIC_VARIABLES) as HydroponicVariable[];

export interface VariableThresholdRange {
  redMin: number;
  yellowMin: number;
  yellowMax: number;
  redMax: number;
}

export type CropThresholds = Record<HydroponicVariable, VariableThresholdRange>;

/**
 * Umbrales por defecto para jitomate y lechuga hidropónicos (PLAN-MVP.md HU-05):
 * - pH: óptimo 5.5–6.5 en ambos
 * - EC lechuga: óptimo 0.8–1.2 mS/cm
 * - EC jitomate: óptimo 2.0–3.5 mS/cm
 * - Temperatura de la solución: óptimo 18–24 °C
 */
export const DEFAULT_CROP_THRESHOLDS: Record<CropType, CropThresholds> = {
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

export function evaluateLevel(value: number, range: VariableThresholdRange): AlertLevel {
  if (value < range.redMin || value > range.redMax) return 'critical';
  if (value < range.yellowMin || value > range.yellowMax) return 'warn';
  return 'ok';
}

export interface IngestTelemetryRequest {
  greenhouseId: string;
  zoneId: string;
  crop?: CropType;
  timestamp?: string;
  readings: HydroponicReadings;
}

export type ValidationResult =
  | { valid: true; data: Required<IngestTelemetryRequest> }
  | { valid: false; status: number; error: string };

/**
 * Valida la petición HTTP de ingestTelemetry (T2.1):
 * - Cabecera x-device-key válida
 * - greenhouseId y zoneId presentes
 * - Las 7 variables hidropónicas presentes, numéricas y dentro del rango físico válido
 */
export function validateIngestPayload(
  body: unknown,
  deviceKeyHeader: string | undefined,
  expectedDeviceKey: string,
): ValidationResult {
  if (!expectedDeviceKey || !deviceKeyHeader || deviceKeyHeader !== expectedDeviceKey) {
    return {
      valid: false,
      status: 401,
      error: 'Clave de dispositivo (x-device-key) inválida o ausente.',
    };
  }

  if (!body || typeof body !== 'object') {
    return { valid: false, status: 400, error: 'El cuerpo de la petición debe ser un objeto JSON.' };
  }

  const raw = body as Record<string, unknown>;
  const greenhouseId = typeof raw.greenhouseId === 'string' ? raw.greenhouseId.trim() : '';
  const zoneId = typeof raw.zoneId === 'string' ? raw.zoneId.trim() : '';

  if (!greenhouseId) {
    return { valid: false, status: 400, error: 'El campo greenhouseId es obligatorio.' };
  }
  if (!zoneId) {
    return { valid: false, status: 400, error: 'El campo zoneId es obligatorio.' };
  }

  const crop: CropType = raw.crop === 'lechuga' ? 'lechuga' : 'jitomate';
  const timestamp =
    typeof raw.timestamp === 'string' && !Number.isNaN(Date.parse(raw.timestamp))
      ? raw.timestamp
      : new Date().toISOString();

  if (!raw.readings || typeof raw.readings !== 'object') {
    return {
      valid: false,
      status: 400,
      error: 'El objeto readings con las 7 variables hidropónicas es obligatorio.',
    };
  }

  const readingsObj = raw.readings as Record<string, unknown>;
  const validatedReadings: Partial<HydroponicReadings> = {};

  for (const key of VARIABLE_KEYS) {
    const meta = HYDROPONIC_VARIABLES[key];
    const val = readingsObj[key];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      return {
        valid: false,
        status: 400,
        error: `La variable ${key} (${meta.unit}) es obligatoria y debe ser un número finito.`,
      };
    }
    if (val < meta.physicalMin || val > meta.physicalMax) {
      return {
        valid: false,
        status: 422,
        error: `Valor fuera de rango físico para ${key}: ${val} ${meta.unit} (rango permitido: ${meta.physicalMin} a ${meta.physicalMax} ${meta.unit}).`,
      };
    }
    validatedReadings[key] = val;
  }

  return {
    valid: true,
    data: {
      greenhouseId,
      zoneId,
      crop,
      timestamp,
      readings: validatedReadings as HydroponicReadings,
    },
  };
}
