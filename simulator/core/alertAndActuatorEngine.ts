/**
 * Motor unificado de ingesta de telemetría, evaluación de umbrales,
 * alertas con desduplicación y auto-resolución, y actuadores virtuales
 * (T2.1 #37, T6.1 #48, T6.3 #50, T8.1 #67, T8.3 #69).
 */

import {
  hourlyDocId,
  mergeIntoHourly,
  retentionCutoffs,
  type HourlyAggregate,
} from './hourlyAggregation.ts';
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
  type VariableThresholdRange,
} from './hydroponicModel.ts';
import type { AlertPushNotifier } from './pushNotifier.ts';

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

/**
 * Una alerta sigue abierta mientras no tenga `resolvedAt`, aunque alguien ya
 * la haya marcado como atendida. Antes solo contaba `status == 'new'`, y
 * atenderla hacía que la siguiente lectura creara otra (auditoría C4).
 */
export function isAlertOpen(alert: Pick<AlertRecord, 'status' | 'resolvedAt'>): boolean {
  return (alert.status === 'new' || alert.status === 'attended') && !alert.resolvedAt;
}

/** Lo que el motor decide hacer con la alerta abierta de una zona y variable. */
export type AlertChange =
  | { kind: 'none' }
  | { kind: 'create'; alert: Omit<AlertRecord, 'id'> }
  | { kind: 'update'; patch: Partial<Omit<AlertRecord, 'id'>> };

export interface AlertChangeResult {
  change: AlertChange;
  /** La alerta tal como quedó, o null si no había ninguna abierta. */
  alert: AlertRecord | null;
}

/**
 * Margen para cerrar una alerta, como fracción del ancho del rango ideal.
 * Un valor que oscila justo en el límite no debe crear y cerrar alertas sin
 * parar: solo se cierra cuando entra al rango con este margen (histéresis).
 * pH 5.5–6.5 → 0.05; temperatura 18–24 °C → 0.3 °C.
 */
export const ALERT_RESOLVE_MARGIN = 0.05;

/**
 * true si el valor ya volvió al rango ideal con margen suficiente para cerrar
 * la alerta. El margen solo se pide del lado por el que salió (`triggerValue`),
 * porque hay rangos que llegan al tope físico (tanque 40–100 %).
 */
export function isClearOfThreshold(
  value: number,
  range: VariableThresholdRange,
  triggerValue: number,
): boolean {
  const margin = (range.yellowMax - range.yellowMin) * ALERT_RESOLVE_MARGIN;
  const low = triggerValue < range.yellowMin;
  const high = triggerValue > range.yellowMax;
  const aboveLow = value >= range.yellowMin + (low || !high ? margin : 0);
  const belowHigh = value <= range.yellowMax - (high || !low ? margin : 0);
  return aboveLow && belowHigh;
}

/**
 * Regla de alertas para una variable en una lectura (pura, sin I/O):
 * - Fuera de rango y sin alerta abierta: crea una (`new`).
 * - Ya abierta (nueva o atendida) en precaución y ahora crítica: sube a crítica
 *   y vuelve a `new` para que el equipo la vea otra vez.
 * - Ya abierta y sigue fuera de rango: no hace nada (ni alerta nueva ni push).
 * - Abierta y el valor volvió al rango con margen: `auto_resolved`.
 */
