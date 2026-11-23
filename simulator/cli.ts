/**
 * Programa simulador independiente en Node (HU-02: T2.2 #38, T2.3 #39, T8.3 #69).
 * No accede directamente a Firestore desde el cliente simulador: envía lecturas
 * de las 7 variables para 3 zonas únicamente por HTTP POST /ingestTelemetry con
 * cabecera x-device-key, y consulta el estado de actuadores vía GET /actuatorsState.
 *
 * Uso:
 *   node simulator/cli.ts --once
 *   node simulator/cli.ts --once --scenario=ph-alto
 *   node simulator/cli.ts --firestore --greenhouseId=<ID_INVERNADERO> --scenario=normal
 *   node simulator/cli.ts --firestore --once --prune   (además borra lecturas de más de 7 días
 *                                                       y promedios por hora de más de 30, T7.1 #75)
 *   node simulator/cli.ts --firestore --all --once --prune
 *        (todos los invernaderos de Firestore, cada uno con las zonas y cultivos
 *         que registró en la PWA; es lo que corre el ciclo programado)
 */

import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { createIngestHttpServer } from './server.ts';
import {
  FirestoreTelemetryStorage,
  initFirestoreAdmin,
  loadEnvLocal,
} from './core/firestoreStorage.ts';
import { capZones, discoverGreenhouses, MAX_ZONES_PER_RUN } from './core/zoneDiscovery.ts';
import { FcmPushNotifier } from './core/fcmPushNotifier.ts';
import {
  DEFAULT_SIMULATED_ZONES,
  createInitialReadings,
  stepZoneReadings,
  type SimulatedZoneConfig,
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
  // Cargar .env.local antes de leer GREENHOUSE_ID, DEVICE_INGEST_KEY, etc. (#90)
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));
  const rawScenario = String(args.scenario ?? 'normal') as SimulatorScenario;
  const scenario: SimulatorScenario = VALID_SCENARIOS.has(rawScenario)
    ? rawScenario
    : 'normal';

  const greenhouseId = String(
    args.greenhouseId ?? process.env.GREENHOUSE_ID ?? 'demo-greenhouse',
  );
  const deviceKey = String(args.deviceKey ?? process.env.DEVICE_INGEST_KEY ?? '').trim();
  if (!deviceKey) {
    throw new Error(
      'Falta la clave de dispositivo: define DEVICE_INGEST_KEY en .env.local o usa --deviceKey=<clave>.',
    );
  }
  const intervalSec = Math.max(1, Number(args.interval ?? 60));
  const once = Boolean(args.once);
  const useFirestore =
    Boolean(args.firestore) || process.env.USE_FIRESTORE === 'true';
  const prune = Boolean(args.prune);
  const all = Boolean(args.all);
  if (all && !useFirestore) {
    throw new Error('--all necesita --firestore: lee los invernaderos y sus zonas de Firestore.');
  }

  // Qué simular: con --all, cada invernadero con sus zonas registradas en la PWA;
  // sin --all, un invernadero con las 3 zonas de siempre.
  let targets: { greenhouseId: string; zones: SimulatedZoneConfig[] }[];
  if (all) {
    const found = await discoverGreenhouses(initFirestoreAdmin());
    const totalZones = found.reduce((n, g) => n + g.zones.length, 0);
    targets = capZones(found);
    if (totalZones > MAX_ZONES_PER_RUN) {
      console.warn(
        `[Simulador] Hay ${totalZones} zonas; solo se simulan ${MAX_ZONES_PER_RUN} por ciclo para cuidar la cuota.`,
      );
    }
    for (const g of found) {
      console.log(
        `[Simulador] ${g.greenhouseId}: ${g.zones.map((z) => `${z.zoneId} (${z.crop})`).join(', ')} [${g.source}]`,
      );
    }
    if (targets.length === 0) {
      console.log('[Simulador] Ningún invernadero tiene zonas registradas; no hay nada que simular.');
    }
  } else {
    targets = [{ greenhouseId, zones: DEFAULT_SIMULATED_ZONES }];
  }

  let baseUrl = typeof args.ingestUrl === 'string' ? args.ingestUrl : process.env.INGEST_URL;
  let embeddedServer: ReturnType<typeof createIngestHttpServer>['server'] | null = null;

  // Purga de lecturas de más de 7 días y promedios de más de 30 (T7.1 #75)
  if (prune) {
    if (useFirestore && !baseUrl) {
      const storage = new FirestoreTelemetryStorage();
      for (const target of targets) {
        const { readingsDeleted, hourlyDeleted } = await storage.pruneExpired(target.greenhouseId);
        console.log(
          `[Simulador] Purga ${target.greenhouseId}: ${readingsDeleted} lecturas y ${hourlyDeleted} promedios por hora vencidos borrados.`,
        );
      }
    } else {
      console.warn('[Simulador] --prune solo funciona con --firestore y sin --ingestUrl; se omite.');
    }
  }

  if (!baseUrl) {
    const storage = useFirestore
      ? new FirestoreTelemetryStorage()
      : undefined;
    // Con Firestore también se envían push FCM de alertas críticas (T6.5 #52)
    const notifier = useFirestore ? new FcmPushNotifier() : undefined;
    const { server } = createIngestHttpServer({ deviceKey, storage, notifier });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    embeddedServer = server;
  }

  // Lecturas por invernadero y zona: dos cuentas pueden tener una "zona-1" cada una.
  const zoneReadings: Record<string, HydroponicReadings> = {};
  const keyOf = (gh: string, zoneId: string) => `${gh}/${zoneId}`;
  for (const target of targets) {
    for (const zone of target.zones) {
      zoneReadings[keyOf(target.greenhouseId, zone.zoneId)] = createInitialReadings(zone.crop);
    }
  }

  const tickGreenhouse = async (greenhouseId: string, zones: SimulatedZoneConfig[]) => {
    const nowIso = new Date().toISOString();
    for (const zone of zones) {
      const key = keyOf(greenhouseId, zone.zoneId);
      // 1. Consultar estado actual de actuadores (lazo cerrado T8.3)
      const actuatorsRes = await fetch(
        `${baseUrl}/actuatorsState?greenhouseId=${encodeURIComponent(greenhouseId)}&zoneId=${encodeURIComponent(zone.zoneId)}`,
        // Auditoría C3: /actuatorsState también exige la clave.
        { headers: { 'x-device-key': deviceKey } },
      );
      if (!actuatorsRes.ok) {
        console.warn(`[Simulador] ${zone.zoneId}: /actuatorsState respondió ${actuatorsRes.status}; se sigue sin lazo cerrado.`);
      }
      const actuators = actuatorsRes.ok
        ? ((await actuatorsRes.json()) as ZoneActuatorsState)
        : undefined;

      // 2. Calcular siguiente lectura con deriva y escenario
      const nextReading = stepZoneReadings(zoneReadings[key], zone.crop, {
        scenario,
        actuators,
      });
      zoneReadings[key] = nextReading;

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
        `[Simulador${useFirestore ? ' · Firestore' : ''}] ${greenhouseId}/${zone.zoneId} (${zone.crop}) | escenario=${scenario} | pH=${nextReading.ph} EC=${nextReading.ec} Temp=${nextReading.airTemp}°C Tanque=${nextReading.tankLevel}% | alertasNuevas=${summary.createdAlertsCount} resueltas=${summary.resolvedAlertsCount}`,
      );
    }
  };

  // Un invernadero con error (p. ej. zona mal escrita) no detiene a los demás.
  const executeTick = async () => {
    let failed = 0;
    for (const target of targets) {
      try {
        await tickGreenhouse(target.greenhouseId, target.zones);
      } catch (err) {
        failed++;
        console.error(`[Simulador] ${target.greenhouseId}: falló el ciclo:`, err);
      }
    }
    if (failed > 0 && failed === targets.length) {
      throw new Error('Falló el ciclo en todos los invernaderos.');
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

// pathToFileURL convierte bien las rutas de Windows (C:\...) a file:///C:/...
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((err) => {
    console.error('[Simulador] Fallo fatal:', err);
    process.exit(1);
  });
}
