import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createIngestHttpServer } from '../simulator/server.ts';
import { createIngestMetrics, routeLabel } from '../simulator/core/metrics.ts';

const KEY = 'clave-metricas';
const NOW = Date.parse('2026-11-26T12:00:00.000Z');

const reading = (zoneId: string, ph = 6.0) => ({
  greenhouseId: 'gh-metricas',
  zoneId,
  crop: 'jitomate',
  timestamp: '2026-11-26T11:59:00.000Z',
  readings: { airTemp: 24, humidity: 65, light: 30000, ph, ec: 2.5, solutionTemp: 21, tankLevel: 85 },
});

async function withServer(
  opts: Parameters<typeof createIngestHttpServer>[0],
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const { server } = createIngestHttpServer(opts);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await fn(base);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

const post = (base: string, body: unknown, key = KEY) =>
  fetch(`${base}/ingestTelemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-device-key': key },
    body: JSON.stringify(body),
  });

describe('Monitoreo: GET /metrics para Prometheus', () => {
  it('publica la hora de la última lectura, el semáforo y las peticiones por código', async () => {
    await withServer({ deviceKey: KEY, now: () => NOW, metricsToken: '' }, async (base) => {
      assert.equal((await post(base, reading('zona-1'))).status, 201);
      assert.equal((await post(base, reading('zona-2', 8.5))).status, 201);
      assert.equal((await post(base, reading('zona-1'), 'clave-mala')).status, 401);

      const res = await fetch(`${base}/metrics`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') ?? '', /text\/plain; version=0\.0\.4/);
      const text = await res.text();

      const last = Date.parse('2026-11-26T11:59:00.000Z') / 1000;
      assert.ok(
        text.includes(`greentech_zone_last_reading_timestamp_seconds{greenhouse="gh-metricas",zone="zona-1"} ${last}`),
      );
      assert.ok(text.includes('greentech_variable_level{greenhouse="gh-metricas",zone="zona-2",variable="ph"} 2'));
      assert.ok(text.includes('greentech_variable_level{greenhouse="gh-metricas",zone="zona-1",variable="ph"} 0'));
      assert.ok(text.includes('greentech_alerts_created_total{severity="critical"} 1'));
      assert.ok(
        text.includes('greentech_http_request_duration_seconds_count{route="/ingestTelemetry",method="POST",status="201"} 2'),
      );
      assert.ok(
        text.includes('greentech_http_request_duration_seconds_count{route="/ingestTelemetry",method="POST",status="401"} 1'),
      );
      assert.match(text, /# TYPE greentech_http_request_duration_seconds histogram/);
    });
  });

  it('con METRICS_TOKEN pide Authorization: Bearer', async () => {
    await withServer({ deviceKey: KEY, now: () => NOW, metricsToken: 'secreto' }, async (base) => {
      assert.equal((await fetch(`${base}/metrics`)).status, 401);
      const ok = await fetch(`${base}/metrics`, { headers: { Authorization: 'Bearer secreto' } });
      assert.equal(ok.status, 200);
    });
  });

  it('agrupa rutas desconocidas como "otra" para no crear series sin límite', () => {
    assert.equal(routeLabel('/ingestTelemetry'), '/ingestTelemetry');
    assert.equal(routeLabel('/wp-admin/login.php'), 'otra');
    const m = createIngestMetrics(() => NOW);
    m.observeRequest('/cualquier-cosa', 'GET', 404, 0.01);
    assert.equal(m.httpDuration.count({ route: 'otra', method: 'GET', status: '404' }), 1);
  });

  it('el histograma es acumulado (lo que espera histogram_quantile)', () => {
    const m = createIngestMetrics(() => NOW);
    m.observeRequest('/ingestTelemetry', 'POST', 201, 0.3);
    const text = m.render();
    assert.ok(text.includes('greentech_http_request_duration_seconds_bucket{route="/ingestTelemetry",method="POST",status="201",le="0.25"} 0'));
    assert.ok(text.includes('greentech_http_request_duration_seconds_bucket{route="/ingestTelemetry",method="POST",status="201",le="0.5"} 1'));
    assert.ok(text.includes('greentech_http_request_duration_seconds_bucket{route="/ingestTelemetry",method="POST",status="201",le="+Inf"} 1'));
  });
});
