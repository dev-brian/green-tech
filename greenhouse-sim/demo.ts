/**
 * Demo sin configuración: levanta la ingesta en memoria y el simulador, cada
 * uno en su propio proceso, con una clave generada al vuelo. Nada llega a
 * Firestore; sirve para conocer la interfaz y probar escenarios.
 *
 *   pnpm sim:demo
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const INGEST_PORT = process.env.INGEST_PORT ?? '8787';

const env = {
  ...process.env,
  DEVICE_INGEST_KEY: `demo-${randomBytes(12).toString('hex')}`,
  GREENHOUSE_ID: 'demo-invernadero',
  INGEST_URL: `http://127.0.0.1:${INGEST_PORT}`,
  INGEST_PORT,
  USE_FIRESTORE: 'false',
  SIM_PUBLISH_INTERVAL: process.env.SIM_PUBLISH_INTERVAL ?? '5',
};

const children: ChildProcess[] = [];
function start(script: string, args: string[] = []): ChildProcess {
  const child = spawn(process.execPath, [script, ...args], { env, stdio: 'inherit' });
  children.push(child);
  child.on('exit', (code) => {
    for (const other of children) if (other !== child) other.kill();
    process.exit(code ?? 0);
  });
  return child;
}

console.log('[Demo] Ingesta en memoria + simulador. Nada se escribe en Firestore.');
start(join(HERE, '..', 'simulator', 'serve.ts'));
// Un respiro para que la ingesta abra el puerto antes del primer envío.
setTimeout(() => start(join(HERE, 'server.ts'), process.argv.slice(2)), 600);

const stop = () => {
  for (const child of children) child.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
