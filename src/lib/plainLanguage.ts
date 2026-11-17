import type { HydroponicVariable, SensorStatus, ThresholdRange } from './sensorThresholds';

/**
 * Textos en lenguaje de productor para el inicio "sencillo primero"
 * (SKILL.md § "Sencillo primero"). La UI no inventa explicaciones: salen
 * de este catálogo, que revisa el equipo.
 *
 * Nada aquí decide si un valor está bien o mal: el estado lo manda el
 * backend. Solo se usa el umbral para saber si el problema es "alto" o
 * "bajo" y para dibujar la banda ideal del medidor.
 */

export type VariableGroup = 'aire' | 'agua';
export type Direction = 'high' | 'low';

interface Advice {
  title: string;
  meaning: string;
  action: string;
  /** Lo que el sistema hace solo, si aplica. */
  system?: string;
}

export interface VariableInfo {
  name: string;
  /** Nombre técnico para quien ya lo conoce, p. ej. "pH" o "EC". */
  technical?: string;
  /** Explicación corta de qué mide. */
  hint?: string;
  unit: string;
  decimals: number;
  group: VariableGroup;
  /** Palabras en los extremos del medidor. */
  ends: [string, string];
  /** Escala fija del medidor (si no, se calcula de los umbrales). */
  scale?: [number, number];
  high: Advice;
  low: Advice;
}

export const VARIABLE_ORDER: HydroponicVariable[] = [
  'airTemp',
  'humidity',
  'light',
  'ph',
  'ec',
  'solutionTemp',
  'tankLevel',
];

export const VARIABLES: Record<HydroponicVariable, VariableInfo> = {
  airTemp: {
    name: 'Temperatura',
    unit: '°C',
    decimals: 1,
    group: 'aire',
    ends: ['Frío', 'Calor'],
    high: {
      title: 'Hace demasiado calor',
      meaning: 'Con calor las plantas se estresan y gastan más agua; la lechuga puede espigarse.',
      system: 'La ventilación se enciende sola para refrescar.',
      action: 'Abre ventilas o pon sombra en las horas de más sol.',
    },
    low: {
      title: 'Hace demasiado frío',
      meaning: 'Con frío las plantas crecen más lento.',
      action: 'Cierra ventilas, sobre todo en la noche, y revisa que no entren corrientes.',
    },
  },
  humidity: {
    name: 'Humedad',
    unit: '%',
    decimals: 0,
    group: 'aire',
    ends: ['Seco', 'Húmedo'],
    scale: [0, 100],
    high: {
      title: 'Hay demasiada humedad en el aire',
      meaning: 'Con tanta humedad aparecen hongos en las hojas.',
      system: 'La ventilación ayuda a sacar el aire húmedo.',
      action: 'Ventila el invernadero y evita mojar el piso.',
    },
    low: {
      title: 'El aire está muy seco',
      meaning: 'Las plantas pierden agua más rápido y se marchitan.',
      action: 'Moja los pasillos o usa nebulización si la hay.',
    },
  },
  light: {
    name: 'Luz',
    unit: 'lux',
    decimals: 0,
    group: 'aire',
    ends: ['Oscuro', 'Mucho sol'],
    high: {
      title: 'Hay demasiada luz',
      meaning: 'El exceso de sol puede quemar las hojas.',
      action: 'Pon malla sombra en las horas de más sol.',
    },
    low: {
      title: 'Hay poca luz',
      meaning: 'Con poca luz las plantas crecen débiles y alargadas.',
      action: 'Revisa que nada tape el techo y limpia los plásticos.',
    },
  },
  ph: {
    name: 'Acidez',
    technical: 'pH',
    unit: '',
    decimals: 2,
    group: 'agua',
    ends: ['Muy ácida', 'Muy alcalina'],
    high: {
      title: 'El agua está demasiado alcalina',
      meaning: 'Las raíces absorben menos hierro y otros nutrientes; las hojas nuevas pueden ponerse amarillas.',
      system: 'La dosificadora de pH lo corrige sola.',
      action: 'Revisa en 30 minutos. Si no baja, mide el pH a mano y revisa que quede ácido en el depósito.',
    },
    low: {
      title: 'El agua está demasiado ácida',
      meaning: 'Las raíces se dañan y absorben mal el calcio y el magnesio.',
      system: 'La dosificadora de pH lo corrige sola.',
      action: 'Revisa en 30 minutos. Si no sube, mide el pH a mano y revisa el depósito de regulador.',
    },
  },
  ec: {
    name: 'Nutrientes',
    technical: 'EC',
    hint: 'Cuánto alimento lleva el agua',
    unit: 'mS/cm',
    decimals: 2,
    group: 'agua',
    ends: ['Poco alimento', 'Mucho alimento'],
    high: {
      title: 'El agua lleva demasiados nutrientes',
      meaning: 'El exceso de sales quema las puntas de las hojas.',
      action: 'Agrega agua limpia al tanque para diluir la solución.',
    },
    low: {
      title: 'El agua lleva pocos nutrientes',
      meaning: 'Las plantas no tienen suficiente alimento y se ven pálidas.',
      system: 'La dosificadora de nutrientes agrega solución sola.',
      action: 'Si no sube en una hora, revisa que quede nutriente en el depósito.',
    },
  },
  solutionTemp: {
    name: 'Temperatura del agua',
    unit: '°C',
    decimals: 1,
    group: 'agua',
    ends: ['Fría', 'Caliente'],
    high: {
      title: 'El agua está muy caliente',
      meaning: 'El agua caliente lleva menos oxígeno y las raíces se pueden pudrir.',
      action: 'Pon sombra sobre el tanque o agrega agua fresca.',
    },
    low: {
      title: 'El agua está muy fría',
      meaning: 'Las raíces absorben los nutrientes más despacio.',
      action: 'Tapa o aísla el tanque.',
    },
  },
  tankLevel: {
    name: 'Agua en el tanque',
    unit: '%',
    decimals: 0,
    group: 'agua',
    ends: ['Vacío', 'Lleno'],
    scale: [0, 100],
    high: {
      title: 'El tanque está demasiado lleno',
      meaning: 'Se puede desbordar y perder solución.',
      action: 'Revisa que el relleno no se haya quedado abierto.',
    },
    low: {
      title: 'Queda poca agua en el tanque',
      meaning: 'Si baja más, la bomba puede quedarse sin agua y las raíces se secan.',
      action: 'Rellena el tanque con solución preparada.',
    },
  },
};