export function decideAlertChange(
  open: AlertRecord | null,
  reading: {
    zoneId: string;
    variable: HydroponicVariable;
    value: number;
    level: AlertLevel;
    range: VariableThresholdRange;
    message: string;
    timestamp: string;
  },
): AlertChange {
  const { zoneId, variable, value, level, range, message, timestamp } = reading;
  if (level === 'warn' || level === 'critical') {
    if (!open) {
      return {
        kind: 'create',
        alert: {
          zoneId,
          variable,
          severity: level,
          value,
          message,
          status: 'new',
          createdAt: timestamp,
          attendedBy: null,
          attendedAt: null,
          resolvedAt: null,
        },
      };
    }
    if (open.severity === 'warn' && level === 'critical') {
      return { kind: 'update', patch: { severity: 'critical', value, message, status: 'new' } };
    }
    return { kind: 'none' };
  }
  if (open && isClearOfThreshold(value, range, open.value)) {
    return { kind: 'update', patch: { status: 'auto_resolved', resolvedAt: timestamp } };
  }
  return { kind: 'none' };
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

/** Lo que el admin registró en greenhouses/{id}/zones/{zoneId} (T4.1 #64). */
export interface ZoneConfig {
  name?: string;
  crop?: CropType;
}

export interface TelemetryStorageAdapter {
  getThresholds(greenhouseId: string, crop: CropType): Promise<CropThresholds>;
  /**
   * Zona registrada por el admin, o null si no existe. Si la zona tiene
   * cultivo asignado, manda sobre el `crop` que envía el sensor (HU-04 #63).
   */
  getZoneConfig?(greenhouseId: string, zoneId: string): Promise<ZoneConfig | null>;
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
  /**
   * Lee la alerta abierta de la zona y variable, aplica lo que decida `decide`
   * y lo guarda en un solo paso atómico (en Firestore, una transacción). Así
   * dos lecturas simultáneas no pueden crear dos alertas para lo mismo (C4).
   * `decide` debe ser pura: Firestore la puede llamar más de una vez si reintenta.
   */
  applyAlertChange(
    greenhouseId: string,
    zoneId: string,
    variable: HydroponicVariable,
    decide: (open: AlertRecord | null) => AlertChange,
  ): Promise<AlertChangeResult>;
  getActuatorsState(
    greenhouseId: string,
    zoneId: string,
  ): Promise<ZoneActuatorsState>;
  saveActuatorsState(
    greenhouseId: string,
    zoneId: string,
    state: ZoneActuatorsState,
  ): Promise<void>;
  /** Suma la lectura al promedio de su hora en readingsHourly (T7.1 #75). */
  upsertHourly(
    greenhouseId: string,
    zoneId: string,
    timestamp: string,
    readings: HydroponicReadings,
  ): Promise<HourlyAggregate>;
  /** Borra lecturas de más de 7 días y promedios de más de 30 (T7.1 #75). */
  pruneExpired(greenhouseId: string, now?: Date): Promise<PruneResult>;
}

export interface PruneResult {
  readingsDeleted: number;
  hourlyDeleted: number;
}

/**
 * Adaptador en memoria para pruebas unitarias de latencia (< 5 s),
 * modo local del servidor HTTP y ejecuciones aisladas.
 */
export class InMemoryTelemetryStorage implements TelemetryStorageAdapter {
  /** Zonas registradas por invernadero (HU-04 #63). */
  public zones: Record<string, Record<string, ZoneConfig>> = {};
  public readings: Record<string, Array<{ id: string; zoneId: string; timestamp: string } & HydroponicReadings>> = {};
  public latestState: Record<string, Record<string, ZoneLatestState>> = {};
  public alerts: Record<string, AlertRecord[]> = {};
  public actuators: Record<string, Record<string, ZoneActuatorsState>> = {};
  public customThresholds: Record<string, Partial<Record<CropType, CropThresholds>>> = {};
  public hourly: Record<string, Record<string, HourlyAggregate>> = {};
  private seq = 1;

  async getThresholds(greenhouseId: string, crop: CropType): Promise<CropThresholds> {
    return this.customThresholds[greenhouseId]?.[crop] ?? DEFAULT_CROP_THRESHOLDS[crop];
  }

  async getZoneConfig(greenhouseId: string, zoneId: string): Promise<ZoneConfig | null> {
    return this.zones[greenhouseId]?.[zoneId] ?? null;
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

  async applyAlertChange(
    greenhouseId: string,
    zoneId: string,
    variable: HydroponicVariable,
    decide: (open: AlertRecord | null) => AlertChange,
  ): Promise<AlertChangeResult> {
    if (!this.alerts[greenhouseId]) this.alerts[greenhouseId] = [];
    const list = this.alerts[greenhouseId];
    const idx = findLastIndex(
      list,
      (a) => a.zoneId === zoneId && a.variable === variable && isAlertOpen(a),
    );
    const open = idx >= 0 ? list[idx] : null;
    const change = decide(open);
    if (change.kind === 'create') {
      const record: AlertRecord = { id: `alert-${this.seq++}`, ...change.alert };
      list.push(record);
      return { change, alert: record };
    }
    if (change.kind === 'update' && open) {
      list[idx] = { ...open, ...change.patch };
      return { change, alert: list[idx] };
    }
    return { change, alert: open };
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

  async upsertHourly(
    greenhouseId: string,
    zoneId: string,
    timestamp: string,
    readings: HydroponicReadings,
  ): Promise<HourlyAggregate> {
    if (!this.hourly[greenhouseId]) this.hourly[greenhouseId] = {};
    const id = hourlyDocId(zoneId, timestamp);
    const next = mergeIntoHourly(this.hourly[greenhouseId][id] ?? null, zoneId, timestamp, readings);
    this.hourly[greenhouseId][id] = next;
    return next;
  }

  async pruneExpired(greenhouseId: string, now: Date = new Date()): Promise<PruneResult> {
    const { readingsBefore, hourlyBefore } = retentionCutoffs(now);
    const readings = this.readings[greenhouseId] ?? [];
    const keptReadings = readings.filter((r) => new Date(r.timestamp) >= readingsBefore);
    this.readings[greenhouseId] = keptReadings;

    const hourly = this.hourly[greenhouseId] ?? {};
    let hourlyDeleted = 0;
    for (const [id, agg] of Object.entries(hourly)) {
      if (new Date(agg.hour) < hourlyBefore) {
        delete hourly[id];
        hourlyDeleted++;
      }
    }
    return { readingsDeleted: readings.length - keptReadings.length, hourlyDeleted };
  }
}

function findLastIndex<T>(list: T[], pred: (item: T) => boolean): number {
  for (let i = list.length - 1; i >= 0; i--) if (pred(list[i])) return i;
  return -1;
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
 * 1. Guarda en greenhouses/{id}/readings y suma la lectura a readingsHourly (T7.1)
 * 2. Evalúa las 7 variables con los umbrales del cultivo y escribe greenhouses/{id}/state/latest
 * 3. Crea alertas sin duplicados (una sola abierta por zona y variable, aunque esté atendida)
 *    y las resuelve solo cuando el valor vuelve al rango con margen (histéresis)
 * 4. Actualiza los 4 actuadores virtuales según las reglas de HU-08
 * 5. Envía push FCM a los miembros cuando una alerta se crea o sube a `critical` (T6.5 #52)
 */
export async function processIngestedReading(
  input: Required<IngestTelemetryRequest>,
  storage: TelemetryStorageAdapter,
  notifier?: AlertPushNotifier,
): Promise<IngestProcessResult> {
  const { greenhouseId, zoneId, timestamp, readings } = input;
  // HU-04 (#63): la zona usa los umbrales del cultivo que le asignó el admin.
  const zone = (await storage.getZoneConfig?.(greenhouseId, zoneId)) ?? null;
  const crop: CropType = zone?.crop ?? input.crop;
  const zoneName = zone?.name ?? zoneId;
  const thresholds = await storage.getThresholds(greenhouseId, crop);

  const readingId = await storage.saveReading(greenhouseId, {
    zoneId,
    crop,
    timestamp,
    readings,
  });
  await storage.upsertHourly(greenhouseId, zoneId, timestamp, readings);

  const zoneState = {
    timestamp,
    crop,
  } as ZoneLatestState;

  const createdAlerts: AlertRecord[] = [];
  const resolvedAlertIds: string[] = [];
  const criticalToNotify: AlertRecord[] = [];

  for (const key of VARIABLE_KEYS) {
    const value = readings[key];
    const range = thresholds[key];
    const level = evaluateLevel(value, range);
    zoneState[key] = { value, level };

    const meta = HYDROPONIC_VARIABLES[key];
    const severityLabel = level === 'critical' ? 'crítico' : 'en precaución';
    const message = `${meta.label} ${severityLabel} en ${zoneName}: ${value} ${meta.unit}`;

    const { change, alert } = await storage.applyAlertChange(greenhouseId, zoneId, key, (open) =>
      decideAlertChange(open, { zoneId, variable: key, value, level, range, message, timestamp }),
    );
    if (!alert) continue;
    if (change.kind === 'create') {
      createdAlerts.push(alert);
      if (alert.severity === 'critical') criticalToNotify.push(alert);
    } else if (change.kind === 'update') {
      if (change.patch.status === 'auto_resolved') resolvedAlertIds.push(alert.id);
      else if (change.patch.severity === 'critical') criticalToNotify.push(alert);
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

  // El push va al final para no retrasar ni romper la escritura de lecturas y alertas.
  if (notifier) {
    for (const alert of criticalToNotify) {
      try {
        await notifier.notifyCriticalAlert(greenhouseId, alert);
      } catch {
        // Un fallo de FCM no debe tumbar la ingesta.
      }
    }
  }

  return {
    readingId,
    zoneState,
    createdAlerts,
    resolvedAlertIds,
    actuators: updatedActuators,
  };
}
