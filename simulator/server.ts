/**
 * Servidor HTTP ligero de ingesta y consulta de actuadores (T2.1 #37, T8.3 #69).
 * Expone los mismos endpoints del contrato v0.2 sin requerir plan de pago Blaze:
 * - POST /ingestTelemetry (cabecera x-device-key)
 * - GET  /actuatorsState?greenhouseId=...&zoneId=...
 * - GET  /health
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { validateIngestPayload } from './core/hydroponicModel.ts';
import {
  InMemoryTelemetryStorage,
  processIngestedReading,
  type TelemetryStorageAdapter,
} from './core/alertAndActuatorEngine.ts';

export interface IngestServerOptions {
  deviceKey?: string;
  storage?: TelemetryStorageAdapter;
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
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return null;
  return JSON.parse(raw);
}

export function createIngestHttpServer(options: IngestServerOptions = {}): {
  server: Server;
  storage: TelemetryStorageAdapter;
} {
  const expectedKey =
    options.deviceKey ?? process.env.DEVICE_INGEST_KEY ?? 'gt-dev-device-key-2026';
  const storage = options.storage ?? new InMemoryTelemetryStorage();

  const server = createServer(async (req, res) => {
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

      // T8.3: Endpoint de solo lectura del estado de actuadores
      if (req.method === 'GET' && url.pathname === '/actuatorsState') {
        const greenhouseId = url.searchParams.get('greenhouseId')?.trim() ?? '';
        const zoneId = url.searchParams.get('zoneId')?.trim() ?? '';
        if (!greenhouseId || !zoneId) {
          sendJson(res, 400, {
            error: 'Parámetros greenhouseId y zoneId son obligatorios.',
          });
          return;
        }
        const state = await storage.getActuatorsState(greenhouseId, zoneId);
        sendJson(res, 200, state);
        return;
      }

      // T2.1: Función HTTP ingestTelemetry
      if (req.method === 'POST' && url.pathname === '/ingestTelemetry') {
        const deviceKeyHeader = req.headers['x-device-key'];
        const headerVal = Array.isArray(deviceKeyHeader)
          ? deviceKeyHeader[0]
          : deviceKeyHeader;

        let body: unknown;
        try {
          body = await readJsonBody(req);
        } catch {
          sendJson(res, 400, { error: 'JSON malformado en el cuerpo de la petición.' });
          return;
        }

        const validation = validateIngestPayload(body, headerVal, expectedKey);
        if (!validation.valid) {
          sendJson(res, validation.status, { error: validation.error });
          return;
        }

        const result = await processIngestedReading(validation.data, storage);
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

  return { server, storage };
}
