/**
 * Proceso principal del simulador interactivo.
 *
 *   node greenhouse-sim/server.ts                      # UI en http://localhost:4100
 *   node greenhouse-sim/server.ts --headless --scenario=sube-ph --speed=60
 *   node greenhouse-sim/server.ts --once               # un ciclo de publicación y termina
 *
 * Sirve la interfaz (Vite en modo middleware), una API de control local y un
 * flujo de eventos (SSE). Hacia fuera solo habla con la ingesta por HTTP.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError, loadConfig, type SimConfig } from './config.ts';
import { CommandError, parseCommand } from './model/commands.ts';
import type { Scenario } from './model/types.ts';
import { Publisher } from './publisher/publisher.ts';
import { BUILTIN_SCENARIOS } from './scenarios/library.ts';
import { parseScenario } from './scenarios/runner.ts';
import { INTERVAL_LIMITS, SPEED_LIMITS, Simulation, type LogEntry } from './simulation.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const CUSTOM_SCENARIOS_FILE = join(HERE, 'data', 'scenarios.json');
const TICK_MS = 250;
const STATE_PUSH_MS = 500;
const MAX_BODY_BYTES = 100_000;

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ── Escenarios propios (archivo local, fuera de git) ────────────────────

function loadCustomScenarios(zoneIds: string[]): Scenario[] {
  if (!existsSync(CUSTOM_SCENARIOS_FILE)) return [];
  try {
    const raw = JSON.parse(readFileSync(CUSTOM_SCENARIOS_FILE, 'utf8')) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      try {
        return [parseScenario(item, zoneIds)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function saveCustomScenarios(scenarios: Scenario[]): void {
  mkdirSync(dirname(CUSTOM_SCENARIOS_FILE), { recursive: true });
  writeFileSync(CUSTOM_SCENARIOS_FILE, `${JSON.stringify(scenarios, null, 2)}\n`);
}

// ── Utilidades HTTP ─────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type debe ser application/json.');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Cuerpo demasiado grande.');
    chunks.push(buf);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
  } catch {
    throw new HttpError(400, 'JSON malformado.');
  }
}

/**
 * La API de control no tiene autenticación, así que solo acepta peticiones
 * dirigidas a esta máquina (evita DNS rebinding desde una página web).
 */