export const GROUP_LABEL: Record<VariableGroup, string> = {
  aire: 'Aire',
  agua: 'Agua con nutrientes',
};

/** "Alto" o "bajo" respecto a la banda ideal (solo para elegir el texto). */
export function directionOf(value: number, t: ThresholdRange): Direction {
  if (value > t.yellowMax) return 'high';
  if (value < t.yellowMin) return 'low';
  return value >= (t.yellowMin + t.yellowMax) / 2 ? 'high' : 'low';
}

export function adviceFor(variable: HydroponicVariable, value: number, t: ThresholdRange): Advice {
  const info = VARIABLES[variable];
  return directionOf(value, t) === 'high' ? info.high : info.low;
}

/** Posiciones en % para dibujar el medidor: banda ideal y lectura. */
export function gaugeGeometry(variable: HydroponicVariable, value: number, t: ThresholdRange) {
  const info = VARIABLES[variable];
  let [min, max] = info.scale ?? [0, 0];
  if (!info.scale) {
    const span = Math.max(t.redMax - t.redMin, 1e-6);
    min = t.redMin - span * 0.15;
    max = t.redMax + span * 0.15;
  }
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  const bandStart = pct(t.yellowMin);
  const bandEnd = pct(t.yellowMax);
  return { bandLeft: bandStart, bandWidth: Math.max(bandEnd - bandStart, 1), mark: pct(value) };
}

export function formatValue(variable: HydroponicVariable, value: number): string {
  const { decimals } = VARIABLES[variable];
  return value.toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** "Ideal 5.5 a 6.5" / "Mínimo 40 %". */
export function idealText(variable: HydroponicVariable, t: ThresholdRange): string {
  const info = VARIABLES[variable];
  const u = info.unit ? ` ${info.unit}` : '';
  const f = (v: number) => v.toLocaleString('es-MX', { maximumFractionDigits: info.decimals });
  if (variable === 'tankLevel' && t.yellowMax >= 100) return `Mínimo ${f(t.yellowMin)}${u}`;
  return `Ideal ${f(t.yellowMin)} a ${f(t.yellowMax)}${u}`;
}

export const STATUS_WORD: Record<SensorStatus, string> = {
  red: 'Crítico',
  yellow: 'Atención',
  green: 'Normal',
  offline: 'Sin datos',
};

export const STATUS_CLASS: Record<SensorStatus, 'crit' | 'warn' | 'ok' | 'offline'> = {
  red: 'crit',
  yellow: 'warn',
  green: 'ok',
  offline: 'offline',
};
