/**
 * Motor del simulador hidropónico con perfiles de jitomate y lechuga,
 * deriva realista, escenarios forzados y lazo cerrado con actuadores
 * (T2.2 #38, T2.3 #39, T8.3 #69).
 */

import type { CropType, HydroponicReadings } from './hydroponicModel.ts';
import type { ZoneActuatorsState } from './alertAndActuatorEngine.ts';

export type SimulatorScenario =
  | 'normal'
  | 'ph-alto'
  | 'ec-baja'
  | 'tanque-bajo'
  | 'solucion-caliente'
  | 'ola-de-calor';

export interface SimulatedZoneConfig {
  zoneId: string;
  name: string;
  crop: CropType;
}

export const DEFAULT_SIMULATED_ZONES: SimulatedZoneConfig[] = [
  { zoneId: 'zona-1', name: 'Zona 1 · Jitomate Norte', crop: 'jitomate' },
  { zoneId: 'zona-2', name: 'Zona 2 · Jitomate Sur', crop: 'jitomate' },
  { zoneId: 'zona-3', name: 'Zona 3 · Lechuga NFT', crop: 'lechuga' },
];

function round(val: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function createInitialReadings(crop: CropType): HydroponicReadings {
  if (crop === 'lechuga') {
    return {
      airTemp: 20.5,
      humidity: 68,
      light: 24000,
      ph: 5.9,
      ec: 1.05,
      solutionTemp: 20.0,
      tankLevel: 92,
    };
  }
  return {
    airTemp: 23.5,
    humidity: 66,
    light: 32000,
    ph: 6.0,
    ec: 2.75,
    solutionTemp: 21.0,
    tankLevel: 95,
  };
}

/**
 * Avanza un minuto de simulación para una zona:
 * - Deriva realista: el pH sube lentamente (+0.02/min) por absorción de nitratos,
 *   la EC baja (-0.025/min) y el nivel del tanque baja (-0.18%/min) por consumo.
 * - Lazo cerrado (T8.3): si los actuadores virtuales están encendidos, corrigen
 *   la variable correspondiente hacia el punto óptimo.
 * - Escenarios forzados (T2.3): inyectan condiciones críticas para demostrar alertas.
 */
export function stepZoneReadings(
  prev: HydroponicReadings,
  crop: CropType,
  options: {
    scenario?: SimulatorScenario;
    actuators?: Pick<
      ZoneActuatorsState,
      'recirculationPump' | 'phDoser' | 'nutrientDoser' | 'ventilation'
    >;
    deterministic?: boolean;
  } = {},
): HydroponicReadings {
  const { scenario = 'normal', actuators, deterministic = false } = options;
  const noise = (amp: number) => (deterministic ? 0 : (Math.random() - 0.5) * amp);

  const targetAirTemp = crop === 'lechuga' ? 20.0 : 23.5;

  // Deriva natural por consumo hidropónico
  let airTemp = prev.airTemp + (targetAirTemp - prev.airTemp) * 0.08 + 0.12 + noise(0.3);
  let humidity = prev.humidity + (68 - prev.humidity) * 0.1 + noise(1.2);
  const light = clamp(prev.light + noise(800), 15000, 42000);
  let ph = prev.ph + 0.02 + noise(0.01);
  let ec = prev.ec - 0.025 + noise(0.01);
  let solutionTemp = prev.solutionTemp + (21.0 - prev.solutionTemp) * 0.08 + noise(0.15);
  let tankLevel = prev.tankLevel - 0.18;

  // Lazo cerrado con actuadores virtuales (T8.3)
  if (actuators) {
    if (actuators.phDoser.on) {
      // La dosificadora de ácido baja el pH hacia 6.0
      ph -= 0.18;
    }
    if (actuators.nutrientDoser.on) {
      // La dosificadora de nutrientes sube la EC hacia el óptimo del cultivo
      ec += crop === 'lechuga' ? 0.12 : 0.25;
    }
    if (actuators.ventilation.on) {
      // La ventilación enfría el aire y reduce exceso de humedad
      airTemp -= 1.1;
      humidity -= 1.5;
    }
    if (tankLevel < 25 && !actuators.recirculationPump.on) {
      // Si la bomba se apagó por protección, el nivel deja de caer
      tankLevel = prev.tankLevel;
    }
  }

  // Escenarios forzados (T2.3)
  switch (scenario) {
    case 'ph-alto':
      ph = 7.45;
      break;
    case 'ec-baja':
      ec = crop === 'lechuga' ? 0.38 : 1.15;
      break;
    case 'tanque-bajo':
      tankLevel = 14;
      break;
    case 'solucion-caliente':
      solutionTemp = 28.4;
      break;
    case 'ola-de-calor':
      airTemp = 36.2;
      humidity = 34;
      solutionTemp = 26.8;
      break;
    case 'normal':
    default:
      break;
  }

  return {
    airTemp: round(clamp(airTemp, -5, 55), 1),
    humidity: Math.round(clamp(humidity, 10, 100)),
    light: Math.round(clamp(light, 0, 120000)),
    ph: round(clamp(ph, 3.5, 9.5), 2),
    ec: round(clamp(ec, 0.1, 6.0), 2),
    solutionTemp: round(clamp(solutionTemp, 10, 40), 1),
    tankLevel: round(clamp(tankLevel, 0, 100), 1),
  };
}
