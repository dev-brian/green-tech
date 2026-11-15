/**
 * Rellena greenhouses/{id}/readingsHourly con las lecturas crudas que ya existen
 * (T7.1 #75). Hace falta una sola vez: desde este cambio, cada lectura que entra
 * por /ingestTelemetry ya actualiza su promedio por hora.
 *
 * Uso (con FIREBASE_SERVICE_ACCOUNT o GOOGLE_APPLICATION_CREDENTIALS):
 *   node simulator/backfillHourly.ts --greenhouseId=<ID_INVERNADERO>
 *   node simulator/backfillHourly.ts --dry-run   (solo cuenta, no escribe)
 *
 * Sobrescribe los documentos de las horas que encuentra; es seguro repetirlo.
 */

import { FirestoreTelemetryStorage, loadEnvLocal } from './core/firestoreStorage.ts';
import { aggregateReadings, retentionCutoffs } from './core/hourlyAggregation.ts';

async function main() {
  loadEnvLocal();
  const args = new Map(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? 'true'] as const;
    }),
  );
  const greenhouseId = args.get('greenhouseId') ?? process.env.GREENHOUSE_ID;
  if (!greenhouseId) {
    throw new Error('Falta --greenhouseId=<ID> o GREENHOUSE_ID en .env.local');
  }
  const dryRun = args.has('dry-run');

  const storage = new FirestoreTelemetryStorage();
  const since = retentionCutoffs().readingsBefore;
  const readings = await storage.listReadingsSince(greenhouseId, since);
  const aggregates = aggregateReadings(readings);

  console.log(
    `[Relleno] ${readings.length} lecturas desde ${since.toISOString()} → ${aggregates.size} documentos de readingsHourly.`,
  );
  if (dryRun) {
    console.log('[Relleno] --dry-run: no se escribió nada.');
    return;
  }
  await storage.writeHourly(greenhouseId, aggregates);
  console.log('[Relleno] Listo.');
}

main().catch((err) => {
  console.error('[Relleno] Falló:', err);
  process.exit(1);
});
