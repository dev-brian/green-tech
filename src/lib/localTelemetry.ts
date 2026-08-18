import { THRESHOLDS, statusFor, worstOf, type SensorStatus } from './sensorThresholds';

export interface TelemetryReading {
  id: string;
  greenhouseId: string;
  nodeId: string;
  sector: string;
  timestamp: Date;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  semaphoreStatus: SensorStatus;
  simulated?: boolean;
}

const MAX_STORED = 300;
const EVENT_NAME = 'gt-local-telemetry-change';

function storageKey(greenhouseId: string) {
  return `gt_telemetry_${greenhouseId}`;
}

function emitChange(greenhouseId: string) {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { greenhouseId } }));
}

export function subscribeToLocalTelemetry(handler: (greenhouseId: string) => void) {
  const listener = (e: Event) => handler((e as CustomEvent).detail.greenhouseId);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

export function getLocalReadings(greenhouseId: string): TelemetryReading[] {
  try {
    const raw = localStorage.getItem(storageKey(greenhouseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (Omit<TelemetryReading, 'timestamp'> & { timestamp: string })[];
    return parsed
      .map((r) => ({ ...r, timestamp: new Date(r.timestamp) }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  } catch {
    return [];
  }
}

function saveLocalReadings(greenhouseId: string, readings: TelemetryReading[]) {
  const trimmed = readings.slice(-MAX_STORED);
  localStorage.setItem(storageKey(greenhouseId), JSON.stringify(trimmed));
  emitChange(greenhouseId);
}

export function addLocalReading(
  greenhouseId: string,
  data: {
    nodeId: string;
    sector: string;
    temperature: number;
    humidity: number;
    soilMoisture: number;
    timestamp?: Date;
  }
): TelemetryReading {
  const reading: TelemetryReading = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    greenhouseId,
    nodeId: data.nodeId,
    sector: data.sector,
    timestamp: data.timestamp ?? new Date(),
    temperature: data.temperature,
    humidity: data.humidity,
    soilMoisture: data.soilMoisture,
    semaphoreStatus: worstOf(
      statusFor(data.temperature, THRESHOLDS.temperature),
      statusFor(data.humidity, THRESHOLDS.humidity),
      statusFor(data.soilMoisture, THRESHOLDS.soilMoisture)
    ),
    simulated: true,
  };
  saveLocalReadings(greenhouseId, [...getLocalReadings(greenhouseId), reading]);
  return reading;
}

export function setLocalReadings(greenhouseId: string, readings: TelemetryReading[]) {
  saveLocalReadings(greenhouseId, readings);
}

export function clearLocalReadings(greenhouseId: string) {
  localStorage.removeItem(storageKey(greenhouseId));
  emitChange(greenhouseId);
}
