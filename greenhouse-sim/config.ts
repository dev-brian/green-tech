/** Configuración del simulador: argumentos de línea de comandos y .env.local. */

import { existsSync, readFileSync } from 'node:fs';

export interface SimConfig {
  ingestUrl: string;
  deviceKey: string;
  greenhouseId: string;
  port: number;
  publishIntervalSec: number;
  speed: number;
  headless: boolean;
  once: boolean;
  scenarioId: string | null;
}

/** Lee .env.local sin pisar lo que ya venga en el entorno. */
export function loadEnvFile(path = '.env.local'): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

export function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq > 0) out[arg.slice(2, eq)] = arg.slice(eq + 1);
    else out[arg.slice(2)] = true;
  }
  return out;
}

export class ConfigError extends Error {}

export function loadConfig(argv: string[] = process.argv.slice(2)): SimConfig {
  loadEnvFile();
  const args = parseArgs(argv);
  const str = (flag: string, env: string, fallback = ''): string => {
    const fromArg = args[flag];
    return (typeof fromArg === 'string' ? fromArg : (process.env[env] ?? fallback)).trim();
  };
  const positive = (flag: string, env: string, fallback: number): number => {
    const value = Number(str(flag, env, String(fallback)));
    if (!Number.isFinite(value) || value <= 0) {
      throw new ConfigError(`--${flag} (${env}) debe ser un número mayor que cero.`);
    }
    return value;
  };

  const deviceKey = str('deviceKey', 'DEVICE_INGEST_KEY');
  const greenhouseId = str('greenhouseId', 'GREENHOUSE_ID');
  const missing: string[] = [];
  if (!deviceKey) missing.push('DEVICE_INGEST_KEY');
  if (!greenhouseId) missing.push('GREENHOUSE_ID');
  if (missing.length > 0) {
    throw new ConfigError(
      `Falta ${missing.join(' y ')}. Defínelo en .env.local o en el entorno. ` +
        'Para probar sin configurar nada usa: pnpm sim:demo',
    );
  }

  const scenario = args.scenario;
  return {
    ingestUrl: str('ingestUrl', 'INGEST_URL', 'http://127.0.0.1:8787'),
    deviceKey,
    greenhouseId,
    port: positive('port', 'SIM_PORT', 4100),
    publishIntervalSec: positive('interval', 'SIM_PUBLISH_INTERVAL', 60),
    speed: positive('speed', 'SIM_SPEED', 1),
    headless: args.headless === true || args.once === true,
    once: args.once === true,
    scenarioId: typeof scenario === 'string' ? scenario : null,
  };
}
