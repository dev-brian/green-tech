/**
 * Nodo de sensores de una zona: convierte el estado real del invernadero en
 * lo que mediría el hardware y arma el cuerpo de `POST /ingestTelemetry`
 * (docs/contrato-datos.md, sección 2.7). Es la pieza que un ESP32 real
 * reemplaza sin que el backend note la diferencia.
 */

import type { IngestTelemetryRequest } from '../../simulator/core/hydroponicModel.ts';
import { DISCONNECTED_VALUE, trueReadings } from '../model/world.ts';
import {
  VARIABLES,
  type HydroponicReadings,
  type HydroponicVariable,
  type ZoneState,
} from '../model/types.ts';

export type Rng = () => number;

/** Generador determinista (mulberry32) para pruebas reproducibles. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruido típico de cada sonda (amplitud, en unidades de la variable). */
const NOISE: Record<HydroponicVariable, (value: number) => number> = {
  airTemp: () => 0.15,
  humidity: () => 0.6,
  light: (value) => value * 0.015,
  ph: () => 0.015,
  ec: () => 0.01,
  solutionTemp: () => 0.08,
  tankLevel: () => 0.2,
};

/** Resolución con la que reporta cada sonda. */
const DECIMALS: Record<HydroponicVariable, number> = {
  airTemp: 1,
  humidity: 0,
  light: 0,
  ph: 2,
  ec: 2,
  solutionTemp: 1,
  tankLevel: 1,
};

/** Límites eléctricos de la sonda en operación normal. */
const SENSOR_RANGE: Record<HydroponicVariable, [number, number]> = {
  airTemp: [-10, 60],
  humidity: [0, 100],
  light: [0, 150000],
  ph: [0, 14],
  ec: [0, 10],
  solutionTemp: [0, 50],
  tankLevel: [0, 100],
};

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Toma una medición de las 7 variables con las fallas de sonda activas. */
export function measure(zone: ZoneState, rng: Rng = Math.random): HydroponicReadings {
  const truth = trueReadings(zone);
  const out = {} as HydroponicReadings;
  for (const key of VARIABLES) {
    const sensor = zone.node.sensors[key];
    let value: number;
    if (sensor.mode === 'disconnected') {
      value = DISCONNECTED_VALUE[key];
    } else if (sensor.mode === 'stuck') {
      value = sensor.heldValue ?? truth[key];
    } else {
      const noise = (rng() - 0.5) * 2 * NOISE[key](truth[key]);
      value = truth[key] + noise + (sensor.mode === 'bias' ? sensor.bias : 0);
      const [min, max] = SENSOR_RANGE[key];
      value = Math.max(min, Math.min(max, value));
    }
    out[key] = round(value, DECIMALS[key]);
  }
  return out;
}

/** Cuerpo exacto que exige la ingesta. No agrega campos fuera del contrato. */
export function buildIngestPayload(
  greenhouseId: string,
  zone: ZoneState,
  readings: HydroponicReadings,
  timestamp: Date,
): Required<IngestTelemetryRequest> {
  return {
    greenhouseId,
    zoneId: zone.config.id,
    crop: zone.config.crop,
    timestamp: timestamp.toISOString(),
    readings,
  };
}
