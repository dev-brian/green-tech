/**
 * Publicador: el único punto de contacto con el backend. Usa exclusivamente
 * los dos endpoints del contrato (docs/contrato-datos.md, sección 2.7):
 *
 *   POST {ingestUrl}/ingestTelemetry   cabecera x-device-key
 *   GET  {ingestUrl}/actuatorsState?greenhouseId=…&zoneId=…
 *
 * Se comporta como el firmware de un nodo real: si no hay red guarda las
 * lecturas con su hora original y las reenvía en orden cuando regresa.
 */

import type { IngestTelemetryRequest } from '../../simulator/core/hydroponicModel.ts';
import type { AlertLevel, BackendCommands, HydroponicVariable } from '../model/types.ts';

export type IngestPayload = Required<IngestTelemetryRequest>;

export interface PublisherConfig {
  ingestUrl: string;
  deviceKey: string;
  greenhouseId: string;
  /** Lecturas que guarda cada nodo sin conexión antes de descartar las más viejas. */
  maxQueuePerZone?: number;
  /** Cuántas lecturas atrasadas reenvía por zona en cada ciclo. */
  flushPerCycle?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export type PublishOutcome =
  | {
      status: 'sent';
      zoneId: string;
      payload: IngestPayload;
      levels: Partial<Record<HydroponicVariable, AlertLevel>>;
      createdAlerts: number;
      resolvedAlerts: number;
      backlog: boolean;
    }
  | { status: 'queued'; zoneId: string; payload: IngestPayload; reason: string; queueSize: number }
  | { status: 'rejected'; zoneId: string; payload: IngestPayload; httpStatus: number; error: string };

export interface PublisherStats {
  sent: number;
  rejected: number;
  queued: number;
  lastOkAt: number | null;
  lastError: string | null;
}

interface IngestResponseBody {
  zoneState?: Record<string, unknown>;
  createdAlertsCount?: number;
  resolvedAlertsCount?: number;
  error?: string;
}

class TransportError extends Error {}

export class Publisher {
  private readonly config: Required<Omit<PublisherConfig, 'fetchImpl'>>;
  private readonly fetchImpl: typeof fetch;
  private readonly queues = new Map<string, IngestPayload[]>();
  readonly stats: PublisherStats = {
    sent: 0,
    rejected: 0,
    queued: 0,
    lastOkAt: null,
    lastError: null,
  };

