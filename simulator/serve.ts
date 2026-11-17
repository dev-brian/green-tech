/**
 * Arranca la ingesta (simulator/server.ts) como servicio propio en un puerto
 * fijo, para que le publiquen procesos externos: el simulador interactivo
 * (greenhouse-sim/) hoy y sensores reales después.
 *
 * Uso:
 *   node simulator/serve.ts                 # guarda en memoria (pruebas locales)
 *   node simulator/serve.ts --firestore     # escribe en Firestore con Admin SDK
 *   node simulator/serve.ts --port=8787 --host=0.0.0.0
 *
 * Variables: DEVICE_INGEST_KEY (obligatoria), INGEST_PORT, INGEST_HOST y, con
 * --firestore, FIREBASE_SERVICE_ACCOUNT o GOOGLE_APPLICATION_CREDENTIALS.
 */

import { createIngestHttpServer } from './server.ts';
import { FirestoreTelemetryStorage, loadEnvLocal } from './core/firestoreStorage.ts';

function flag(name: string): string | boolean | undefined {
  for (const arg of process.argv.slice(2)) {
    if (arg === `--${name}`) return true;
    if (arg.startsWith(`--${name}=`)) return arg.slice(name.length + 3);
  }
  return undefined;
}

function main(): void {
  loadEnvLocal();
  const useFirestore = flag('firestore') === true || process.env.USE_FIRESTORE === 'true';
  const port = Number(flag('port') ?? process.env.INGEST_PORT ?? 8787);
  // Por defecto solo escucha en esta máquina; para sensores en la red local usa --host=0.0.0.0.
  const host = String(flag('host') ?? process.env.INGEST_HOST ?? '127.0.0.1');

  const { server } = createIngestHttpServer({
    storage: useFirestore ? new FirestoreTelemetryStorage() : undefined,
  });

  server.on('error', (err) => {
    console.error(`[Ingesta] No se pudo abrir ${host}:${port}: ${err.message}`);
    process.exit(1);
  });
  server.listen(port, host, () => {
    console.log(
      `[Ingesta] Escuchando en http://${host}:${port} · almacenamiento: ${useFirestore ? 'Firestore' : 'memoria'}`,
    );
    console.log('[Ingesta] POST /ingestTelemetry (x-device-key) · GET /actuatorsState · GET /health');
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

try {
  main();
} catch (err) {
  console.error(`[Ingesta] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
