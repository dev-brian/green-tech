/**
 * Demo con datos reales en un solo comando: te deja elegir el invernadero de
 * una lista (ya no hay que copiar su id de la consola de Firebase), levanta la
 * ingesta con Firestore y push, y abre el simulador visual.
 *
 *   pnpm sim:live                         # muestra la lista y preguntas cuál
 *   pnpm sim:live --invernadero="Demo clase"   # por nombre (o id), sin preguntar
 *
 * Necesita en .env.local: DEVICE_INGEST_KEY y FIREBASE_SERVICE_ACCOUNT
 * (o GOOGLE_APPLICATION_CREDENTIALS). GREENHOUSE_ID ya no hace falta: si está,
 * solo se usa como opción sugerida.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { loadEnvFile, parseArgs } from './config.ts';
import {
  describeGreenhouse,
  findGreenhouse,
  resolveAnswer,
  sortGreenhouses,
  type GreenhouseOption,
} from './greenhouseChoice.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

function fail(message: string): never {
  console.error(`[Simulador] ${message}`);
  process.exit(1);
}

async function listGreenhouses(): Promise<GreenhouseOption[]> {
  const { initFirestoreAdmin } = await import('../simulator/core/firestoreStorage.ts');
  const db = initFirestoreAdmin();
  const snap = await db.collection('greenhouses').get();
  return Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data();
      const [zones, admins] = await Promise.all([
        doc.ref.collection('zones').count().get(),
        doc.ref.collection('members').where('role', '==', 'admin').get(),
      ]);
      return {
        id: doc.id,
        name: typeof data.name === 'string' ? data.name : '',
        zoneCount: zones.data().count,
        memberCount: Array.isArray(data.memberIds) ? data.memberIds.length : 0,
        adminEmails: admins.docs
          .map((m) => m.get('email'))
          .filter((e): e is string => typeof e === 'string' && e.length > 0),
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
      };
    }),
  );
}

async function choose(list: GreenhouseOption[], query: string | null): Promise<GreenhouseOption> {
  if (query) {
    const { match, candidates } = findGreenhouse(list, query);
    if (match) return match;
    if (candidates.length === 0) fail(`No hay ningún invernadero que se llame "${query}".`);
    console.log(`[Simulador] Hay ${candidates.length} invernaderos que coinciden con "${query}"; elige uno:`);
    list = candidates;
  }

  const suggestedId = process.env.GREENHOUSE_ID?.trim();
  const suggested = list.find((g) => g.id === suggestedId) ?? list[0] ?? null;
  console.log('\nInvernaderos en Firestore (el más nuevo arriba):');
  list.forEach((g, i) => {
    const mark = g === suggested ? ' (Enter)' : '';
    console.log(`  ${String(i + 1).padStart(2)}) ${describeGreenhouse(g)}${mark}`);
  });

  if (!process.stdin.isTTY) {
    if (!suggested) fail('No hay invernaderos.');
    return suggested;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const answer = await rl.question('\n¿Cuál simulo? Escribe el número o el nombre: ');
      const picked = resolveAnswer(list, answer, suggested);
      if (picked) return picked;
      console.log('No lo encontré; escribe uno de los números de la lista.');
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  loadEnvFile();
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.DEVICE_INGEST_KEY?.trim()) fail('Falta DEVICE_INGEST_KEY en .env.local.');
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    fail('Falta FIREBASE_SERVICE_ACCOUNT (o GOOGLE_APPLICATION_CREDENTIALS) en .env.local. Sin cuenta de servicio usa: pnpm sim:demo');
  }

  const query = typeof args.invernadero === 'string' ? args.invernadero : null;
  const list = sortGreenhouses(await listGreenhouses());
  if (list.length === 0) fail('No hay invernaderos en Firestore. Crea uno en la PWA primero.');
  const greenhouse = await choose(list, query);
  console.log(`\n[Simulador] Invernadero: ${greenhouse.name} (${greenhouse.id})`);
  if (greenhouse.zoneCount === 0) {
    console.log('[Simulador] Aún no tiene zonas registradas: se simulan las 3 de ejemplo y la PWA te ofrecerá registrarlas.');
  }

  const ingestPort = process.env.INGEST_PORT ?? '8787';
  const env = {
    ...process.env,
    GREENHOUSE_ID: greenhouse.id,
    INGEST_URL: `http://127.0.0.1:${ingestPort}`,
    INGEST_PORT: ingestPort,
    USE_FIRESTORE: 'true',
    // 15 s: la alerta se ve casi al momento y la cuota alcanza para la demo.
    SIM_PUBLISH_INTERVAL: process.env.SIM_PUBLISH_INTERVAL ?? '15',
  };
  // --invernadero lo consume este lanzador; el resto pasa al simulador.
  const simArgs = process.argv.slice(2).filter((a) => !a.startsWith('--invernadero'));

  const children: ChildProcess[] = [];
  const start = (script: string, scriptArgs: string[]): void => {
    const child = spawn(process.execPath, [script, ...scriptArgs], { env, stdio: 'inherit' });
    children.push(child);
    child.on('exit', (code) => {
      for (const other of children) if (other !== child) other.kill();
      process.exit(code ?? 0);
    });
  };
  const stop = () => {
    for (const child of children) child.kill();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  start(join(HERE, '..', 'simulator', 'serve.ts'), ['--firestore']);
  // Un respiro para que la ingesta abra el puerto antes del primer envío.
  setTimeout(() => start(join(HERE, 'server.ts'), simArgs), 800);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
