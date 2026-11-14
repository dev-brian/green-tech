/**
 * Comandos: la única forma de alterar el mundo. Los usan por igual la UI,
 * los escenarios y la API de control.
 */

import { createWorld, probeValue, trueReadings } from './world.ts';
import {
  DEVICE_FAULTS,
  DEVICE_IDS,
  SENSOR_MODES,
  VARIABLES,
  type Command,
  type DeviceFault,
  type DeviceId,
  type HydroponicVariable,
  type SensorMode,
  type WorldState,
  type ZoneState,
} from './types.ts';

export const DEVICE_LABELS: Record<DeviceId, string> = {
  recirculationPump: 'Bomba de recirculación',
  refillValve: 'Bomba de llenado',
  phDoser: 'Dosificadora de ácido',
  nutrientDoser: 'Dosificadora de nutrientes',
  fans: 'Ventilación',
  lamps: 'Lámparas',
};

export const VARIABLE_LABELS: Record<HydroponicVariable, { label: string; unit: string }> = {
  airTemp: { label: 'Temp. aire', unit: '°C' },
  humidity: { label: 'Humedad', unit: '%' },
  light: { label: 'Luz', unit: 'lux' },
  ph: { label: 'pH', unit: '' },
  ec: { label: 'EC', unit: 'mS/cm' },
  solutionTemp: { label: 'Temp. solución', unit: '°C' },
  tankLevel: { label: 'Nivel tanque', unit: '%' },
};

export const FAULT_LABELS: Record<DeviceFault, string> = {
  none: 'en servicio',
  failed: 'con falla (no responde)',
  stuckOn: 'pegada encendida',
};

export const SENSOR_MODE_LABELS: Record<SensorMode, string> = {
  ok: 'normal',
  stuck: 'pegada',
  bias: 'descalibrada',
  disconnected: 'desconectada',
};

export class CommandError extends Error {}

function fail(message: string): never {
  throw new CommandError(message);
}

function num(raw: unknown, name: string, min: number, max: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) fail(`${name} debe ser un número.`);
  if (raw < min || raw > max) fail(`${name} debe estar entre ${min} y ${max}.`);
  return raw;
}

function optNum(raw: unknown, name: string, min: number, max: number): number | undefined {
  return raw === undefined || raw === null ? undefined : num(raw, name, min, max);
}

function bool(raw: unknown, name: string): boolean {
  if (typeof raw !== 'boolean') fail(`${name} debe ser verdadero o falso.`);
  return raw;
}

function oneOf<T extends string>(raw: unknown, name: string, options: readonly T[]): T {
  if (typeof raw !== 'string' || !options.includes(raw as T)) {
    fail(`${name} debe ser uno de: ${options.join(', ')}.`);
  }
  return raw as T;
}

function zoneTarget(raw: unknown, zoneIds: string[], allowAll: boolean): string {
  const options = allowAll ? ['all', ...zoneIds] : zoneIds;
  return oneOf(raw, 'zone', options);
}

/** Valida un comando que llega de fuera (API o archivo de escenarios). */
export function parseCommand(raw: unknown, zoneIds: string[]): Command {
  if (!raw || typeof raw !== 'object') fail('El comando debe ser un objeto.');
  const c = raw as Record<string, unknown>;
  switch (c.type) {
    case 'env.set':
      return {
        type: 'env.set',
        tempOffset: optNum(c.tempOffset, 'tempOffset', -20, 20),
        cloud: optNum(c.cloud, 'cloud', 0, 1),
      };
    case 'clock.set':
      return { type: 'clock.set', hour: num(c.hour, 'hour', 0, 23.99) };
    case 'power.set':
      return { type: 'power.set', on: bool(c.on, 'on') };
    case 'network.set':
      return { type: 'network.set', online: bool(c.online, 'online') };
    case 'device.fault':
      return {
        type: 'device.fault',
        zone: zoneTarget(c.zone, zoneIds, true),
        device: oneOf(c.device, 'device', DEVICE_IDS),
        fault: oneOf(c.fault, 'fault', DEVICE_FAULTS),
      };
    case 'tank.disturb':
      return {
        type: 'tank.disturb',
        zone: zoneTarget(c.zone, zoneIds, true),
        dPh: optNum(c.dPh, 'dPh', -5, 5),
        dEc: optNum(c.dEc, 'dEc', -5, 5),
        dLiters: optNum(c.dLiters, 'dLiters', -500, 500),
        dTemp: optNum(c.dTemp, 'dTemp', -20, 20),
      };
    case 'tank.leak':
      return {
        type: 'tank.leak',
        zone: zoneTarget(c.zone, zoneIds, true),
        litersPerHour: num(c.litersPerHour, 'litersPerHour', 0, 1000),
      };
    case 'sensor.fault':
      return {
        type: 'sensor.fault',
        zone: zoneTarget(c.zone, zoneIds, true),
        variable: oneOf(c.variable, 'variable', VARIABLES),
        mode: oneOf(c.mode, 'mode', SENSOR_MODES),
        bias: optNum(c.bias, 'bias', -100000, 100000),
      };
    case 'node.set':
      return {
        type: 'node.set',
        zone: zoneTarget(c.zone, zoneIds, true),
        online: bool(c.online, 'online'),
      };
    case 'world.reset':
      return { type: 'world.reset' };
    default:
      fail(`Tipo de comando desconocido: ${String(c.type)}.`);
  }
}

function targets(world: WorldState, zone: string): ZoneState[] {
  if (zone === 'all') return world.zones;
  const found = world.zones.find((z) => z.config.id === zone);
  if (!found) fail(`No existe la zona ${zone}.`);
  return [found];
}