function isLocalHost(req: IncomingMessage): boolean {
  const host = String(req.headers.host ?? '').replace(/:\d+$/, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

// ── Arranque ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config: SimConfig = loadConfig();
  const publisher = new Publisher({
    ingestUrl: config.ingestUrl,
    deviceKey: config.deviceKey,
    greenhouseId: config.greenhouseId,
  });
  const sim = new Simulation({
    publisher,
    speed: config.speed,
    publishIntervalSec: config.publishIntervalSec,
  });

  let customScenarios = loadCustomScenarios(sim.zoneIds);
  const allScenarios = (): Scenario[] => [...BUILTIN_SCENARIOS, ...customScenarios];
  const findScenario = (id: string): Scenario => {
    const found = allScenarios().find((s) => s.id === id);
    if (!found) throw new HttpError(404, `No existe el escenario ${id}.`);
    return found;
  };

  const log = (text: string) => console.log(`[Simulador] ${text}`);
  log(`Ingesta: ${config.ingestUrl} · invernadero: ${config.greenhouseId}`);

  if (config.scenarioId) {
    const scenario = allScenarios().find((s) => s.id === config.scenarioId);
    if (!scenario) {
      throw new ConfigError(
        `No existe el escenario "${config.scenarioId}". Disponibles: ${allScenarios().map((s) => s.id).join(', ')}`,
      );
    }
    sim.startScenario(scenario, !process.argv.some((a) => a.startsWith('--speed')));
  }

  if (config.once) {
    await sim.publishCycle();
    for (const entry of sim.log) log(`${entry.zoneId ? `${entry.zoneId} · ` : ''}${entry.text}`);
    const failed = sim.log.some((e) => e.kind === 'reject' || e.kind === 'queue');
    process.exit(failed ? 1 : 0);
  }

  // Reloj: la física avanza con el tiempo real transcurrido por la velocidad.
  let lastTick = Date.now();
  sim.nextPublishAt = Date.now() + 2000;
  const tick = setInterval(() => {
    const now = Date.now();
    sim.advance(Math.min((now - lastTick) / 1000, 5));
    lastTick = now;
    if (sim.nextPublishAt !== null && now >= sim.nextPublishAt) {
      sim.nextPublishAt = now + sim.publishIntervalSec * 1000;
      sim.publishCycle().catch((err) => console.error('[Simulador] Error al publicar:', err));
    }
  }, TICK_MS);

  if (config.headless) {
    sim.onLog = (entry) => log(`${entry.zoneId ? `${entry.zoneId} · ` : ''}${entry.text}`);
    log(`Modo sin interfaz · x${sim.speed} · publica cada ${sim.publishIntervalSec} s. Ctrl+C para salir.`);
    return;
  }

  // ── API de control y eventos ──────────────────────────────────────────
  const clients = new Set<ServerResponse>();
  const sendEvent = (res: ServerResponse, event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  sim.onLog = (entry: LogEntry) => {
    for (const res of clients) sendEvent(res, 'log', entry);
  };
  const pushState = setInterval(() => {
    if (clients.size === 0) return;
    const snapshot = sim.snapshot();
    for (const res of clients) sendEvent(res, 'state', snapshot);
  }, STATE_PUSH_MS);

  async function handleApi(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    const method = req.method ?? 'GET';

    if (method === 'GET' && path === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
      });
      sendEvent(res, 'state', sim.snapshot());
      sendEvent(res, 'history', sim.log.slice(-150));
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (method === 'GET' && path === '/api/state') return sendJson(res, 200, sim.snapshot());
    if (method === 'GET' && path === '/api/scenarios') return sendJson(res, 200, allScenarios());

    if (method === 'POST' && path === '/api/command') {
      const body = (await readJson(req)) as { command?: unknown } | null;
      sim.command(parseCommand(body?.command, sim.zoneIds));
      return sendJson(res, 200, { ok: true });
    }

    if (method === 'POST' && path === '/api/settings') {
      const body = ((await readJson(req)) ?? {}) as Record<string, unknown>;
      if (typeof body.speed === 'number' && Number.isFinite(body.speed)) {
        sim.speed = Math.max(SPEED_LIMITS.min, Math.min(SPEED_LIMITS.max, body.speed));
      }
      if (typeof body.paused === 'boolean') sim.paused = body.paused;
      if (typeof body.publishIntervalSec === 'number' && Number.isFinite(body.publishIntervalSec)) {
        sim.publishIntervalSec = Math.max(
          INTERVAL_LIMITS.min,
          Math.min(INTERVAL_LIMITS.max, Math.round(body.publishIntervalSec)),
        );
        sim.nextPublishAt = Date.now() + sim.publishIntervalSec * 1000;
      }
      return sendJson(res, 200, { ok: true });
    }

    if (method === 'POST' && path === '/api/publish-now') {
      sim.nextPublishAt = Date.now() + sim.publishIntervalSec * 1000;
      await sim.publishCycle();
      return sendJson(res, 200, { ok: true });
    }

    if (method === 'POST' && path === '/api/scenario/stop') {
      sim.stopScenario();
      return sendJson(res, 200, { ok: true });
    }

    if (method === 'POST' && path === '/api/scenarios') {
      const parsed = parseScenario(await readJson(req), sim.zoneIds);
      // Los propios viven en su propio espacio de nombres: nunca pisan a los incluidos.
      const id = parsed.id.startsWith('propio-') ? parsed.id : `propio-${parsed.id}`;
      const scenario: Scenario = { ...parsed, id, category: 'propio', builtin: false };
      customScenarios = [...customScenarios.filter((s) => s.id !== id), scenario];
      saveCustomScenarios(customScenarios);
      return sendJson(res, 201, scenario);
    }

    const match = path.match(/^\/api\/scenarios\/([a-z0-9-]+)(\/run)?$/);
    if (match && method === 'POST' && match[2]) {
      const body = ((await readJson(req)) ?? {}) as { applySpeed?: unknown };
      sim.startScenario(findScenario(match[1]), body.applySpeed !== false);
      return sendJson(res, 200, { ok: true });
    }
    if (match && method === 'DELETE' && !match[2]) {
      if (!customScenarios.some((s) => s.id === match[1])) {
        throw new HttpError(404, 'Solo se pueden borrar escenarios propios.');
      }
      customScenarios = customScenarios.filter((s) => s.id !== match[1]);
      saveCustomScenarios(customScenarios);
      return sendJson(res, 200, { ok: true });
    }

    throw new HttpError(404, 'Ruta no encontrada.');
  }

  const httpServer = createServer();
  const { createServer: createViteServer } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');
  const vite = await createViteServer({
    configFile: false,
    root: join(HERE, 'ui'),
    cacheDir: join(HERE, '..', 'node_modules', '.vite-greenhouse-sim'),
    plugins: [react()],
    appType: 'spa',
    clearScreen: false,
    logLevel: 'warn',
    server: {
      middlewareMode: true,
      hmr: { server: httpServer },
      fs: { allow: [join(HERE, '..')] },
    },
  });

  httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
    if (!isLocalHost(req)) {
      sendJson(res, 403, { error: 'El simulador solo se usa desde esta máquina (localhost).' });
      return;
    }
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path.startsWith('/api/')) {
      handleApi(req, res, path).catch((err: unknown) => {
        const status =
          err instanceof HttpError ? err.status : err instanceof CommandError ? 400 : 500;
        if (status === 500) console.error('[Simulador] Error en la API:', err);
        if (!res.headersSent) {
          sendJson(res, status, { error: err instanceof Error ? err.message : 'Error interno.' });
        }
      });
      return;
    }
    vite.middlewares(req, res, () => sendJson(res, 404, { error: 'No encontrado.' }));
  });

  httpServer.on('error', (err) => {
    console.error(`[Simulador] No se pudo abrir el puerto ${config.port}: ${err.message}`);
    process.exit(1);
  });
  httpServer.listen(config.port, '127.0.0.1', () => {
    log(`Interfaz lista en http://localhost:${config.port}`);
  });

  const shutdown = () => {
    clearInterval(tick);
    clearInterval(pushState);
    for (const res of clients) res.end();
    void vite.close().finally(() => httpServer.close(() => process.exit(0)));
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  if (err instanceof ConfigError) console.error(`[Simulador] ${err.message}`);
  else console.error('[Simulador] Fallo fatal:', err);
  process.exit(1);
});
