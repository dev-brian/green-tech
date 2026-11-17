/**
 * Análisis e informe de la corrida continua (soak) del simulador (T2.5 #41).
 *
 * Un "hueco" es un periodo en el que una zona no recibió una lectura aceptada
 * mayor a 1.5 × el intervalo programado; los mayores a **15 min** se marcan
 * como significativos (umbral de huecos de SPECS.md).
 *
 * Todo es puro (sin red ni archivos) para probarlo con `node --test`.
 */

export interface SoakZoneOutcome {
  zoneId: string;
  ok: boolean;
  status?: number;
  error?: string;
}

export interface SoakTickRecord {
  /** Índice del tick (0-based), en orden de ejecución. */
  index: number;
  /** Momento en que debía ejecutarse: inicio + índice × intervalo. */
  expectedAt: number;
  startedAt: number;
  finishedAt: number;
  outcomes: SoakZoneOutcome[];
}

export interface SoakGap {
  zoneId: string;
  startAt: number;
  endAt: number;
  durationMs: number;
  /** Lecturas perdidas estimadas (duración redondeada al intervalo). */
  missedTicks: number;
  /** `true` si supera el umbral de 15 min. */
  significant: boolean;
}

export interface SoakZoneStats {
  sent: number;
  ok: number;
  failed: number;
  /** ok / sent (0 si no se enviaron lecturas). */
  coverage: number;
  gaps: number;
  maxGapMs: number;
}

export interface SoakAnalysis {
  startAt: number;
  endAt: number;
  durationMs: number;
  intervalMs: number;
  gapThresholdMs: number;
  zoneIds: string[];
  ticksRun: number;
  /** Ticks que deberían haberse ejecutado en la ventana observada. */
  ticksScheduled: number;
  /** Ticks que terminaron después de su slot (más de un intervalo tarde). */
  lateTicks: number;
  totalOk: number;
  totalFailed: number;
  maxTickMs: number;
  avgTickMs: number;
  perZone: Record<string, SoakZoneStats>;
  gaps: SoakGap[];
  significantGaps: SoakGap[];
  maxGapMs: number;
}

/** Umbral de SPECS.md: un hueco significativo supera los 15 min. */
export const DEFAULT_GAP_THRESHOLD_MS = 15 * 60 * 1000;

export interface AnalyzeSoakInput {
  ticks: readonly SoakTickRecord[];
  zoneIds: readonly string[];
  startAt: number;
  endAt: number;
  intervalMs: number;
  gapThresholdMs?: number;
}

function buildGap(
  zoneId: string,
  startAt: number,
  endAt: number,
  intervalMs: number,
  gapThresholdMs: number,
): SoakGap {
  const durationMs = endAt - startAt;
  return {
    zoneId,
    startAt,
    endAt,
    durationMs,
    missedTicks: Math.max(0, Math.round(durationMs / intervalMs) - 1),
    significant: durationMs > gapThresholdMs,
  };
}

/**
 * Calcula métricas y huecos de una corrida. Los ticks deben venir en orden
 * cronológico; las lecturas exitosas se registran al terminar cada tick.
 */
