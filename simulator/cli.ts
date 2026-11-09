/**
 * Programa simulador independiente en Node (HU-02: T2.2 #38, T2.3 #39, T8.3 #69).
 * No accede directamente a Firestore: envía lecturas de las 7 variables para 3 zonas
 * únicamente por HTTP POST /ingestTelemetry con cabecera x-device-key, y consulta
 * el estado de actuadores vía GET /actuatorsState para cerrar el lazo de control.
 *
 * Uso:
 *   node simulator/cli.ts --once
 *   node simulator/cli.ts --scenario=ph-alto --once
 *   node simulator/cli.ts --scenario=ec-baja --interval=60
 */

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

const VALID_SCENARIOS = new Set<SimulatorScenario>([
  'normal',
  'ph-alto',
  'ec-baja',
  'tanque-bajo',
  'solucion-caliente',
  'ola-de-calor',
]);

function parseArgs(argv: string[]) {
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

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
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
  const intervalSec = Math.max(1, Number(args.interval ?? 60));
  const once = Boolean(args.once);

  let baseUrl = typeof args.ingestUrl === 'string' ? args.ingestUrl : process.env.INGEST_URL;
  let embeddedServer: ReturnType<typeof createIngestHttpServer>['server'] | null = null;

  if (!baseUrl) {
    const { server } = createIngestHttpServer({ deviceKey });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    embeddedServer = server;
  }

  const zoneReadings: Record<string, HydroponicReadings> = {};
  for (const zone of DEFAULT_SIMULATED_ZONES) {
    zoneReadings[zone.zoneId] = createInitialReadings(zone.crop);
  }

  const executeTick = async () => {
    const nowIso = new Date().toISOString();
    for (const zone of DEFAULT_SIMULATED_ZONES) {
      // 1. Consultar estado actual de actuadores (lazo cerrado T8.3)
      const actuatorsRes = await fetch(
        `${baseUrl}/actuatorsState?greenhouseId=${encodeURIComponent(greenhouseId)}&zoneId=${encodeURIComponent(zone.zoneId)}`,
      );
      const actuators = actuatorsRes.ok
        ? ((await actuatorsRes.json()) as ZoneActuatorsState)
        : undefined;

      // 2. Calcular siguiente lectura con deriva y escenario
      const nextReading = stepZoneReadings(zoneReadings[zone.zoneId], zone.crop, {
        scenario,
        actuators,
      });
      zoneReadings[zone.zoneId] = nextReading;

      // 3. Enviar a POST /ingestTelemetry con x-device-key (T2.1 / T2.2)
      const ingestRes = await fetch(`${baseUrl}/ingestTelemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-key': deviceKey,
        },
        body: JSON.stringify({
          greenhouseId,
          zoneId: zone.zoneId,
          crop: zone.crop,
          timestamp: nowIso,
          readings: nextReading,
        }),
      });

      if (!ingestRes.ok) {
        const errBody = await ingestRes.text();
        throw new Error(`Error en ingestTelemetry (${ingestRes.status}): ${errBody}`);
      }

      const summary = (await ingestRes.json()) as {
        readingId: string;
        createdAlertsCount: number;
        resolvedAlertsCount: number;
      };
      console.log(
        `[Simulador] ${zone.zoneId} (${zone.crop}) | escenario=${scenario} | pH=${nextReading.ph} EC=${nextReading.ec} Temp=${nextReading.airTemp}°C Tanque=${nextReading.tankLevel}% | alertasNuevas=${summary.createdAlertsCount} resueltas=${summary.resolvedAlertsCount}`,
      );
    }
  };

  await executeTick();

  if (once) {
    if (embeddedServer) {
      await new Promise<void>((resolve) => embeddedServer!.close(() => resolve()));
    }
    return;
  }

  console.log(`[Simulador] Enviando lecturas cada ${intervalSec}s a ${baseUrl}...`);
  setInterval(() => {
    executeTick().catch((err) => {
      console.error('[Simulador] Error en ciclo:', err);
    });
  }, intervalSec * 1000);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((err) => {
    console.error('[Simulador] Fallo fatal:', err);
    process.exit(1);
  });
}
