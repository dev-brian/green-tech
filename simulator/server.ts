/**
 * Servidor HTTP ligero de ingesta y consulta de actuadores (T2.1 #37, T8.3 #69).
 * Expone los mismos endpoints del contrato v0.2 sin requerir plan de pago Blaze:
 * - POST /ingestTelemetry (cabecera x-device-key)
 * - GET  /actuatorsState?greenhouseId=...&zoneId=...
 * - GET  /health
 * - GET  /metrics (Prometheus; con METRICS_TOKEN pide Authorization: Bearer)
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { validateIngestPayload } from './core/hydroponicModel.ts';
import {
  InMemoryTelemetryStorage,
  processIngestedReading,
  type TelemetryStorageAdapter,
} from './core/alertAndActuatorEngine.ts';
import type { AlertPushNotifier } from './core/pushNotifier.ts';
import { createIngestMetrics, METRICS_CONTENT_TYPE, type IngestMetrics } from './core/metrics.ts';

/** Una lectura pesa ~300 bytes; 16 KB deja margen y corta cuerpos abusivos. */
export const MAX_BODY_BYTES = 16 * 1024;
/** Hora del dispositivo aceptada hasta 5 min en el futuro (relojes sin NTP). */
export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

class PayloadTooLargeError extends Error {}