export function analyzeSoak(input: AnalyzeSoakInput): SoakAnalysis {
  const { ticks, zoneIds, startAt, endAt, intervalMs } = input;
  const gapThresholdMs = input.gapThresholdMs ?? DEFAULT_GAP_THRESHOLD_MS;
  // Un periodo sin lecturas sólo es hueco si supera 1.5 × el intervalo
  // (tolerancia para el jitter normal de un tick).
  const minGapMs = intervalMs * 1.5;

  const perZone: Record<string, SoakZoneStats> = {};
  for (const zoneId of zoneIds) {
    perZone[zoneId] = { sent: 0, ok: 0, failed: 0, coverage: 0, gaps: 0, maxGapMs: 0 };
  }

  let totalOk = 0;
  let totalFailed = 0;
  let lateTicks = 0;
  let maxTickMs = 0;
  let tickMsSum = 0;

  for (const tick of ticks) {
    const duration = tick.finishedAt - tick.startedAt;
    tickMsSum += duration;
    if (duration > maxTickMs) maxTickMs = duration;
    if (tick.finishedAt > tick.expectedAt + intervalMs) lateTicks++;

    for (const outcome of tick.outcomes) {
      const stats = perZone[outcome.zoneId];
      if (!stats) continue; // zona fuera del plan: se ignora
      stats.sent++;
      if (outcome.ok) {
        stats.ok++;
        totalOk++;
      } else {
        stats.failed++;
        totalFailed++;
      }
    }
  }

  // Huecos por zona: periodos sin lectura aceptada > 1.5 × intervalo.
  // Cubren por igual fallos de ingesta, caídas del proceso y retrasos.
  const gaps: SoakGap[] = [];
  for (const zoneId of zoneIds) {
    const successTimes: number[] = [];
    for (const tick of ticks) {
      const outcome = tick.outcomes.find((o) => o.zoneId === zoneId);
      if (outcome?.ok) successTimes.push(tick.finishedAt);
    }

    let prev = startAt;
    for (const at of [...successTimes, endAt]) {
      if (at - prev > minGapMs) {
        gaps.push(buildGap(zoneId, prev, at, intervalMs, gapThresholdMs));
      }
      prev = at;
    }

    const stats = perZone[zoneId];
    const zoneGaps = gaps.filter((g) => g.zoneId === zoneId);
    stats.gaps = zoneGaps.length;
    stats.maxGapMs = zoneGaps.reduce((max, g) => Math.max(max, g.durationMs), 0);
    stats.coverage = stats.sent > 0 ? stats.ok / stats.sent : 0;
  }

  gaps.sort((a, b) => a.startAt - b.startAt);

  return {
    startAt,
    endAt,
    durationMs: endAt - startAt,
    intervalMs,
    gapThresholdMs,
    zoneIds: [...zoneIds],
    ticksRun: ticks.length,
    ticksScheduled: Math.max(ticks.length, Math.floor((endAt - startAt) / intervalMs) + 1),
    lateTicks,
    totalOk,
    totalFailed,
    maxTickMs,
    avgTickMs: ticks.length > 0 ? Math.round(tickMsSum / ticks.length) : 0,
    perZone,
    gaps,
    significantGaps: gaps.filter((g) => g.significant),
    maxGapMs: gaps.reduce((max, g) => Math.max(max, g.durationMs), 0),
  };
}

// ─── Informe Markdown ─────────────────────────────────────────────────────────

export interface SoakReportMeta {
  status: 'completado' | 'interrumpido' | 'en curso';
  scenario: string;
  intervalSec: number;
  ticksPlanned: number;
  command: string;
  environment: string;
  notes?: string[];
}

function fmtDate(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}

