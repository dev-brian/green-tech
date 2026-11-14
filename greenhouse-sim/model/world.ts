/**
 * Física del invernadero. Funciones puras sobre `WorldState`: sin red, sin
 * reloj real y sin DOM, para poder probarlas con `node --test`.
 *
 * Cada zona es un circuito hidropónico completo (tanque, bomba, canales,
 * dosificadoras, llenado, ventilación y lámparas). El clima exterior y la red
 * eléctrica son compartidos.
 */

import {
  DEVICE_IDS,
  VARIABLES,
  type CropType,
  type DeviceId,
  type DeviceState,
  type HydroponicReadings,
  type HydroponicVariable,
  type SensorState,
  type WorldState,
  type ZoneConfig,
  type ZoneState,
} from './types.ts';

export const DEFAULT_ZONES: ZoneConfig[] = [
  { id: 'zona-1', name: 'Zona 1', crop: 'lechuga', cropLabel: 'Lechuga', system: 'NFT', tankCapacityL: 200 },
  { id: 'zona-2', name: 'Zona 2', crop: 'jitomate', cropLabel: 'Jitomate', system: 'DWC', tankCapacityL: 200 },
  { id: 'zona-3', name: 'Zona 3', crop: 'lechuga', cropLabel: 'Hierbas aromáticas', system: 'NFT', tankCapacityL: 200 },
];

/** Parámetros agronómicos y de equipo por cultivo. */
export interface CropProfile {
  phSetpoint: number;
  ecSetpoint: number;
  /** Banda del controlador de EC: enciende en sp - low, apaga en sp + high. */
  ecBand: { low: number; high: number };
  /** Termostato de ventilación (°C). */
  fanOn: number;
  fanOff: number;
  /** Cuánto enfría la ventilación respecto al exterior (pared húmeda). */
  coolingDelta: number;
  /** Humedad que aporta la ventilación sobre la exterior (% HR). */
  ventRhBoost: number;
  /** Fracción de luz solar que deja pasar la cubierta. */
  transmissivity: number;
  /** Las lámparas encienden si el sol aporta menos que esto (lux). */
  lampOnLux: number;
  lampLux: number;
  /** Transpiración a plena luz (L/h). */
  etMaxLph: number;
  /** Absorción de sales a plena luz (mS/cm por hora, referida al tanque lleno). */
  ecUptakePerHour: number;
  /** Aporte de la dosificadora de nutrientes (mS/cm por hora). */
  ecDosePerHour: number;
}

export const CROP_PROFILES: Record<CropType, CropProfile> = {
  lechuga: {
    phSetpoint: 5.9,
    ecSetpoint: 1.0,
    ecBand: { low: 0.05, high: 0.03 },
    fanOn: 21.5,
    fanOff: 19.5,
    coolingDelta: 6,
    ventRhBoost: 10,
    transmissivity: 0.36,
    lampOnLux: 16000,
    lampLux: 17000,
    etMaxLph: 3,
    ecUptakePerHour: 0.05,
    ecDosePerHour: 0.5,
  },
  jitomate: {
    phSetpoint: 6.0,
    ecSetpoint: 2.75,
    ecBand: { low: 0.08, high: 0.05 },
    fanOn: 26,
    fanOff: 23.5,
    coolingDelta: 1.5,
    ventRhBoost: 0,
    transmissivity: 0.5,
    lampOnLux: 20000,
    lampLux: 22000,
    etMaxLph: 8,
    ecUptakePerHour: 0.12,
    ecDosePerHour: 1.2,
  },
};