  constructor(config: PublisherConfig) {
    this.config = {
      ingestUrl: config.ingestUrl.replace(/\/+$/, ''),
      deviceKey: config.deviceKey,
      greenhouseId: config.greenhouseId,
      maxQueuePerZone: config.maxQueuePerZone ?? 120,
      flushPerCycle: config.flushPerCycle ?? 20,
      timeoutMs: config.timeoutMs ?? 8000,
    };
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  get ingestUrl(): string {
    return this.config.ingestUrl;
  }

  get greenhouseId(): string {
    return this.config.greenhouseId;
  }

  queueSize(zoneId?: string): number {
    if (zoneId) return this.queues.get(zoneId)?.length ?? 0;
    let total = 0;
    for (const q of this.queues.values()) total += q.length;
    return total;
  }

  clearQueues(): void {
    this.queues.clear();
    this.stats.queued = 0;
  }

  private enqueue(payload: IngestPayload): number {
    const queue = this.queues.get(payload.zoneId) ?? [];
    queue.push(payload);
    while (queue.length > this.config.maxQueuePerZone) queue.shift();
    this.queues.set(payload.zoneId, queue);
    this.stats.queued = this.queueSize();
    return queue.length;
  }

  private async post(payload: IngestPayload): Promise<{ status: number; body: IngestResponseBody }> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.config.ingestUrl}/ingestTelemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-key': this.config.deviceKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (err) {
      throw new TransportError(
        `No se pudo conectar con la ingesta (${err instanceof Error ? err.message : String(err)}).`,
      );
    }
    let body: IngestResponseBody = {};
    try {
      body = (await res.json()) as IngestResponseBody;
    } catch {
      // Respuesta sin JSON: se trata según el código HTTP.
    }
    // 5xx y 429 son fallas temporales: la lectura se conserva para reintentar.
    if (res.status >= 500 || res.status === 429) {
      throw new TransportError(`La ingesta respondió ${res.status}: ${body.error ?? 'error temporal'}.`);
    }
    return { status: res.status, body };
  }

  private toOutcome(
    payload: IngestPayload,
    result: { status: number; body: IngestResponseBody },
    backlog: boolean,
  ): PublishOutcome {
    if (result.status >= 400) {
      this.stats.rejected += 1;
      const error = result.body.error ?? `HTTP ${result.status}`;
      this.stats.lastError = `${payload.zoneId}: ${error}`;
      return { status: 'rejected', zoneId: payload.zoneId, payload, httpStatus: result.status, error };
    }
    this.stats.sent += 1;
    this.stats.lastOkAt = Date.now();
    this.stats.lastError = null;
    const levels: Partial<Record<HydroponicVariable, AlertLevel>> = {};
    for (const [key, value] of Object.entries(result.body.zoneState ?? {})) {
      const level = (value as { level?: unknown } | null)?.level;
      if (level === 'ok' || level === 'warn' || level === 'critical') {
        levels[key as HydroponicVariable] = level;
      }
    }
    return {
      status: 'sent',
      zoneId: payload.zoneId,
      payload,
      levels,
      createdAlerts: result.body.createdAlertsCount ?? 0,
      resolvedAlerts: result.body.resolvedAlertsCount ?? 0,
      backlog,
    };
  }

  /**
   * Publica una lectura. Con `online = false` (escenario "sin internet") solo
   * la guarda. Si hay lecturas atrasadas de esa zona, salen primero y en orden.
   */
  async publish(payload: IngestPayload, online: boolean): Promise<PublishOutcome[]> {
    if (!online) {
      const queueSize = this.enqueue(payload);
      return [{ status: 'queued', zoneId: payload.zoneId, payload, reason: 'Sin internet', queueSize }];
    }

    const outcomes: PublishOutcome[] = [];
    const queue = this.queues.get(payload.zoneId) ?? [];
    const pending = [...queue.splice(0, this.config.flushPerCycle)];
    // La lectura nueva solo sale si ya no queda atraso; si no, se forma.
    const deferred = queue.length > 0;
    if (deferred) queue.push(payload);
    else pending.push(payload);

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      try {
        const result = await this.post(item);
        outcomes.push(this.toOutcome(item, result, item !== payload));
      } catch (err) {
        // Falla de transporte: lo que no salió regresa al frente de la cola.
        const rest = pending.slice(i);
        const restored = [...rest, ...queue];
        while (restored.length > this.config.maxQueuePerZone) restored.shift();
        this.queues.set(payload.zoneId, restored);
        const reason = err instanceof Error ? err.message : String(err);
        this.stats.lastError = reason;
        this.stats.queued = this.queueSize();
        outcomes.push({
          status: 'queued',
          zoneId: payload.zoneId,
          payload: item,
          reason,
          queueSize: restored.length,
        });
        return outcomes;
      }
    }
    while (queue.length > this.config.maxQueuePerZone) queue.shift();
    this.queues.set(payload.zoneId, queue);
    this.stats.queued = this.queueSize();
    if (deferred) {
      outcomes.push({
        status: 'queued',
        zoneId: payload.zoneId,
        payload,
        reason: 'Reenviando lecturas atrasadas',
        queueSize: queue.length,
      });
    }
    return outcomes;
  }

  /** Lee las órdenes del backend para los actuadores de una zona. */
  async fetchActuators(zoneId: string): Promise<BackendCommands | null> {
    const url =
      `${this.config.ingestUrl}/actuatorsState` +
      `?greenhouseId=${encodeURIComponent(this.config.greenhouseId)}` +
      `&zoneId=${encodeURIComponent(zoneId)}`;
    try {
      const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.config.timeoutMs) });
      if (!res.ok) return null;
      const body = (await res.json()) as Record<string, { on?: unknown } | undefined>;
      const on = (key: string, fallback: boolean): boolean =>
        typeof body[key]?.on === 'boolean' ? (body[key]?.on as boolean) : fallback;
      return {
        recirculationPump: on('recirculationPump', true),
        phDoser: on('phDoser', false),
        nutrientDoser: on('nutrientDoser', false),
        ventilation: on('ventilation', false),
      };
    } catch {
      return null;
    }
  }
}