function zoneName(zone: string): string {
  return zone === 'all' ? 'todas las zonas' : zone;
}

function signed(value: number, unit = ''): string {
  return `${value > 0 ? '+' : ''}${value}${unit}`;
}

/** Texto en español para la bitácora y la línea de tiempo. */
export function describeCommand(command: Command): string {
  switch (command.type) {
    case 'env.set': {
      const parts: string[] = [];
      if (command.tempOffset !== undefined) {
        parts.push(
          command.tempOffset === 0
            ? 'temperatura exterior normal'
            : `temperatura exterior ${signed(command.tempOffset, ' °C')}`,
        );
      }
      if (command.cloud !== undefined) {
        parts.push(command.cloud === 0 ? 'cielo despejado' : `nubosidad ${Math.round(command.cloud * 100)} %`);
      }
      return `Clima: ${parts.join(', ') || 'sin cambios'}`;
    }
    case 'clock.set': {
      const h = Math.floor(command.hour);
      const m = Math.round((command.hour - h) * 60);
      return `Reloj simulado a las ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    case 'power.set':
      return command.on ? 'Regresa la electricidad' : 'Corte de electricidad';
    case 'network.set':
      return command.online ? 'Regresa internet' : 'Se cae internet';
    case 'device.fault':
      return `${DEVICE_LABELS[command.device]} ${FAULT_LABELS[command.fault]} en ${zoneName(command.zone)}`;
    case 'tank.disturb': {
      const parts: string[] = [];
      if (command.dPh) parts.push(`pH ${signed(command.dPh)}`);
      if (command.dEc) parts.push(`EC ${signed(command.dEc)}`);
      if (command.dLiters) parts.push(`${signed(command.dLiters, ' L')}`);
      if (command.dTemp) parts.push(`${signed(command.dTemp, ' °C')}`);
      return `Tanque de ${zoneName(command.zone)}: ${parts.join(', ') || 'sin cambios'}`;
    }
    case 'tank.leak':
      return command.litersPerHour > 0
        ? `Fuga de ${command.litersPerHour} L/h en el tanque de ${zoneName(command.zone)}`
        : `Fuga reparada en ${zoneName(command.zone)}`;
    case 'sensor.fault': {
      const label = VARIABLE_LABELS[command.variable].label;
      const extra = command.mode === 'bias' ? ` (${signed(command.bias ?? 0)})` : '';
      return `Sonda de ${label} ${SENSOR_MODE_LABELS[command.mode]}${extra} en ${zoneName(command.zone)}`;
    }
    case 'node.set':
      return `Nodo de sensores ${command.online ? 'encendido' : 'apagado'} en ${zoneName(command.zone)}`;
    case 'world.reset':
      return 'Invernadero reiniciado';
  }
}

/** Aplica un comando ya validado. Muta `world`. */
export function applyCommand(world: WorldState, command: Command): void {
  switch (command.type) {
    case 'env.set':
      if (command.tempOffset !== undefined) world.env.tempOffset = command.tempOffset;
      if (command.cloud !== undefined) world.env.cloud = command.cloud;
      return;
    case 'clock.set': {
      const d = new Date(world.simTimeMs);
      const h = Math.floor(command.hour);
      d.setHours(h, Math.round((command.hour - h) * 60), 0, 0);
      world.simTimeMs = d.getTime();
      return;
    }
    case 'power.set':
      world.power.on = command.on;
      return;
    case 'network.set':
      world.network.online = command.online;
      return;
    case 'device.fault':
      for (const zone of targets(world, command.zone)) {
        zone.devices[command.device].fault = command.fault;
      }
      return;
    case 'tank.disturb':
      for (const zone of targets(world, command.zone)) {
        const tank = zone.tank;
        if (command.dLiters) {
          const next = Math.max(0, Math.min(zone.config.tankCapacityL, tank.volumeL + command.dLiters));
          // Agregar agua limpia diluye; sacar solución no cambia la concentración.
          if (next > tank.volumeL && next > 0) tank.ec = (tank.ec * tank.volumeL) / next;
          tank.volumeL = next;
        }
        if (command.dPh) tank.ph = Math.max(3.5, Math.min(9.5, tank.ph + command.dPh));
        if (command.dEc) tank.ec = Math.max(0.05, Math.min(9.5, tank.ec + command.dEc));
        if (command.dTemp) tank.tempC = Math.max(2, Math.min(45, tank.tempC + command.dTemp));
      }
      return;
    case 'tank.leak':
      for (const zone of targets(world, command.zone)) zone.tank.leakLph = command.litersPerHour;
      return;
    case 'sensor.fault':
      for (const zone of targets(world, command.zone)) {
        const sensor = zone.node.sensors[command.variable];
        // Una sonda pegada se queda con lo último que marcaba.
        const held = command.mode === 'stuck' ? probeValue(zone, command.variable) : null;
        sensor.mode = command.mode;
        sensor.bias = command.mode === 'bias' ? (command.bias ?? 0) : 0;
        sensor.heldValue = held ?? (command.mode === 'stuck' ? trueReadings(zone)[command.variable] : null);
      }
      return;
    case 'node.set':
      for (const zone of targets(world, command.zone)) zone.node.online = command.online;
      return;
    case 'world.reset': {
      const fresh = createWorld(
        world.simTimeMs,
        world.zones.map((z) => z.config),
      );
      world.env = fresh.env;
      world.power = fresh.power;
      world.network = fresh.network;
      world.zones = fresh.zones;
      return;
    }
  }
}
