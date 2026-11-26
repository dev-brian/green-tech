/**
 * Métricas de la ingesta para Prometheus (monitoreo del sistema).
 *
 * Se publican en GET /metrics con el formato de texto de Prometheus 0.0.4.
 * Está escrito sin dependencias: son pocos contadores y no hace falta
 * prom-client. Cada servidor crea su propio registro, así las pruebas no se
 * mezclan entre sí.
 *
 * Estas métricas son para el equipo (¿el sistema funciona?). Las alertas del
 * cultivo para el productor siguen saliendo del motor de alertas.
 */
import type { IngestProcessResult } from './alertAndActuatorEngine.ts';

export const METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

/** Límites del histograma de duración, en segundos. */
export const DURATION_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5];

/** Solo estas rutas se usan como etiqueta; cualquier otra cuenta como "otra". */
const KNOWN_ROUTES = new Set(['/ingestTelemetry', '/actuatorsState', '/health', '/metrics']);

const LEVEL_NUMBER = { ok: 0, warn: 1, critical: 2 } as const;

type Labels = Record<string, string>;

export function routeLabel(pathname: string): string {
  return KNOWN_ROUTES.has(pathname) ? pathname : 'otra';
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function formatLabels(labels: Labels): string {
  const parts = Object.entries(labels).map(([k, v]) => `${k}="${escapeLabel(v)}"`);
  return parts.length > 0 ? `{${parts.join(',')}}` : '';
}

function keyOf(labels: Labels): string {
  return JSON.stringify(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)));
}

function formatNumber(n: number): string {
  if (n === Infinity) return '+Inf';
  if (n === -Infinity) return '-Inf';
  return Number.isFinite(n) ? String(n) : 'NaN';
}

/** Serie con etiquetas y un valor (contador o gauge). */
export class SimpleMetric {
  private readonly series = new Map<string, { labels: Labels; value: number }>();
  // Sin parameter properties: Node ejecuta este archivo quitando solo los tipos.
  readonly name: string;
  readonly help: string;
  readonly type: 'counter' | 'gauge';
  constructor(name: string, help: string, type: 'counter' | 'gauge') {
    this.name = name;
    this.help = help;
    this.type = type;
  }

  set(labels: Labels, value: number): void {
    this.series.set(keyOf(labels), { labels, value });
  }

  inc(labels: Labels, by = 1): void {
    const key = keyOf(labels);
    const current = this.series.get(key);
    this.series.set(key, { labels, value: (current?.value ?? 0) + by });
  }

  get(labels: Labels): number | undefined {
    return this.series.get(keyOf(labels))?.value;
  }

