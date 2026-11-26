/**
 * Recorrido guiado para usuarios nuevos.
 *
 * La primera vez que alguien entra al tablero se le muestra, paso a paso,
 * dónde está cada cosa y para qué sirve. Se puede volver a ver con el botón
 * de ayuda (signo de interrogación) de la barra o desde el menú en celular.
 *
 * Cada paso apunta a un elemento marcado con `data-tour="..."`. Si ese
 * elemento no está en pantalla (por ejemplo, el menú de escritorio en un
 * celular, o "Qué hacer ahora" cuando todo está bien), el paso se salta.
 *
 * Módulo puro (sin React ni Firebase) para probarlo con `node --test`.
 */

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** Selectores en orden de preferencia; se usa el primero que esté visible. Sin selectores, la tarjeta va al centro. */
  targets?: readonly string[];
  /** Solo para el admin. */
  adminOnly?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'bienvenida',
    title: 'Bienvenido a GreenTech',
    body: 'Te mostramos en un minuto dónde está cada cosa. Puedes salir cuando quieras y volver a verlo con el botón de ayuda.',
  },
  {
    id: 'estado',
    title: 'Cómo está tu invernadero',
    body: 'Aquí ves de un vistazo si todo está en orden. El dibujo pinta cada zona de verde, amarillo o rojo según sus lecturas; gris si dejaron de llegar datos.',
    targets: ['[data-tour="estado"]'],
  },
  {
    id: 'hacer',
    title: 'Qué hacer ahora',
    body: 'Cuando algo sale de rango aparece una tarjeta con lo que significa, lo que hace el sistema por su cuenta y lo que te toca hacer a ti.',
    targets: ['[data-tour="hacer"]'],
  },
  {
    id: 'zonas',
    title: 'Tus zonas',
    body: 'Cada tarjeta es una zona de cultivo. Tócala para ver sus siete lecturas abajo.',
    targets: ['[data-tour="zonas"]'],
  },
  {
    id: 'lecturas',
    title: 'Lecturas de la zona',
    body: 'Temperatura, humedad, luz, pH, nutrientes, temperatura del agua y nivel del tanque. La barra verde es el rango ideal y el círculo es la lectura de ahora.',
    targets: ['[data-tour="lecturas"]'],
  },
  {
    id: 'nav-alertas',
    title: 'Alertas',
    body: 'La lista de avisos cuando algo sale de rango. Desde aquí los marcas como atendidos. El número rojo dice cuántos faltan por atender.',
    targets: ['[data-tour="nav-/alerts"]'],
  },
  {
    id: 'nav-historico',
    title: 'Histórico',
    body: 'Cómo han cambiado las lecturas de una zona con el tiempo.',
    targets: ['[data-tour="nav-/history"]'],
  },
  {
    id: 'nav-equipos',
    title: 'Equipos',
    body: 'Qué está encendido en cada zona: riego, ventilación, luces y bombas. El sistema los prende y apaga solo; aquí solo se consultan.',
    targets: ['[data-tour="nav-/control"]'],
  },
  {
    id: 'nav-zonas',
    title: 'Zonas',
    body: 'Las mesas o sistemas del invernadero y qué se siembra en cada una.',
    targets: ['[data-tour="nav-/zones"]'],
  },
  {
    id: 'nav-cultivos',
    title: 'Cultivos',
    body: 'Los perfiles de cada cultivo con sus rangos ideales. Solo el admin entra aquí.',
    targets: ['[data-tour="nav-/plants"]'],
    adminOnly: true,
  },
  {
    // En celular y laptop el menú de arriba se esconde detrás de este botón.
    id: 'menu-movil',
    title: 'El menú',
    body: 'Aquí están Alertas (los avisos por atender), Histórico, Equipos (qué está encendido), Zonas y, si eres admin, Cultivos. También el cambio a modo claro u oscuro.',
    targets: ['#mobile-menu-toggle'],
  },
  {
    id: 'invernadero',
    title: 'Tu invernadero',
    body: 'Si tienes más de uno, cámbialo aquí. También desde aquí se configura, se crea uno nuevo o te unes con un código.',
    targets: ['#workspace-selector-btn'],
  },
  {
    id: 'tema',
    title: 'Modo claro u oscuro',
    body: 'Cambia los colores de la pantalla. El modo oscuro cansa menos la vista de noche.',
    targets: ['[data-tour="tema"]'],
  },
  {
    id: 'ayuda',
    title: 'Volver a ver este recorrido',
    body: 'Cuando quieras repasarlo, usa este botón.',
    targets: ['[data-tour="ayuda"]', '#mobile-menu-toggle'],
  },
];

/** Pasos que le tocan a un rol (el resto se decide al ver qué hay en pantalla). */
export function stepsForRole(isAdmin: boolean, steps: readonly TourStep[] = TOUR_STEPS): TourStep[] {
  return steps.filter((s) => isAdmin || !s.adminOnly);
}

/**
 * Índice del siguiente paso que se puede mostrar a partir de `from`, avanzando
 * en `dir` (1 o -1). Un paso sin `targets` siempre se puede mostrar; uno con
 * `targets` solo si alguno está visible. Devuelve -1 si ya no hay más.
 */
export function nextShowableIndex(
  steps: readonly TourStep[],
  from: number,
  dir: 1 | -1,
  isVisible: (selector: string) => boolean,
): number {
  for (let i = from; i >= 0 && i < steps.length; i += dir) {
    const t = steps[i].targets;
    if (!t || t.length === 0 || t.some(isVisible)) return i;
  }
  return -1;
}

/** Primer selector visible del paso, o null para la tarjeta centrada. */
export function resolveTarget(step: TourStep, isVisible: (selector: string) => boolean): string | null {
  return step.targets?.find(isVisible) ?? null;
}

// ─── Visto / no visto ─────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'gt-tour-visto:v1:';

export function tourStorageKey(uid: string): string {
  return `${STORAGE_PREFIX}${uid}`;
}

/** localStorage puede faltar o lanzar (ventana privada, sitio bloqueado): en ese caso se trata como ya visto para no insistir. */
export function hasSeenTour(storage: Pick<Storage, 'getItem'> | undefined, uid: string): boolean {
  try {
    return !storage || storage.getItem(tourStorageKey(uid)) === '1';
  } catch {
    return true;
  }
}

export function markTourSeen(storage: Pick<Storage, 'setItem'> | undefined, uid: string): void {
  try {
    storage?.setItem(tourStorageKey(uid), '1');
  } catch {
    /* sin almacenamiento: el recorrido volverá a salir, no pasa nada */
  }
}

// ─── Abrirlo desde cualquier botón ────────────────────────────────────────────

export const TOUR_START_EVENT = 'gt:tour-start';

export function requestTourStart(): void {
  window.dispatchEvent(new Event(TOUR_START_EVENT));
}
