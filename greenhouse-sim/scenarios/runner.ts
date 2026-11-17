/**
 * Reproductor de escenarios: dispara los comandos de un escenario cuando el
 * tiempo simulado transcurrido alcanza su `at`.
 */

import { CommandError, applyCommand, parseCommand } from '../model/commands.ts';
import type { Command, Scenario, ScenarioStep, WorldState } from '../model/types.ts';

export interface ScenarioRun {
  scenario: Scenario;
  /** Pasos ordenados por `at`. */
  steps: ScenarioStep[];
  elapsedSec: number;
  fired: boolean[];
}

export type StepListener = (command: Command, step: ScenarioStep) => void;

export function startRun(scenario: Scenario): ScenarioRun {
  const steps = [...scenario.steps].sort((a, b) => a.at - b.at);
  return { scenario, steps, elapsedSec: 0, fired: steps.map(() => false) };
}

export function runDurationSec(run: ScenarioRun): number {
  return run.steps.length > 0 ? run.steps[run.steps.length - 1].at : 0;
}

export function isRunFinished(run: ScenarioRun): boolean {
  return run.fired.every(Boolean);
}

/** Avanza el escenario `dtSec` segundos simulados y aplica lo que toque. */
export function advanceRun(
  run: ScenarioRun,
  world: WorldState,
  dtSec: number,
  onStep?: StepListener,
): void {
  run.elapsedSec += dtSec;
  run.steps.forEach((step, i) => {
    if (!run.fired[i] && step.at <= run.elapsedSec) {
      run.fired[i] = true;
      applyCommand(world, step.command);
      onStep?.(step.command, step);
    }
  });
}

/** Detiene el escenario aplicando los pasos de limpieza que faltaban. */
export function stopRun(run: ScenarioRun, world: WorldState, onStep?: StepListener): void {
  run.steps.forEach((step, i) => {
    if (run.fired[i]) return;
    run.fired[i] = true;
    if (step.cleanup) {
      applyCommand(world, step.command);
      onStep?.(step.command, step);
    }
  });
}

const CATEGORIES: Scenario['category'][] = [
  'solucion', 'equipos', 'energia', 'clima', 'red', 'sensores', 'demo', 'propio',
];

/** Valida un escenario que llega de la UI o del archivo de escenarios propios. */
export function parseScenario(raw: unknown, zoneIds: string[]): Scenario {
  if (!raw || typeof raw !== 'object') throw new CommandError('El escenario debe ser un objeto.');
  const s = raw as Record<string, unknown>;
  const name = typeof s.name === 'string' ? s.name.trim().slice(0, 80) : '';
  if (!name) throw new CommandError('El escenario necesita un nombre.');
  if (!Array.isArray(s.steps) || s.steps.length === 0) {
    throw new CommandError('El escenario necesita al menos un paso.');
  }
  if (s.steps.length > 100) throw new CommandError('Un escenario admite hasta 100 pasos.');

  const steps: ScenarioStep[] = s.steps.map((rawStep, i) => {
    const st = (rawStep ?? {}) as Record<string, unknown>;
    if (typeof st.at !== 'number' || !Number.isFinite(st.at) || st.at < 0 || st.at > 7 * 86400) {
      throw new CommandError(`Paso ${i + 1}: "at" debe ser un número de segundos entre 0 y 7 días.`);
    }
    try {
      return {
        at: st.at,
        command: parseCommand(st.command, zoneIds),
        ...(st.cleanup === true ? { cleanup: true } : {}),
      };
    } catch (err) {
      throw new CommandError(`Paso ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const speed = typeof s.suggestedSpeed === 'number' && s.suggestedSpeed > 0 ? s.suggestedSpeed : 60;

  return {
    id: typeof s.id === 'string' && /^[a-z0-9-]{1,80}$/.test(s.id) ? s.id : `propio-${slug || 'escenario'}`,
    name,
    description: typeof s.description === 'string' ? s.description.slice(0, 400) : '',
    expect: typeof s.expect === 'string' ? s.expect.slice(0, 400) : '',
    category: CATEGORIES.includes(s.category as Scenario['category'])
      ? (s.category as Scenario['category'])
      : 'propio',
    suggestedSpeed: Math.min(speed, 300),
    steps,
  };
}