/** Comparación de tiempo constante (auditoría C3): no filtra la clave por tiempos. */
export function deviceKeyMatches(given: string | undefined, expected: string): boolean {
  if (!given || !expected) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function headerKey(req: IncomingMessage): string | undefined {
  const h = req.headers['x-device-key'];
  return Array.isArray(h) ? h[0] : h;
}

function bearerToken(req: IncomingMessage): string | undefined {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice('Bearer '.length).trim() : undefined;
}

/** Invernaderos aceptados, de INGEST_GREENHOUSE_IDS="id1,id2". Vacío = cualquiera. */
function parseAllowedGreenhouses(raw: string | undefined): Set<string> | null {
  const ids = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length > 0 ? new Set(ids) : null;
}

export interface IngestServerOptions {
  deviceKey?: string;
  /**
   * Invernaderos que esta clave puede escribir (auditoría C3). Por defecto
   * INGEST_GREENHOUSE_IDS; si no hay ninguno, se acepta cualquiera (modo de
   * desarrollo con el simulador).
   */
  allowedGreenhouseIds?: string[];
  /** Reloj inyectable para pruebas. */
  now?: () => number;
  storage?: TelemetryStorageAdapter;
  /** Envío de push de alertas críticas (T6.5 #52); sin él no se notifica. */
  notifier?: AlertPushNotifier;
  /**
   * Token para leer GET /metrics. Por defecto METRICS_TOKEN; si está vacío,
   * /metrics es público (uso local con Prometheus en la misma máquina).
   */
  metricsToken?: string;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-device-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new PayloadTooLargeError();
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new PayloadTooLargeError();
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return null;
  return JSON.parse(raw);
}

export function createIngestHttpServer(options: IngestServerOptions = {}): {
  server: Server;
  storage: TelemetryStorageAdapter;
  metrics: IngestMetrics;
} {
  // Sin clave por defecto: una clave conocida en el repo equivale a no tener clave.
  const expectedKey = (options.deviceKey ?? process.env.DEVICE_INGEST_KEY ?? '').trim();
  if (!expectedKey) {
    throw new Error(
      'Falta la clave de dispositivo: define DEVICE_INGEST_KEY (en .env.local o en el entorno) o pasa deviceKey.',
    );
  }
  const storage = options.storage ?? new InMemoryTelemetryStorage();
  const allowed = options.allowedGreenhouseIds
    ? new Set(options.allowedGreenhouseIds)
    : parseAllowedGreenhouses(process.env.INGEST_GREENHOUSE_IDS);
  const now = options.now ?? Date.now;
  const metrics = createIngestMetrics(now);
  const metricsToken = (options.metricsToken ?? process.env.METRICS_TOKEN ?? '').trim();

  const server = createServer(async (req, res) => {
    // Monitoreo: se mide cada petición al terminar de responder, con su código real.
    const startedAt = performance.now();
    res.on('finish', () => {
      const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
      metrics.observeRequest(pathname, req.method ?? 'GET', res.statusCode, (performance.now() - startedAt) / 1000);
    });

    try {
      if (req.method === 'OPTIONS') {
        sendJson(res, 204, {});
        return;
      }

      const url = new URL(req.url ?? '/', 'http://127.0.0.1');

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true, service: 'green-tech-ingest' });
        return;
      }

      // Monitoreo con Prometheus (monitoring/README.md).
      if (req.method === 'GET' && url.pathname === '/metrics') {
        if (metricsToken && !deviceKeyMatches(bearerToken(req), metricsToken)) {
          sendJson(res, 401, { error: 'Token de métricas inválido o ausente.' });
          return;
        }
        res.writeHead(200, { 'Content-Type': METRICS_CONTENT_TYPE });
        res.end(metrics.render());
        return;
      }

      // T8.3: Endpoint de solo lectura del estado de actuadores
      if (req.method === 'GET' && url.pathname === '/actuatorsState') {
        // Auditoría C3: antes no pedía clave.
        if (!deviceKeyMatches(headerKey(req), expectedKey)) {
          sendJson(res, 401, { error: 'Clave de dispositivo (x-device-key) inválida o ausente.' });
          return;
        }
        const greenhouseId = url.searchParams.get('greenhouseId')?.trim() ?? '';
        const zoneId = url.searchParams.get('zoneId')?.trim() ?? '';
        if (!greenhouseId || !zoneId) {
          sendJson(res, 400, {
            error: 'Parámetros greenhouseId y zoneId son obligatorios.',
          });
          return;
        }
        if (allowed && !allowed.has(greenhouseId)) {
          sendJson(res, 403, { error: 'Esta clave no puede leer ese invernadero.' });
          return;
        }
        const state = await storage.getActuatorsState(greenhouseId, zoneId);
        sendJson(res, 200, state);
        return;
      }

      // T2.1: Función HTTP ingestTelemetry
      if (req.method === 'POST' && url.pathname === '/ingestTelemetry') {
        const headerVal = headerKey(req);
        // Se revisa la clave antes de leer el cuerpo, en tiempo constante.
        if (!deviceKeyMatches(headerVal, expectedKey)) {
          sendJson(res, 401, { error: 'Clave de dispositivo (x-device-key) inválida o ausente.' });
          return;
        }

        let body: unknown;
        try {
          body = await readJsonBody(req);
        } catch (err) {
          if (err instanceof PayloadTooLargeError) {
            sendJson(res, 413, { error: `El cuerpo supera ${MAX_BODY_BYTES} bytes.` });
            return;
          }
          sendJson(res, 400, { error: 'JSON malformado en el cuerpo de la petición.' });
          return;
        }

        const validation = validateIngestPayload(body, headerVal, expectedKey);
        if (!validation.valid) {
          sendJson(res, validation.status, { error: validation.error });
          return;
        }
        if (allowed && !allowed.has(validation.data.greenhouseId)) {
          sendJson(res, 403, { error: 'Esta clave no puede escribir en ese invernadero.' });
          return;
        }
        // Una hora en el futuro dejaría la zona "al día" para siempre.
        if (Date.parse(validation.data.timestamp) - now() > MAX_FUTURE_SKEW_MS) {
          sendJson(res, 400, { error: 'La hora de la lectura está en el futuro; revisa el reloj del dispositivo.' });
          return;
        }

        const result = await processIngestedReading(validation.data, storage, options.notifier);
        metrics.recordReading(validation.data.greenhouseId, validation.data.zoneId, result);
        sendJson(res, 201, {
          ok: true,
          readingId: result.readingId,
          zoneState: result.zoneState,
          createdAlertsCount: result.createdAlerts.length,
          resolvedAlertsCount: result.resolvedAlertIds.length,
          actuators: result.actuators,
        });
        return;
      }

      sendJson(res, 404, { error: 'Ruta no encontrada.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error interno del servidor.';
      sendJson(res, 500, { error: msg });
    }
  });

  return { server, storage, metrics };
}
