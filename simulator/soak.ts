/**
 * Corrida continua (soak) del simulador para registrar huecos (T2.5 #41).
 *
 * Ejecuta el motor del simulador contra el servidor de ingesta embebido
 * (almacenamiento en memoria) con la misma cadencia real: 3 zonas × 7
 * variables por tick, por defecto 1 tick cada 60 s durante 24 h. Cada tick
 * queda registrado y el informe se reescribe en cada uno, de modo que un
 * corte del proceso no pierde la evidencia parcial.
 *
 * Uso:
 *   pnpm sim:soak                                  # 24 h, 1 tick / 60 s
 *   pnpm sim:soak --hours=1 --interval=30           # corrida más corta
 *   pnpm sim:soak --ticks=5 --interval=2 --out=/tmp/muestra.md
 *
 * Opciones: --hours, --interval (segundos), --ticks (tope fijo de ticks),
 * --out (ruta del informe), --scenario, --greenhouseId, --deviceKey.
 *
 * Nota: en Node < 23.6 el type stripping va en `scripts/soak.mjs` (lo lanza
 * `pnpm sim:soak`); este archivo no carga Firestore ni Firebase Admin.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { createIngestHttpServer } from './server.ts';
import {
  DEFAULT_SIMULATED_ZONES,
  createInitialReadings,
  stepZoneReadings,
  type SimulatorScenario,
} from './core/simulatorEngine.ts';
import type { HydroponicReadings } from './core/hydroponicModel.ts';
import type { ZoneActuatorsState } from './core/alertAndActuatorEngine.ts';
import {
  analyzeSoak,
  buildSoakReport,
  type SoakTickRecord,
  type SoakZoneOutcome,
} from './core/soakReport.ts';

const VALID_SCENARIOS = new Set<SimulatorScenario>([
  'normal',
  'ph-alto',
  'ec-baja',
  'tanque-bajo',
  'solucion-caliente',
  'ola-de-calor',
]);

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const map: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eqIdx = arg.indexOf('=');
    if (eqIdx >= 0) {
      map[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        map[arg.slice(2)] = next;
        i++;
      } else {
        map[arg.slice(2)] = true;
      }
    }
  }
  return map;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSoak(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const intervalSec = Math.max(1, Number(args.interval ?? 60));
  const intervalMs = intervalSec * 1000;
  const hours = Number(args.hours ?? 24);
  const ticksPlanned = Math.max(
    1,
    args.ticks !== undefined
      ? Number(args.ticks)
      : Math.round((hours * 3600) / intervalSec),
  );
  const outPath = String(args.out ?? 'docs/informe-soak-24h.md');
  const rawScenario = String(args.scenario ?? 'normal') as SimulatorScenario;
  const scenario: SimulatorScenario = VALID_SCENARIOS.has(rawScenario)
    ? rawScenario
    : 'normal';
  const greenhouseId = String(
    args.greenhouseId ?? process.env.GREENHOUSE_ID ?? 'demo-greenhouse',
  );
  const deviceKey = String(
    args.deviceKey ?? process.env.DEVICE_INGEST_KEY ?? 'gt-dev-device-key-2026',
  );

  // Servidor de ingesta embebido: mismos endpoints que el backend, en memoria.
  const { server } = createIngestHttpServer({ deviceKey });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const zoneReadings: Record<string, HydroponicReadings> = {};
  for (const zone of DEFAULT_SIMULATED_ZONES) {
    zoneReadings[zone.zoneId] = createInitialReadings(zone.crop);
  }

  const zoneIds = DEFAULT_SIMULATED_ZONES.map((z) => z.zoneId);
  const ticks: SoakTickRecord[] = [];
  const startAt = Date.now();
  let status: 'completado' | 'interrumpido' = 'completado';
  let okCount = 0;
  let failCount = 0;

  const command = `pnpm sim:soak --hours=${hours} --interval=${intervalSec}${
    args.ticks !== undefined ? ` --ticks=${args.ticks}` : ''
  }${args.out !== undefined ? ` --out=${args.out}` : ''}`;

  const writeReport = (final: boolean): void => {
    const analysis = analyzeSoak({
      ticks,
      zoneIds,
      startAt,
      endAt: Date.now(),
      intervalMs,
    });
    const md = buildSoakReport(analysis, {
      status: final ? status : 'en curso',
      scenario,
      intervalSec,
      ticksPlanned,
      command,
      environment: 'Servidor de ingesta embebido (memoria), 3 zonas, una PWA por proceso',
    });
    try {
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, md, 'utf8');
    } catch (err) {
      console.error('[Soak] No se pudo escribir el informe:', err);
    }
  };

  const executeTick = async (): Promise<SoakZoneOutcome[]> => {
    const outcomes: SoakZoneOutcome[] = [];
    const timestamp = new Date().toISOString();
    for (const zone of DEFAULT_SIMULATED_ZONES) {
      try {
        const actuatorsRes = await fetch(
          `${baseUrl}/actuatorsState?greenhouseId=${encodeURIComponent(greenhouseId)}&zoneId=${encodeURIComponent(zone.zoneId)}`,
        );
        const actuators = actuatorsRes.ok
          ? ((await actuatorsRes.json()) as ZoneActuatorsState)
          : undefined;

        const nextReading = stepZoneReadings(zoneReadings[zone.zoneId], zone.crop, {
          scenario,
          actuators,
        });
        zoneReadings[zone.zoneId] = nextReading;

        const res = await fetch(`${baseUrl}/ingestTelemetry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-device-key': deviceKey },
          body: JSON.stringify({
            greenhouseId,
            zoneId: zone.zoneId,
            crop: zone.crop,
            timestamp,
            readings: nextReading,
          }),
        });
        if (res.ok) {
          outcomes.push({ zoneId: zone.zoneId, ok: true, status: res.status });
        } else {
          const text = await res.text();
          outcomes.push({
            zoneId: zone.zoneId,
            ok: false,
            status: res.status,
            error: text.slice(0, 300),
          });
        }
      } catch (err) {
        outcomes.push({
          zoneId: zone.zoneId,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return outcomes;
  };

  const closeAndExit = (code: number): void => {
    // Las conexiones keep-alive de fetch mantienen abierto el servidor:
    // se cierran antes para no esperar al timeout de fuerza.
    server.closeAllConnections?.();
    server.close(() => process.exit(code));
    setTimeout(() => process.exit(code), 2000).unref();
  };

  const onSignal = (signal: NodeJS.Signals): void => {
    status = 'interrumpido';
    writeReport(true);
    console.log(`\n[Soak] Interrumpido por ${signal}. Informe parcial: ${outPath}`);
    closeAndExit(0);
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  const ticksPerHour = Math.max(1, Math.round(3600 / intervalSec));
  console.log(
    `[Soak] Iniciando ${ticksPlanned} ticks cada ${intervalSec}s ` +
      `(${(ticksPlanned * intervalSec) / 3600} h) · escenario=${scenario} · informe=${outPath}`,
  );

  for (let i = 0; i < ticksPlanned; i++) {
    const expectedAt = startAt + i * intervalMs;
    const waitMs = expectedAt - Date.now();
    if (waitMs > 0) await sleep(waitMs);

    const startedAt = Date.now();
    const outcomes = await executeTick();
    const finishedAt = Date.now();
    for (const o of outcomes) {
      if (o.ok) okCount++;
      else failCount++;
    }
    ticks.push({ index: i, expectedAt, startedAt, finishedAt, outcomes });

    // Informe incremental: la evidencia sobrevive a un corte del proceso.
    writeReport(false);

    if ((i + 1) % ticksPerHour === 0 || i + 1 === ticksPlanned) {
      const hour = ((i + 1) * intervalSec) / 3600;
      console.log(
        `[Soak] ${hour.toFixed(1)} h / ${((ticksPlanned * intervalSec) / 3600).toFixed(1)} h` +
          ` · ticks=${i + 1} · ok=${okCount} · fallos=${failCount}`,
      );
    }
  }

  writeReport(true);
  const analysis = analyzeSoak({ ticks, zoneIds, startAt, endAt: Date.now(), intervalMs });
  console.log(
    `[Soak] Completado: ${analysis.ticksRun} ticks · ` +
      `${analysis.totalOk}/${analysis.totalOk + analysis.totalFailed} ingesta OK · ` +
      `${analysis.gaps.length} huecos (${analysis.significantGaps.length} > 15 min).`,
  );
  console.log(`[Soak] Informe: ${outPath}`);
  closeAndExit(analysis.totalFailed > 0 ? 1 : 0);
}

// pathToFileURL resuelve bien en Windows (cli.ts compara a mano y falla con
// rutas relativas o separadores `\`).
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runSoak().catch((err) => {
    console.error('[Soak] Fallo fatal:', err);
    process.exit(1);
  });
}