/** Constantes físicas compartidas. */
export const PHYSICS = {
  /** Agua de la red: alcalina, casi sin sales y fresca. */
  supply: { ph: 7.6, ec: 0.3, tempC: 18 },
  refillLph: 40,
  refillOnPct: 82,
  refillOffPct: 90,
  /** Litros que viven en los canales mientras la bomba recircula. */
  channelHoldupL: 16,
  channelFlowLpm: 8,
  /** Deriva natural del pH por absorción de nitratos (pH por hora a plena luz). */
  phDriftPerHour: 0.15,
  phDosePerHour: 1.5,
  phBand: { on: 0.15, off: 0.05 },
  /** Qué tanto mueve el pH el agua de llenado (amortiguamiento de la solución). */
  phMixFactor: 0.6,
  fullSunLux: 90000,
  /** Efecto invernadero: grados sobre el exterior sin ventilar. */
  greenhouseOffsetC: 2.5,
  passiveExchangePerHour: 1.5,
  fanExchangePerHour: 5,
  solarGainCPerHour: 8,
  lampGainCPerHour: 1.5,
  solutionLagPerHour: 0.2,
  solutionOffsetC: -2,
  pumpHeatCPerHour: 0.1,
  /** La bomba no arranca en seco y no rearma hasta recuperar nivel. */
  dryRunPct: 8,
  rearmPct: 30,
  maxSubstepSec: 10,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function freshDevice(): DeviceState {
  return { fault: 'none', running: false, localWant: false };
}

function freshSensor(): SensorState {
  return { mode: 'ok', bias: 0, heldValue: null };
}

function createZone(config: ZoneConfig): ZoneState {
  const profile = CROP_PROFILES[config.crop];
  const devices = {} as Record<DeviceId, DeviceState>;
  for (const id of DEVICE_IDS) devices[id] = freshDevice();
  const sensors = {} as Record<HydroponicVariable, SensorState>;
  for (const key of VARIABLES) sensors[key] = freshSensor();

  return {
    config,
    tank: {
      volumeL: config.tankCapacityL * 0.88,
      ph: profile.phSetpoint,
      ec: profile.ecSetpoint,
      tempC: config.crop === 'lechuga' ? 19.5 : 21.5,
      leakLph: 0,
    },
    channelsL: PHYSICS.channelHoldupL,
    air: { tempC: config.crop === 'lechuga' ? 20.5 : 24, rh: 68 },
    light: 0,
    plants: { rootWetness: 1, health: 100 },
    devices,
    lowLevelLatch: false,
    node: { online: true, sensors },
    backend: null,
  };
}

export function createWorld(
  startTimeMs: number,
  zones: ZoneConfig[] = DEFAULT_ZONES,
): WorldState {
  const world: WorldState = {
    simTimeMs: startTimeMs,
    env: { tempOffset: 0, cloud: 0, outsideTemp: 21, outsideRh: 67, sun: 0 },
    power: { on: true },
    network: { online: true },
    zones: zones.map(createZone),
  };
  updateEnvironment(world);
  // Un paso de cero segundos deja luz y equipos coherentes con la hora inicial.
  for (const zone of world.zones) {
    updateDevices(world, zone);
    updateLight(world, zone);
    updateDevices(world, zone);
    updateLight(world, zone);
  }
  return world;
}

/** Hora local del día simulado, de 0 a 24. */
export function hourOfDay(simTimeMs: number): number {
  const d = new Date(simTimeMs);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

export function tankLevelPct(zone: ZoneState): number {
  return clamp((zone.tank.volumeL / zone.config.tankCapacityL) * 100, 0, 100);
}

function updateEnvironment(world: WorldState): void {
  const hour = hourOfDay(world.simTimeMs);
  const daily = Math.sin((2 * Math.PI * (hour - 9)) / 24); // máximo a las 15 h
  const { env } = world;
  env.sun = hour > 6.5 && hour < 18.5 ? Math.sin((Math.PI * (hour - 6.5)) / 12) : 0;
  env.outsideTemp = 21 + 4 * daily + env.tempOffset;
  env.outsideRh = clamp(67 - 8 * daily - 1.5 * env.tempOffset, 15, 95);
}

function sunInside(world: WorldState, zone: ZoneState): number {
  const profile = CROP_PROFILES[zone.config.crop];
  return PHYSICS.fullSunLux * world.env.sun * (1 - 0.75 * world.env.cloud) * profile.transmissivity;
}

function updateLight(world: WorldState, zone: ZoneState): void {
  const profile = CROP_PROFILES[zone.config.crop];
  zone.light = sunInside(world, zone) + (zone.devices.lamps.running ? profile.lampLux : 0);
}

/**
 * Lo que "ve" el controlador local: el valor real pasado por la sonda, sin
 * ruido. Si la sonda está descalibrada, el controlador se equivoca con ella.
 */
export function probeValue(zone: ZoneState, variable: HydroponicVariable): number {
  const truth = trueReadings(zone)[variable];
  const sensor = zone.node.sensors[variable];
  switch (sensor.mode) {
    case 'stuck':
      return sensor.heldValue ?? truth;
    case 'bias':
      return truth + sensor.bias;
    case 'disconnected':
      return DISCONNECTED_VALUE[variable];
    default:
      return truth;
  }
}

/**
 * Valor que entrega el hardware con la sonda suelta. Los de temperatura
 * (-127 °C, el error típico de un DS18B20) quedan fuera del rango físico del
 * contrato, así que la ingesta rechaza la lectura completa con 422.
 */
export const DISCONNECTED_VALUE: Record<HydroponicVariable, number> = {
  airTemp: -127,
  humidity: 0,
  light: 0,
  ph: 14,
  ec: 0,
  solutionTemp: -127,
  tankLevel: 0,
};

/** Estado real del invernadero en las 7 variables del contrato, sin redondear. */
export function trueReadings(zone: ZoneState): HydroponicReadings {
  return {
    airTemp: zone.air.tempC,
    humidity: zone.air.rh,
    light: zone.light,
    ph: zone.tank.ph,
    ec: zone.tank.ec,
    solutionTemp: zone.tank.tempC,
    tankLevel: tankLevelPct(zone),
  };
}

function hysteresis(current: boolean, value: number, onAbove: number, offBelow: number): boolean {
  if (value > onAbove) return true;
  if (value < offBelow) return false;
  return current;
}

/** Controlador local + órdenes del backend + fallas = qué equipos funcionan. */
function updateDevices(world: WorldState, zone: ZoneState): void {
  const profile = CROP_PROFILES[zone.config.crop];
  const powered = world.power.on;
  const d = zone.devices;
  const backend = zone.backend;
  const level = tankLevelPct(zone);

  const resolve = (device: DeviceState, want: boolean): void => {
    device.running =
      powered && device.fault !== 'failed' && (device.fault === 'stuckOn' || want);
  };

  // Dosificadora de ácido: mantiene el pH alrededor del punto de ajuste.
  const ph = probeValue(zone, 'ph');
  d.phDoser.localWant = hysteresis(
    d.phDoser.localWant,
    ph,
    profile.phSetpoint + PHYSICS.phBand.on,
    profile.phSetpoint - PHYSICS.phBand.off,
  );
  // Enclavamiento local: una orden del backend puede adelantar el encendido, pero
  // nunca empuja la variable más allá del punto de corte del controlador. Así una
  // orden vieja (el backend responde cada ciclo de publicación) no sobredosifica.
  resolve(
    d.phDoser,
    d.phDoser.localWant ||
      (backend?.phDoser === true && ph > profile.phSetpoint - PHYSICS.phBand.off),
  );

  // Dosificadora de nutrientes: repone sales cuando baja la EC.
  const ec = probeValue(zone, 'ec');
  d.nutrientDoser.localWant = !hysteresis(
    !d.nutrientDoser.localWant,
    ec,
    profile.ecSetpoint + profile.ecBand.high,
    profile.ecSetpoint - profile.ecBand.low,
  );
  resolve(
    d.nutrientDoser,
    d.nutrientDoser.localWant ||
      (backend?.nutrientDoser === true && ec < profile.ecSetpoint + profile.ecBand.high),
  );

  // Llenado por nivel.
  const measuredLevel = probeValue(zone, 'tankLevel');
  d.refillValve.localWant = !hysteresis(
    !d.refillValve.localWant,
    measuredLevel,
    PHYSICS.refillOffPct,
    PHYSICS.refillOnPct,
  );
  resolve(d.refillValve, d.refillValve.localWant);

  // Ventilación por termostato.
  const airTemp = probeValue(zone, 'airTemp');
  d.fans.localWant = hysteresis(d.fans.localWant, airTemp, profile.fanOn, profile.fanOff);
  resolve(d.fans, d.fans.localWant || (backend?.ventilation === true && airTemp > profile.fanOff));

  // Lámparas: completan la luz cuando el sol no alcanza.
  const sun = sunInside(world, zone);
  d.lamps.localWant = !hysteresis(
    !d.lamps.localWant,
    sun,
    profile.lampOnLux * 1.25,
    profile.lampOnLux,
  );
  resolve(d.lamps, d.lamps.localWant);

  // Recirculación: siempre encendida salvo protección por nivel bajo.
  if (backend?.recirculationPump === false || level < PHYSICS.dryRunPct) {
    zone.lowLevelLatch = true;
  } else if (zone.lowLevelLatch && level >= PHYSICS.rearmPct) {
    zone.lowLevelLatch = false;
  }
  d.recirculationPump.localWant = !zone.lowLevelLatch;
  resolve(d.recirculationPump, d.recirculationPump.localWant);
  // Ni pegada puede mover agua que no hay.
  if (level <= 0.5) d.recirculationPump.running = false;
}

function stepZone(world: WorldState, zone: ZoneState, dtSec: number): void {
  const profile = CROP_PROFILES[zone.config.crop];
  const dtH = dtSec / 3600;
  const capacity = zone.config.tankCapacityL;
  const tank = zone.tank;
  const d = zone.devices;

  updateDevices(world, zone);
  updateLight(world, zone);

  const flowing = d.recirculationPump.running;
  const healthFactor = zone.plants.health / 100;
  const lightFactor = clamp(zone.light / 30000, 0.1, 1.3);
  // Sin recirculación las raíces casi no toman agua ni nutrientes.
  const uptakeFactor = lightFactor * healthFactor * (flowing ? 1 : 0.12);

  // ── Agua: canales, transpiración, fuga y llenado ──────────────────
  const holdupTarget = flowing ? PHYSICS.channelHoldupL : 0;
  const maxMove = PHYSICS.channelFlowLpm * (dtSec / 60);
  const toChannels = clamp(holdupTarget - zone.channelsL, -maxMove, Math.min(maxMove, tank.volumeL));
  zone.channelsL += toChannels;
  tank.volumeL -= toChannels;

  let salts = tank.ec * tank.volumeL;
  const transpired = Math.min(tank.volumeL, profile.etMaxLph * uptakeFactor * dtH);
  tank.volumeL -= transpired; // el agua se va, las sales se quedan

  const leaked = Math.min(tank.volumeL, tank.leakLph * dtH);
  if (leaked > 0) {
    salts -= tank.ec * leaked; // la fuga se lleva solución completa
    tank.volumeL -= leaked;
  }

  if (d.refillValve.running) {
    const added = PHYSICS.refillLph * dtH;
    const before = Math.max(tank.volumeL, 1);
    salts += PHYSICS.supply.ec * added;
    tank.ph += (PHYSICS.supply.ph - tank.ph) * (added / (before + added)) * PHYSICS.phMixFactor;
    tank.tempC += (PHYSICS.supply.tempC - tank.tempC) * (added / (before + added));
    tank.volumeL += added;
    if (tank.volumeL > capacity) {
      // Rebosa: se pierde solución ya mezclada.
      salts *= capacity / tank.volumeL;
      tank.volumeL = capacity;
    }
  }

  // ── Sales ────────────────────────────────────────────────────────
  salts -= profile.ecUptakePerHour * capacity * uptakeFactor * dtH;
  if (d.nutrientDoser.running) salts += profile.ecDosePerHour * capacity * dtH;
  tank.ec = tank.volumeL > 1 ? clamp(salts / tank.volumeL, 0.05, 9.5) : tank.ec;

  // ── pH ───────────────────────────────────────────────────────────
  tank.ph += PHYSICS.phDriftPerHour * uptakeFactor * dtH;
  if (d.phDoser.running) tank.ph -= PHYSICS.phDosePerHour * dtH;
  tank.ph = clamp(tank.ph, 3.5, 9.5);

  // ── Aire ─────────────────────────────────────────────────────────
  const fans = d.fans.running;
  const sunLux = sunInside(world, zone);
  const out = world.env;
  let dAir =
    PHYSICS.passiveExchangePerHour * (out.outsideTemp + PHYSICS.greenhouseOffsetC - zone.air.tempC) +
    PHYSICS.solarGainCPerHour * (sunLux / 40000) +
    (d.lamps.running ? PHYSICS.lampGainCPerHour : 0);
  if (fans) {
    dAir += PHYSICS.fanExchangePerHour * (out.outsideTemp - profile.coolingDelta - zone.air.tempC);
  }
  zone.air.tempC = clamp(zone.air.tempC + dAir * dtH, -5, 55);

  let dRh = 1.0 * (out.outsideRh - zone.air.rh) + 3 * uptakeFactor;
  if (fans) dRh += 4 * (out.outsideRh + profile.ventRhBoost - zone.air.rh);
  zone.air.rh = clamp(zone.air.rh + dRh * dtH, 5, 100);

  // ── Temperatura de la solución ───────────────────────────────────
  tank.tempC +=
    (PHYSICS.solutionLagPerHour * (zone.air.tempC + PHYSICS.solutionOffsetC - tank.tempC) +
      (flowing ? PHYSICS.pumpHeatCPerHour : 0)) *
    dtH;
  tank.tempC = clamp(tank.tempC, 2, 45);

  // ── Plantas (solo para la vista; no se publica) ──────────────────
  const plants = zone.plants;
  if (flowing) {
    plants.rootWetness = clamp(plants.rootWetness + dtSec / 120, 0, 1);
  } else {
    const dryHours = zone.config.system === 'NFT' ? 0.67 : 6;
    plants.rootWetness = clamp(plants.rootWetness - dtH / dryHours, 0, 1);
  }
  let stress = 0;
  if (plants.rootWetness < 0.3) stress += 30;
  if (tank.ph < 5 || tank.ph > 7) stress += 4;
  if (zone.air.tempC > 34 || zone.air.tempC < 8) stress += 4;
  if (tank.tempC > 28) stress += 3;
  plants.health = clamp(plants.health + (stress > 0 ? -stress : 6) * dtH, 0, 100);
}

/** Avanza el mundo `dtSec` segundos de tiempo simulado. */
export function stepWorld(world: WorldState, dtSec: number): void {
  let remaining = dtSec;
  while (remaining > 1e-9) {
    const dt = Math.min(remaining, PHYSICS.maxSubstepSec);
    world.simTimeMs += dt * 1000;
    updateEnvironment(world);
    for (const zone of world.zones) stepZone(world, zone, dt);
    remaining -= dt;
  }
}
