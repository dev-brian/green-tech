/**
 * Estado de los actuadores por zona: greenhouses/{id}/actuators/{zoneId}.
 * Lo escribe el motor del backend (simulator/core/alertAndActuatorEngine.ts)
 * en cada lectura. La PWA solo lo muestra (auditoría A2, issue #68).
 *
 * Lógica pura, sin Firebase, para probarla con `node --test`.
 */

export type ActuatorKey = 'recirculationPump' | 'phDoser' | 'nutrientDoser' | 'ventilation';

export const ACTUATOR_ORDER: readonly ActuatorKey[] = [
  'recirculationPump',
  'phDoser',
  'nutrientDoser',
  'ventilation',
];

/** Nombre y qué hace, en lenguaje de productor. */
export const ACTUATOR_INFO: Record<ActuatorKey, { name: string; on: string; off: string }> = {
  recirculationPump: {
    name: 'Bomba de recirculación',
    on: 'Moviendo la solución nutritiva.',
    off: 'Detenida. Se apaga sola si el tanque está muy bajo.',
  },
  phDoser: {
    name: 'Dosificador de pH',
    on: 'Agregando solución para bajar el pH.',
    off: 'En espera: el pH no está alto.',
  },
  nutrientDoser: {
    name: 'Dosificador de nutrientes',
    on: 'Agregando nutrientes porque la EC está baja.',
    off: 'En espera: la EC no está baja.',
  },
  ventilation: {
    name: 'Ventilación',
    on: 'Encendida porque el aire está caliente.',
    off: 'Apagada: la temperatura del aire está bien.',
  },
};

export interface ActuatorItem {
  /** null = el backend todavía no reporta este equipo. */
  on: boolean | null;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export type ZoneActuators = {
  zoneId: string;
  updatedAt: Date | null;
} & Record<ActuatorKey, ActuatorItem>;

function parseDate(raw: unknown): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (raw && typeof raw === 'object' && typeof (raw as { toDate?: unknown }).toDate === 'function') {
    const d = (raw as { toDate: () => unknown }).toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseItem(raw: unknown): ActuatorItem {
  if (!raw || typeof raw !== 'object') return { on: null, updatedAt: null, updatedBy: null };
  const o = raw as Record<string, unknown>;
  return {
    on: typeof o.on === 'boolean' ? o.on : null,
    updatedAt: parseDate(o.updatedAt),
    updatedBy: typeof o.updatedBy === 'string' ? o.updatedBy : null,
  };
}

/** No inventa estados: lo que no venga en el documento queda como "sin dato". */
export function parseActuatorsDoc(zoneId: string, data: Record<string, unknown>): ZoneActuators {
  const out = { zoneId, updatedAt: parseDate(data.updatedAt) } as ZoneActuators;
  for (const k of ACTUATOR_ORDER) out[k] = parseItem(data[k]);
  return out;
}
