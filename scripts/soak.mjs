/**
 * Lanzador de la corrida continua (soak) del simulador — T2.5 #41.
 *
 * `simulator/soak.ts` está en TypeScript: en Node >= 23.6 el "type stripping"
 * viene activado por defecto, pero en versiones anteriores (22.x LTS, p. ej.)
 * necesita el flag `--experimental-strip-types`. Este script lanza el soak
 * con el flag solo cuando la versión de Node lo requiere, para que
 * `pnpm sim:soak` funcione igual en todas las máquinas del equipo.
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [major, minor] = process.versions.node.split('.').map(Number);
const needsStripTypesFlag = major < 23 || (major === 23 && minor < 6);
const flags = needsStripTypesFlag ? ['--experimental-strip-types'] : [];

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'simulator', 'soak.ts');
const child = spawn(process.execPath, [...flags, target, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

// Evita que el proceso quede colgado si el hijo nunca responde.
child.on('error', (err) => {
  console.error('[soak] No se pudo lanzar simulator/soak.ts:', err);
  process.exit(1);
});

// Guard anti-ejecución accidental al importar el módulo.
void pathToFileURL;
