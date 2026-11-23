/**
 * Zonas reales del invernadero: el simulador interactivo arma sus naves con las
 * zonas y cultivos que el invernadero registró en la PWA, en lugar de las 3 de
 * ejemplo. Funciones puras, para probarlas con `node --test`.
 */

import type { Command, CropType, Scenario, ZoneConfig } from './types.ts';
import { DEFAULT_ZONES } from './world.ts';

const CROP_LABEL: Record<CropType, string> = { jitomate: 'Jitomate', lechuga: 'Lechuga' };

/** Lechuga va en NFT y jitomate en DWC, igual que en las zonas de ejemplo. */
export function toSimZones(zones: { zoneId: string; name: string; crop: CropType }[]): ZoneConfig[] {
  return zones.map((z) => ({
    id: z.zoneId,
    name: z.name || z.zoneId,
    crop: z.crop,
    cropLabel: CROP_LABEL[z.crop],
    system: z.crop === 'lechuga' ? 'NFT' : 'DWC',
    tankCapacityL: 200,
  }));
}

/**
 * Los escenarios incluidos se escribieron para zona-1, zona-2 y zona-3. Con
 * otras zonas, cada zona de ejemplo se lleva a la zona real en la misma
 * posición (la tercera vuelve a la primera si solo hay dos), y así ningún
 * escenario falla por una zona que no existe.
 */
export function adaptScenarioZones(scenario: Scenario, zoneIds: string[]): Scenario {
  if (zoneIds.length === 0) return scenario;
  const map = (zone: string): string => {
    if (zone === 'all' || zoneIds.includes(zone)) return zone;
    const idx = DEFAULT_ZONES.findIndex((z) => z.id === zone);
    return zoneIds[(idx >= 0 ? idx : 0) % zoneIds.length];
  };
  return {
    ...scenario,
    steps: scenario.steps.map((step) => {
      const command = step.command as Command & { zone?: string };
      if (typeof command.zone !== 'string') return step;
      return { ...step, command: { ...command, zone: map(command.zone) } as Command };
    }),
  };
}
