/**
 * Motor unificado de ingesta de telemetría, evaluación de umbrales,
 * alertas con desduplicación y auto-resolución, y actuadores virtuales
 * (T2.1 #37, T6.1 #48, T6.3 #50, T8.1 #67, T8.3 #69).
 */

import {
  DEFAULT_CROP_THRESHOLDS,
  HYDROPONIC_VARIABLES,
  VARIABLE_KEYS,
  evaluateLevel,
  type AlertLevel,
  type CropThresholds,
  type CropType,
  type HydroponicReadings,
  type HydroponicVariable,
  type IngestTelemetryRequest,
} from './hydroponicModel.ts';

export interface ZoneVariableState {
  value: number;
  level: AlertLevel;
}

export type ZoneLatestState = {
  [K in HydroponicVariable]: ZoneVariableState;
} & {
  timestamp: string;
  crop: CropType;
};

export interface AlertRecord {
  id: string;
  zoneId: string;
  variable: HydroponicVariable;
  severity: 'warn' | 'critical';
  value: number;
  message: string;
  status: 'new' | 'attended' | 'auto_resolved';
  createdAt: string;
  attendedBy: string | null;
  attendedAt: string | null;
  resolvedAt: string | null;
}

export interface ActuatorItemState {
  on: boolean;
  updatedAt: string;
  updatedBy: 'backend' | string;
}

export interface ZoneActuatorsState {
  zoneId: string;
  recirculationPump: ActuatorItemState;
  phDoser: ActuatorItemState;
  nutrientDoser: ActuatorItemState;
  ventilation: ActuatorItemState;
  updatedAt: string;
}

export interface TelemetryStorageAdapter {
  getThresholds(greenhouseId: string, crop: CropType): Promise<CropThresholds>;
  saveReading(
    greenhouseId: string,
    reading: {
      zoneId: string;
      crop: CropType;
      timestamp: string;
      readings: HydroponicReadings;
    },
  ): Promise<string>;
  updateLatestState(
    greenhouseId: string,
    zoneId: string,
    zoneState: ZoneLatestState,
  ): Promise<void>;
  getActiveAlert(
    greenhouseId: string,
    zoneId: string,
    variable: HydroponicVariable,
  ): Promise<AlertRecord | null>;
  createAlert(
    greenhouseId: string,
    alert: Omit<AlertRecord, 'id'>,
  ): Promise<AlertRecord>;
  updateAlert(
    greenhouseId: string,
    alertId: string,
    patch: Partial<AlertRecord>,
  ): Promise<void>;
  getActuatorsState(
    greenhouseId: string,
    zoneId: string,
  ): Promise<ZoneActuatorsState>;
  saveActuatorsState(
    greenhouseId: string,
    zoneId: string,
    state: ZoneActuatorsState,
  ): Promise<void>;
}

/**
 * Adaptador en memoria para pruebas unitarias de latencia (< 5 s),
 * modo local del servidor HTTP y ejecuciones aisladas.
 */
export class InMemoryTelemetryStorage implements TelemetryStorageAdapter {
  public readings: Record<string, Array<{ id: string; zoneId: string; timestamp: string } & HydroponicReadings>> = {};
  public latestState: Record<string, Record<string, ZoneLatestState>> = {};
  public alerts: Record<string, AlertRecord[]> = {};
  public actuators: Record<string, Record<string, ZoneActuatorsState>> = {};
  public customThresholds: Record<string, Partial<Record<CropType, CropThresholds>>> = {};
  private seq = 1;

  async getThresholds(greenhouseId: string, crop: CropType): Promise<CropThresholds> {
    return this.customThresholds[greenhouseId]?.[crop] ?? DEFAULT_CROP_THRESHOLDS[crop];
  }

  async saveReading(
    greenhouseId: string,
    reading: {
      zoneId: string;
      crop: CropType;
      timestamp: string;
      readings: HydroponicReadings;
    },
  ): Promise<string> {
    const id = `reading-${this.seq++}`;
    if (!this.readings[greenhouseId]) this.readings[greenhouseId] = [];
    this.readings[greenhouseId].push({
      id,
      zoneId: reading.zoneId,
      timestamp: reading.timestamp,
      ...reading.readings,
    });
    return id;
  }

  async updateLatestState(
    greenhouseId: string,
    zoneId: string,
    zoneState: ZoneLatestState,
  ): Promise<void> {
    if (!this.latestState[greenhouseId]) this.latestState[greenhouseId] = {};
    this.latestState[greenhouseId][zoneId] = zoneState;
  }

  async getActiveAlert(
    greenhouseId: string,
    zoneId: string,
    variable: HydroponicVariable,
  ): Promise<AlertRecord | null> {
    const list = this.alerts[greenhouseId] ?? [];
    return (
      list.find(
        (a) => a.zoneId === zoneId && a.variable === variable && a.status === 'new',
      ) ?? null
    );
  }

  async createAlert(
    greenhouseId: string,
    alert: Omit<AlertRecord, 'id'>,
  ): Promise<AlertRecord> {
    const record: AlertRecord = { id: `alert-${this.seq++}`, ...alert };
    if (!this.alerts[greenhouseId]) this.alerts[greenhouseId] = [];
    this.alerts[greenhouseId].push(record);
    return record;
  }

