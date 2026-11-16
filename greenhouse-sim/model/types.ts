/**
 * Tipos del gemelo digital del invernadero.
 *
 * Del backend solo se importan TIPOS (la forma del JSON de ingesta y de los
 * actuadores). El simulador nunca ejecuta código del backend: habla con él por
 * HTTP igual que lo haría un sensor real.
 */

import type {
  AlertLevel,
  CropType,
  HydroponicReadings,
  HydroponicVariable,
} from '../../simulator/core/hydroponicModel.ts';

export type { AlertLevel, CropType, HydroponicReadings, HydroponicVariable };

export const VARIABLES: HydroponicVariable[] = [
  'airTemp',
  'humidity',
  'light',
  'ph',
  'ec',
  'solutionTemp',
  'tankLevel',
];

export type DeviceId =
  | 'recirculationPump'
  | 'refillValve'
  | 'phDoser'
  | 'nutrientDoser'
  | 'fans'
  | 'lamps';

export const DEVICE_IDS: DeviceId[] = [
  'recirculationPump',
  'refillValve',
  'phDoser',
  'nutrientDoser',
  'fans',
  'lamps',
];

/** `failed`: no responde. `stuckOn`: se quedó encendido y no obedece. */
export type DeviceFault = 'none' | 'failed' | 'stuckOn';
export const DEVICE_FAULTS: DeviceFault[] = ['none', 'failed', 'stuckOn'];

export type SensorMode = 'ok' | 'stuck' | 'bias' | 'disconnected';
export const SENSOR_MODES: SensorMode[] = ['ok', 'stuck', 'bias', 'disconnected'];

export type HydroSystem = 'NFT' | 'DWC';

export interface ZoneConfig {
  id: string;
  name: string;
  crop: CropType;
  /** Nombre del cultivo para mostrar (la ingesta solo conoce jitomate y lechuga). */
  cropLabel: string;
  system: HydroSystem;
  tankCapacityL: number;
}

export interface DeviceState {
  fault: DeviceFault;
  /** Si el equipo está funcionando físicamente en este instante. */
  running: boolean;
  /** Memoria del controlador local (histéresis). */
  localWant: boolean;
}

export interface SensorState {
  mode: SensorMode;
  /** Desfase que suma una sonda descalibrada. */
  bias: number;
  /** Valor congelado de una sonda pegada. */
  heldValue: number | null;
}

/** Órdenes del backend (GET /actuatorsState). `null` = todavía no se conocen. */
export interface BackendCommands {
  recirculationPump: boolean;
  phDoser: boolean;
  nutrientDoser: boolean;
  ventilation: boolean;
}

export interface ZoneState {
  config: ZoneConfig;
  tank: {
    volumeL: number;
    ph: number;
    ec: number;
    tempC: number;
    leakLph: number;
  };
  /** Litros que están circulando por los canales y no en el tanque. */
  channelsL: number;
  air: { tempC: number; rh: number };
  /** Luz a la altura del cultivo, en lux. */
  light: number;
  plants: { rootWetness: number; health: number };
  devices: Record<DeviceId, DeviceState>;
  /** Protección local: la bomba no rearma hasta recuperar nivel. */
  lowLevelLatch: boolean;
  node: {
    online: boolean;
    sensors: Record<HydroponicVariable, SensorState>;
  };
  backend: BackendCommands | null;
}

export interface WorldState {
  /** Hora simulada en milisegundos desde epoch. */
  simTimeMs: number;
  env: {
    /** Desplazamiento sobre la temperatura exterior normal, en °C. */
    tempOffset: number;
    /** Nubosidad de 0 (despejado) a 1 (cerrado). */
    cloud: number;
    outsideTemp: number;
    outsideRh: number;
    /** Altura del sol de 0 (noche) a 1 (mediodía). */
    sun: number;
  };
  power: { on: boolean };
  network: { online: boolean };
  zones: ZoneState[];
}

export type ZoneTarget = string;

export type Command =
  | { type: 'env.set'; tempOffset?: number; cloud?: number }
  | { type: 'clock.set'; hour: number }
  | { type: 'power.set'; on: boolean }
  | { type: 'network.set'; online: boolean }
  | { type: 'device.fault'; zone: ZoneTarget; device: DeviceId; fault: DeviceFault }
  | {
      type: 'tank.disturb';
      zone: ZoneTarget;
      dPh?: number;
      dEc?: number;
      dLiters?: number;
      dTemp?: number;
    }
  | { type: 'tank.leak'; zone: ZoneTarget; litersPerHour: number }
  | {
      type: 'sensor.fault';
      zone: ZoneTarget;
      variable: HydroponicVariable;
      mode: SensorMode;
      bias?: number;
    }
  | { type: 'node.set'; zone: ZoneTarget; online: boolean }
  | { type: 'world.reset' };

export type CommandType = Command['type'];

export interface ScenarioStep {
  /** Segundos de tiempo simulado desde que se lanza el escenario. */
  at: number;
  command: Command;
  /** Pasos de limpieza: se aplican aunque el escenario se detenga antes. */
  cleanup?: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  /** Qué se espera ver en la PWA y la app. */
  expect: string;
  category: 'solucion' | 'equipos' | 'energia' | 'clima' | 'red' | 'sensores' | 'demo' | 'propio';
  /** Velocidad recomendada para verlo en pocos minutos. */
  suggestedSpeed: number;
  steps: ScenarioStep[];
  builtin?: boolean;
}