  render(): string[] {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} ${this.type}`];
    for (const { labels, value } of this.series.values()) {
      lines.push(`${this.name}${formatLabels(labels)} ${formatNumber(value)}`);
    }
    return lines;
  }
}

/** Histograma acumulado, como lo espera histogram_quantile(). */
export class Histogram {
  private readonly series = new Map<string, { labels: Labels; buckets: number[]; sum: number; count: number }>();
  readonly name: string;
  readonly help: string;
  readonly bounds: number[];
  constructor(name: string, help: string, bounds: number[]) {
    this.name = name;
    this.help = help;
    this.bounds = bounds;
  }

  observe(labels: Labels, seconds: number): void {
    const key = keyOf(labels);
    const s = this.series.get(key) ?? { labels, buckets: this.bounds.map(() => 0), sum: 0, count: 0 };
    this.series.set(key, s);
    this.bounds.forEach((bound, i) => {
      if (seconds <= bound) s.buckets[i] += 1;
    });
    s.sum += seconds;
    s.count += 1;
  }

  count(labels: Labels): number {
    return this.series.get(keyOf(labels))?.count ?? 0;
  }

  render(): string[] {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const { labels, buckets, sum, count } of this.series.values()) {
      this.bounds.forEach((bound, i) => {
        lines.push(`${this.name}_bucket${formatLabels({ ...labels, le: String(bound) })} ${buckets[i]}`);
      });
      lines.push(`${this.name}_bucket${formatLabels({ ...labels, le: '+Inf' })} ${count}`);
      lines.push(`${this.name}_sum${formatLabels(labels)} ${formatNumber(sum)}`);
      lines.push(`${this.name}_count${formatLabels(labels)} ${count}`);
    }
    return lines;
  }
}

export interface IngestMetrics {
  /** Registra una petición HTTP ya respondida. */
  observeRequest(route: string, method: string, status: number, seconds: number): void;
  /** Registra una lectura aceptada y procesada por el motor. */
  recordReading(greenhouseId: string, zoneId: string, result: IngestProcessResult): void;
  /** Texto completo para GET /metrics. */
  render(): string;
  /** Acceso directo para pruebas. */
  readonly httpDuration: Histogram;
  readonly lastReading: SimpleMetric;
  readonly variableLevel: SimpleMetric;
}

export function createIngestMetrics(now: () => number = Date.now): IngestMetrics {
  const startedAt = now();
  const httpDuration = new Histogram(
    'greentech_http_request_duration_seconds',
    'Duración de las peticiones HTTP de la ingesta.',
    DURATION_BUCKETS,
  );
  const lastReading = new SimpleMetric(
    'greentech_zone_last_reading_timestamp_seconds',
    'Hora (epoch, segundos) de la última lectura aceptada de cada zona.',
    'gauge',
  );
  const variableValue = new SimpleMetric(
    'greentech_variable_value',
    'Último valor de cada variable por zona.',
    'gauge',
  );
  const variableLevel = new SimpleMetric(
    'greentech_variable_level',
    'Semáforo de cada variable: 0 ok, 1 precaución, 2 crítico.',
    'gauge',
  );
  const alertsCreated = new SimpleMetric(
    'greentech_alerts_created_total',
    'Alertas de cultivo creadas por el motor.',
    'counter',
  );
  const readingsAccepted = new SimpleMetric(
    'greentech_readings_accepted_total',
    'Lecturas aceptadas por zona.',
    'counter',
  );

  return {
    httpDuration,
    lastReading,
    variableLevel,

    observeRequest(route, method, status, seconds) {
      httpDuration.observe({ route: routeLabel(route), method, status: String(status) }, seconds);
    },

    recordReading(greenhouseId, zoneId, result) {
      const zone = { greenhouse: greenhouseId, zone: zoneId };
      const readingMs = Date.parse(result.zoneState.timestamp);
      lastReading.set(zone, (Number.isFinite(readingMs) ? readingMs : now()) / 1000);
      readingsAccepted.inc(zone);
      for (const [variable, state] of Object.entries(result.zoneState)) {
        if (variable === 'timestamp' || variable === 'crop' || !state || typeof state !== 'object') continue;
        const labels = { ...zone, variable };
        variableValue.set(labels, state.value);
        variableLevel.set(labels, LEVEL_NUMBER[state.level]);
      }
      for (const alert of result.createdAlerts) alertsCreated.inc({ severity: alert.severity });
    },

    render() {
      const mem = process.memoryUsage();
      const lines = [
        ...httpDuration.render(),
        ...readingsAccepted.render(),
        ...lastReading.render(),
        ...variableValue.render(),
        ...variableLevel.render(),
        ...alertsCreated.render(),
        '# HELP greentech_process_start_time_seconds Hora (epoch) en que arrancó la ingesta.',
        '# TYPE greentech_process_start_time_seconds gauge',
        `greentech_process_start_time_seconds ${startedAt / 1000}`,
        '# HELP greentech_process_resident_memory_bytes Memoria residente del proceso.',
        '# TYPE greentech_process_resident_memory_bytes gauge',
        `greentech_process_resident_memory_bytes ${mem.rss}`,
      ];
      return `${lines.join('\n')}\n`;
    },
  };
}