function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)} %`;
}

const DEFAULT_NOTES = [
  'Corrida local contra el servidor de ingesta embebido (almacenamiento en ' +
    'memoria): cubre el motor del simulador, la validación de la ingesta y el ' +
    'motor de alertas, pero no fallos de Firestore ni de red externa.',
  'Un hueco es un periodo > 1.5 × el intervalo sin lectura aceptada en una ' +
    'zona; los mayores a 15 min se marcan como significativos (SPECS.md).',
  'Los ticks "tardíos" son los que terminaron después de su slot programado ' +
    '(más de un intervalo tarde): indican que la corrida no mantuvo la cadencia.',
];

/** Construye el informe Markdown que se guarda como evidencia de la corrida. */
export function buildSoakReport(a: SoakAnalysis, meta: SoakReportMeta): string {
  const criterionOk =
    meta.status === 'completado' &&
    a.ticksRun > 0 &&
    a.zoneIds.every((z) => a.perZone[z].coverage === 1 && a.perZone[z].gaps === 0);

  const totalSent = a.totalOk + a.totalFailed;
  const coverage = totalSent > 0 ? a.totalOk / totalSent : 0;

  const lines: string[] = [];
  lines.push('# Informe de corrida continua (soak) del simulador');
  lines.push('');
  lines.push(
    'Generado por `pnpm sim:soak` (T2.5 #41 de HU-02). Este archivo se ' +
      'sobrescribe en cada corrida.',
  );
  lines.push('');
  lines.push('## Datos de la corrida');
  lines.push('');
  lines.push('| Campo | Valor |');
  lines.push('| --- | --- |');
  lines.push(`| Estado | **${meta.status}** |`);
  lines.push(`| Inicio | ${fmtDate(a.startAt)} |`);
  lines.push(`| Fin | ${fmtDate(a.endAt)} |`);
  lines.push(`| Duración | ${fmtDuration(a.durationMs)} |`);
  lines.push(`| Cadencia | 1 tick / ${meta.intervalSec} s (3 zonas c/u) |`);
  lines.push(`| Ticks planeados / ejecutados | ${meta.ticksPlanned} / ${a.ticksRun} |`);
  lines.push(`| Escenario | ${meta.scenario} |`);
  lines.push(`| Entorno | ${meta.environment} |`);
  lines.push(`| Comando | \`${meta.command}\` |`);
  lines.push('');
  lines.push('## Resumen');
  lines.push('');
  lines.push('| Métrica | Valor |');
  lines.push('| --- | --- |');
  lines.push(`| Ingestas exitosas | ${a.totalOk} de ${totalSent} (${fmtPct(coverage)}) |`);
  lines.push(`| Ingestas fallidas | ${a.totalFailed} |`);
  lines.push(`| Ticks tardíos (fuera de su slot) | ${a.lateTicks} |`);
  lines.push(
    `| Duración del tick (máx / promedio) | ${fmtDuration(a.maxTickMs)} / ${fmtDuration(a.avgTickMs)} |`,
  );
  lines.push(`| Huecos detectados | ${a.gaps.length} |`);
  lines.push(`| Huecos > 15 min (significativos) | ${a.significantGaps.length} |`);
  lines.push(`| Mayor hueco | ${fmtDuration(a.maxGapMs)} |`);
  lines.push('');
  lines.push('## Por zona');
  lines.push('');
  lines.push('| Zona | Enviadas | OK | Fallidas | Cobertura | Huecos | Mayor hueco |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const zoneId of a.zoneIds) {
    const s = a.perZone[zoneId];
    lines.push(
      `| ${zoneId} | ${s.sent} | ${s.ok} | ${s.failed} | ${fmtPct(s.coverage)} | ${s.gaps} | ${fmtDuration(s.maxGapMs)} |`,
    );
  }
  lines.push('');
  lines.push('## Huecos detectados');
  lines.push('');
  if (a.gaps.length === 0) {
    lines.push(
      '_Sin huecos: cada zona recibió una lectura aceptada en cada tick de la corrida._',
    );
  } else {
    lines.push('| # | Zona | Inicio | Fin | Duración | Lecturas perdidas | > 15 min |');
    lines.push('| ---: | --- | --- | --- | ---: | ---: | --- |');
    a.gaps.forEach((g, i) => {
      lines.push(
        `| ${i + 1} | ${g.zoneId} | ${fmtDate(g.startAt)} | ${fmtDate(g.endAt)} | ${fmtDuration(g.durationMs)} | ${g.missedTicks} | ${g.significant ? 'sí' : 'no'} |`,
      );
    });
  }
  lines.push('');
  lines.push('## Criterio de HU-02 relacionado');
  lines.push('');
  lines.push(
    criterionOk
      ? '- [x] Dadas 3 zonas, mientras el simulador corre, cada una recibe las 7 variables cada minuto.'
      : '- [ ] Dadas 3 zonas, mientras el simulador corre, cada una recibe las 7 variables cada minuto. **No cumplido en esta corrida**: ver tablas anteriores.',
  );
  lines.push('');
  lines.push('## Notas');
  lines.push('');
  for (const note of [...DEFAULT_NOTES, ...(meta.notes ?? [])]) {
    lines.push(`- ${note}`);
  }
  lines.push('');
  return lines.join('\n');
}