  async updateAlert(
    greenhouseId: string,
    alertId: string,
    patch: Partial<AlertRecord>,
  ): Promise<void> {
    const list = this.alerts[greenhouseId] ?? [];
    const idx = list.findIndex((a) => a.id === alertId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch };
    }
  }

  async getActuatorsState(
    greenhouseId: string,
    zoneId: string,
  ): Promise<ZoneActuatorsState> {
    const existing = this.actuators[greenhouseId]?.[zoneId];
    if (existing) return existing;
    const now = new Date().toISOString();
    const initial: ZoneActuatorsState = {
      zoneId,
      recirculationPump: { on: true, updatedAt: now, updatedBy: 'backend' },
      phDoser: { on: false, updatedAt: now, updatedBy: 'backend' },
      nutrientDoser: { on: false, updatedAt: now, updatedBy: 'backend' },
      ventilation: { on: false, updatedAt: now, updatedBy: 'backend' },
      updatedAt: now,
    };
    if (!this.actuators[greenhouseId]) this.actuators[greenhouseId] = {};
    this.actuators[greenhouseId][zoneId] = initial;
    return initial;
  }

  async saveActuatorsState(
    greenhouseId: string,
    zoneId: string,
    state: ZoneActuatorsState,
  ): Promise<void> {
    if (!this.actuators[greenhouseId]) this.actuators[greenhouseId] = {};
    this.actuators[greenhouseId][zoneId] = state;
  }
}

export interface IngestProcessResult {
  readingId: string;
  zoneState: ZoneLatestState;
  createdAlerts: AlertRecord[];
  resolvedAlertIds: string[];
  actuators: ZoneActuatorsState;
}

/**
 * Procesa una lectura validada de telemetría (T2.1 + T6.1 + T6.3 + T8.3):
 * 1. Guarda en greenhouses/{id}/readings
 * 2. Evalúa las 7 variables con los umbrales del cultivo y escribe greenhouses/{id}/state/latest
 * 3. Crea alertas sin duplicados (status === 'new') y resuelve automáticamente las que vuelven a 'ok'
 * 4. Actualiza los 4 actuadores virtuales según las reglas de HU-08
 */
export async function processIngestedReading(
  input: Required<IngestTelemetryRequest>,
  storage: TelemetryStorageAdapter,
): Promise<IngestProcessResult> {
  const { greenhouseId, zoneId, crop, timestamp, readings } = input;
  const thresholds = await storage.getThresholds(greenhouseId, crop);

  const readingId = await storage.saveReading(greenhouseId, {
    zoneId,
    crop,
    timestamp,
    readings,
  });

  const zoneState = {
    timestamp,
    crop,
  } as ZoneLatestState;

  const createdAlerts: AlertRecord[] = [];
  const resolvedAlertIds: string[] = [];

  for (const key of VARIABLE_KEYS) {
    const value = readings[key];
    const range = thresholds[key];
    const level = evaluateLevel(value, range);
    zoneState[key] = { value, level };

    const meta = HYDROPONIC_VARIABLES[key];
    const existingActive = await storage.getActiveAlert(greenhouseId, zoneId, key);

    if (level === 'warn' || level === 'critical') {
      const severityLabel = level === 'critical' ? 'crítico' : 'en precaución';
      const message = `${meta.label} ${severityLabel} en ${zoneId}: ${value} ${meta.unit}`;

      if (!existingActive) {
        const created = await storage.createAlert(greenhouseId, {
          zoneId,
          variable: key,
          severity: level,
          value,
          message,
          status: 'new',
          createdAt: timestamp,
          attendedBy: null,
          attendedAt: null,
          resolvedAt: null,
        });
        createdAlerts.push(created);
      } else if (existingActive.severity === 'warn' && level === 'critical') {
        await storage.updateAlert(greenhouseId, existingActive.id, {
          severity: 'critical',
          value,
          message,
        });
      }
    } else if (level === 'ok' && existingActive) {
      await storage.updateAlert(greenhouseId, existingActive.id, {
        status: 'auto_resolved',
        resolvedAt: timestamp,
      });
      resolvedAlertIds.push(existingActive.id);
    }
  }

  await storage.updateLatestState(greenhouseId, zoneId, zoneState);

  // Reglas de actuadores virtuales (HU-08: T8.1 y T8.3)
  const currentActuators = await storage.getActuatorsState(greenhouseId, zoneId);
  const phHigh = readings.ph > thresholds.ph.yellowMax;
  const ecLow = readings.ec < thresholds.ec.yellowMin;
  const airHot = readings.airTemp > thresholds.airTemp.yellowMax;
  const tankCriticalLow = readings.tankLevel < thresholds.tankLevel.redMin;

  const updateActuator = (prev: ActuatorItemState, nextOn: boolean): ActuatorItemState =>
    prev.on === nextOn
      ? prev
      : { on: nextOn, updatedAt: timestamp, updatedBy: 'backend' };

  const updatedActuators: ZoneActuatorsState = {
    zoneId,
    recirculationPump: updateActuator(currentActuators.recirculationPump, !tankCriticalLow),
    phDoser: updateActuator(currentActuators.phDoser, phHigh),
    nutrientDoser: updateActuator(currentActuators.nutrientDoser, ecLow),
    ventilation: updateActuator(currentActuators.ventilation, airHot),
    updatedAt: timestamp,
  };

  await storage.saveActuatorsState(greenhouseId, zoneId, updatedActuators);

  return {
    readingId,
    zoneState,
    createdAlerts,
    resolvedAlertIds,
    actuators: updatedActuators,
  };
}
