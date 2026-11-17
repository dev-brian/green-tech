import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeSoak,
  buildSoakReport,
  DEFAULT_GAP_THRESHOLD_MS,
  type SoakTickRecord,
} from '../simulator/core/soakReport.ts';

/**
 * T2.5 (#41) — Corrida continua (soak) y registro de huecos (HU-02).
 *
 * Un hueco es un periodo > 1.5 × el intervalo sin lectura aceptada en una
 * zona; los mayores a 15 min se marcan como significativos (SPECS.md).
 */

const INTERVAL_MS = 60_000;
const ZONES = ['zona-1', 'zona-2', 'zona-3'];

/** Crea un tick con una salida por zona. */
function makeTick(
  index: number,
  startAt: number,
  outcomes: { zoneId: string; ok: boolean }[],
): SoakTickRecord {
  return {
    index,
    expectedAt: startAt + index * INTERVAL_MS,
    startedAt: startAt + index * INTERVAL_MS,
    finishedAt: startAt + index * INTERVAL_MS + 120,
    outcomes: outcomes.map((o) => ({ ...o, status: o.ok ? 200 : 500 })),
  };
}

/** `count` ticks consecutivos donde todas las zonas responden OK. */
function healthyTicks(count: number, startAt: number): SoakTickRecord[] {
  return Array.from({ length: count }, (_, i) =>
    makeTick(
      i,
      startAt,
      ZONES.map((zoneId) => ({ zoneId, ok: true })),
    ),
  );
}

describe('analyzeSoak (HU-02, T2.5)', () => {
  const startAt = Date.parse('2026-11-15T00:00:00Z');

  it('sin huecos cuando cada zona responde en cada tick', () => {
    const ticks = healthyTicks(60, startAt);
    const analysis = analyzeSoak({
      ticks,
      zoneIds: ZONES,
      startAt,
      endAt: startAt + 60 * INTERVAL_MS,
      intervalMs: INTERVAL_MS,
    });

    assert.equal(analysis.ticksRun, 60);
    assert.equal(analysis.totalOk, 60 * 3);
    assert.equal(analysis.totalFailed, 0);
    assert.equal(analysis.gaps.length, 0);
    assert.equal(analysis.significantGaps.length, 0);
    for (const zoneId of ZONES) {
      assert.equal(analysis.perZone[zoneId].coverage, 1);
      assert.equal(analysis.perZone[zoneId].gaps, 0);
    }
  });

  it('detecta un hueco cuando una zona deja de responder', () => {
    // 10 ticks sanos, luego 10 ticks donde zona-2 falla, luego 10 sanos.
    const ticks: SoakTickRecord[] = [];
    for (let i = 0; i < 30; i++) {
      const failing = i >= 10 && i < 20;
      ticks.push(
        makeTick(
          i,
          startAt,
          ZONES.map((zoneId) => ({ zoneId, ok: !(failing && zoneId === 'zona-2') })),
        ),
      );
    }
    const analysis = analyzeSoak({
      ticks,
      zoneIds: ZONES,
      startAt,
      endAt: startAt + 30 * INTERVAL_MS,
      intervalMs: INTERVAL_MS,
    });

    const zone2Gaps = analysis.gaps.filter((g) => g.zoneId === 'zona-2');
    assert.equal(zone2Gaps.length, 1);
    // El hueco va de la última lectura aceptada (tick 9) a la siguiente (tick 20).
    assert.equal(zone2Gaps[0].startAt, startAt + 9 * INTERVAL_MS + 120);
    assert.equal(zone2Gaps[0].endAt, startAt + 20 * INTERVAL_MS + 120);
    assert.equal(zone2Gaps[0].durationMs, 11 * INTERVAL_MS);
    // 11 minutos: no supera los 15 min → no significativo.
    assert.equal(zone2Gaps[0].significant, false);
    assert.equal(analysis.significantGaps.length, 0);

    // Las otras zonas no tienen huecos.
    assert.equal(analysis.gaps.filter((g) => g.zoneId !== 'zona-2').length, 0);
    assert.equal(analysis.perZone['zona-2'].failed, 10);
    assert.equal(analysis.perZone['zona-1'].coverage, 1);
  });

  it('marca como significativo un hueco mayor a 15 min', () => {
    const ticks: SoakTickRecord[] = [];
    // 5 sanos, 20 fallando en zona-1 (20 min), 5 sanos.
    for (let i = 0; i < 30; i++) {
      const failing = i >= 5 && i < 25;
      ticks.push(
        makeTick(
          i,
          startAt,
          ZONES.map((zoneId) => ({ zoneId, ok: !(failing && zoneId === 'zona-1') })),
        ),
      );
    }
    const analysis = analyzeSoak({
      ticks,
      zoneIds: ZONES,
      startAt,
      endAt: startAt + 30 * INTERVAL_MS,
      intervalMs: INTERVAL_MS,
    });

    assert.equal(analysis.significantGaps.length, 1);
    const gap = analysis.significantGaps[0];
    assert.equal(gap.zoneId, 'zona-1');
    // De la última aceptada (tick 4) a la siguiente aceptada (tick 25): 21 min.
    assert.equal(gap.durationMs, 21 * INTERVAL_MS);
    assert.ok(gap.durationMs > DEFAULT_GAP_THRESHOLD_MS);
    assert.equal(analysis.maxGapMs, 21 * INTERVAL_MS);
  });

  it('un tick perdido abre un hueco corto (no significativo) por zona', () => {
    // Un solo tick falla en todas las zonas: falta una lectura, así que es
    // un hueco de 2 × intervalo (2 min), pero no significativo (< 15 min).
    const ticks = healthyTicks(10, startAt).map((t, i) =>
      i === 5
        ? makeTick(
            i,
            startAt,
            ZONES.map((zoneId) => ({ zoneId, ok: false })),
          )
        : t,
    );
    const analysis = analyzeSoak({
      ticks,
      zoneIds: ZONES,
      startAt,
      endAt: startAt + 10 * INTERVAL_MS,
      intervalMs: INTERVAL_MS,
    });

    assert.equal(analysis.totalFailed, 3);
    assert.equal(analysis.gaps.length, 3); // una por zona
    assert.equal(analysis.significantGaps.length, 0);
    for (const gap of analysis.gaps) {
      assert.equal(gap.durationMs, 2 * INTERVAL_MS);
      assert.equal(gap.significant, false);
    }
    assert.equal(analysis.perZone['zona-1'].coverage, 0.9);
  });

  it('tolera el jitter: lecturas con retraso menor al intervalo no son hueco', () => {
    // Todos los ticks terminan tarde pero consecutivamente (60 s de retraso
    // constante): la distancia entre lecturas aceptadas sigue siendo el
    // intervalo → sin huecos.
    const ticks = healthyTicks(10, startAt).map((t) => ({
      ...t,
      startedAt: t.startedAt + 30_000,
      finishedAt: t.finishedAt + 60_000,
    }));
    const analysis = analyzeSoak({
      ticks,
      zoneIds: ZONES,
      startAt,
      endAt: startAt + 10 * INTERVAL_MS,
      intervalMs: INTERVAL_MS,
    });
    assert.equal(analysis.gaps.length, 0);
    assert.equal(analysis.totalOk, 30);
  });

  it('registra ticks tardíos cuando la corrida pierde la cadencia', () => {
    const ticks = healthyTicks(5, startAt).map((t) => ({
      ...t,
      finishedAt: t.finishedAt + 2 * INTERVAL_MS,
    }));
    const analysis = analyzeSoak({
      ticks,
      zoneIds: ZONES,
      startAt,
      endAt: startAt + 5 * INTERVAL_MS,
      intervalMs: INTERVAL_MS,
    });
    assert.equal(analysis.lateTicks, 5);
  });
});

describe('buildSoakReport', () => {
  const startAt = Date.parse('2026-11-15T00:00:00Z');

  const baseMeta = {
    status: 'completado' as const,
    scenario: 'normal',
    intervalSec: 60,
    ticksPlanned: 60,
    command: 'pnpm sim:soak --hours=1',
    environment: 'prueba',
  };

  it('marca el criterio de HU-02 como cumplido en una corrida sana', () => {
    const analysis = analyzeSoak({
      ticks: healthyTicks(60, startAt),
      zoneIds: ZONES,
      startAt,
      endAt: startAt + 60 * INTERVAL_MS,
      intervalMs: INTERVAL_MS,
    });
    const md = buildSoakReport(analysis, baseMeta);

    assert.match(md, /# Informe de corrida continua \(soak\) del simulador/);
    assert.match(md, /\| Estado \| \*\*completado\*\* \|/);
    assert.match(
      md,
      /- \[x\] Dadas 3 zonas, mientras el simulador corre, cada una recibe las 7 variables cada minuto\./,
    );
    assert.match(md, /_Sin huecos:/);
    assert.match(md, /\| zona-1 \| 60 \| 60 \| 0 \| 100\.0 % \| 0 \|/);
  });

  it('deja el criterio sin marcar y lista los huecos cuando la corrida falla', () => {
    const ticks: SoakTickRecord[] = [];
    for (let i = 0; i < 30; i++) {
      const failing = i >= 5 && i < 25;
      ticks.push(
        makeTick(
          i,
          startAt,
          ZONES.map((zoneId) => ({ zoneId, ok: !(failing && zoneId === 'zona-3') })),
        ),
      );
    }
    const analysis = analyzeSoak({
      ticks,
      zoneIds: ZONES,
      startAt,
      endAt: startAt + 30 * INTERVAL_MS,
      intervalMs: INTERVAL_MS,
    });
    const md = buildSoakReport(analysis, baseMeta);

    assert.match(
      md,
      /- \[ \] Dadas 3 zonas.*\*\*No cumplido en esta corrida\*\*/,
    );
    assert.match(md, /\| 1 \| zona-3 \| .* \| 21 min 0 s \|/);
    assert.match(md, /sí \|/); // hueco significativo listado
  });

  it('refleja el estado interrumpido en el informe parcial', () => {
    const analysis = analyzeSoak({
      ticks: healthyTicks(3, startAt),
      zoneIds: ZONES,
      startAt,
      endAt: startAt + 3 * INTERVAL_MS,
      intervalMs: INTERVAL_MS,
    });
    const md = buildSoakReport(analysis, {
      ...baseMeta,
      status: 'interrumpido',
    });
    assert.match(md, /\| Estado \| \*\*interrumpido\*\* \|/);
    assert.match(md, /- \[ \] Dadas 3 zonas/);
  });
});
