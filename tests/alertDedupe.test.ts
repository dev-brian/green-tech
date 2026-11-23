/**
 * Auditoría C4 — Atender una alerta no debe provocar una avalancha.
 *
 * Antes el motor buscaba la alerta activa con `status == 'new'`. Al marcarla
 * como atendida, la siguiente lectura fuera de rango creaba otra (con push si
 * era crítica). Ahora una alerta sigue abierta hasta tener `resolvedAt`, y solo
 * se cierra cuando el valor vuelve al rango con margen (histéresis).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  InMemoryTelemetryStorage,
  decideAlertChange,
  isAlertOpen,
  isClearOfThreshold,
  processIngestedReading,
  type AlertRecord,
} from '../simulator/core/alertAndActuatorEngine.ts';
import { DEFAULT_CROP_THRESHOLDS } from '../simulator/core/hydroponicModel.ts';
import { RecordingPushNotifier } from '../simulator/core/pushNotifier.ts';

const GH = 'gh-c4';
const base = { airTemp: 23, humidity: 65, light: 28000, ph: 6.0, ec: 2.6, solutionTemp: 21, tankLevel: 80 };
const phRange = DEFAULT_CROP_THRESHOLDS.jitomate.ph; // 5.0 / 5.5–6.5 / 7.0

function makeIngest(storage: InMemoryTelemetryStorage, notifier = new RecordingPushNotifier()) {
  let minute = 0;
  const ingest = (readings: Partial<typeof base>) =>
    processIngestedReading(
      {
        greenhouseId: GH,
        zoneId: 'zona-1',
        crop: 'jitomate',
        timestamp: new Date(Date.UTC(2026, 10, 17, 12, minute++)).toISOString(),
        readings: { ...base, ...readings },
      },
      storage,
      notifier,
    );
  return { ingest, notifier };
}

function attend(storage: InMemoryTelemetryStorage, id: string) {
  const alert = storage.alerts[GH].find((a) => a.id === id)!;
  Object.assign(alert, { status: 'attended', attendedBy: 'uid-op', attendedAt: '2026-11-17T12:00:30.000Z' });
}

describe('C4 — una sola alerta abierta por zona y variable', () => {
  it('atender la alerta no crea otra mientras el valor siga fuera de rango', async () => {
    const storage = new InMemoryTelemetryStorage();
    const { ingest, notifier } = makeIngest(storage);

    const first = await ingest({ ph: 7.5 });
    assert.equal(first.createdAlerts.length, 1);
    assert.equal(notifier.calls.length, 1);
    attend(storage, first.createdAlerts[0].id);

    for (let i = 0; i < 60; i++) {
      const r = await ingest({ ph: 7.5 + (i % 3) * 0.05 });
      assert.equal(r.createdAlerts.length, 0, `lectura ${i}: no debe crear otra alerta`);
    }
    assert.equal(storage.alerts[GH].length, 1, 'una hora de lecturas = una sola alerta');
    assert.equal(notifier.calls.length, 1, 'y un solo push');
    assert.equal(storage.alerts[GH][0].status, 'attended', 'sigue atendida');
  });

  it('una alerta atendida se cierra sola cuando el valor vuelve a rango', async () => {
    const storage = new InMemoryTelemetryStorage();
    const { ingest } = makeIngest(storage);

    const first = await ingest({ ph: 6.8 });
    attend(storage, first.createdAlerts[0].id);
    const back = await ingest({ ph: 6.0 });

    assert.deepEqual(back.resolvedAlertIds, [first.createdAlerts[0].id]);
    const alert = storage.alerts[GH][0];
    assert.equal(alert.status, 'auto_resolved');
    assert.ok(alert.resolvedAt);
    assert.equal(alert.attendedBy, 'uid-op', 'conserva quién la revisó');

    // Si vuelve a salir de rango es un episodio nuevo.
    const again = await ingest({ ph: 6.8 });
    assert.equal(again.createdAlerts.length, 1);
    assert.equal(storage.alerts[GH].length, 2);
  });

  it('una alerta atendida que sube a crítico vuelve a "new" y avisa una vez', async () => {
    const storage = new InMemoryTelemetryStorage();
    const { ingest, notifier } = makeIngest(storage);

    const warn = await ingest({ ph: 6.8 });
    attend(storage, warn.createdAlerts[0].id);
    assert.equal(notifier.calls.length, 0);

    await ingest({ ph: 7.4 });
    await ingest({ ph: 7.5 });
    assert.equal(storage.alerts[GH].length, 1);
    assert.equal(storage.alerts[GH][0].severity, 'critical');
    assert.equal(storage.alerts[GH][0].status, 'new', 'el equipo la vuelve a ver');
    assert.equal(notifier.calls.length, 1, 'un solo push al escalar');
  });

  it('un valor que oscila en el límite no abre y cierra alertas sin parar', async () => {
    const storage = new InMemoryTelemetryStorage();
    const { ingest } = makeIngest(storage);

    // 6.52 está fuera (> 6.5); 6.48 está dentro pero sin margen (6.5 - 0.05 = 6.45).
    for (let i = 0; i < 20; i++) await ingest({ ph: i % 2 === 0 ? 6.52 : 6.48 });
    assert.equal(storage.alerts[GH].length, 1);
    assert.ok(isAlertOpen(storage.alerts[GH][0]), 'sigue abierta mientras no entre con margen');

    const r = await ingest({ ph: 6.4 });
    assert.equal(r.resolvedAlertIds.length, 1);
  });

  it('variables distintas o zonas distintas tienen cada una su alerta', async () => {
    const storage = new InMemoryTelemetryStorage();
    const { ingest } = makeIngest(storage);
    await ingest({ ph: 7.5, ec: 1.0 });
    await ingest({ ph: 7.5, ec: 1.0 });
    assert.equal(storage.alerts[GH].length, 2);
    await processIngestedReading(
      { greenhouseId: GH, zoneId: 'zona-2', crop: 'jitomate', timestamp: '2026-11-17T13:00:00.000Z', readings: { ...base, ph: 7.5 } },
      storage,
    );
    assert.equal(storage.alerts[GH].length, 3);
  });
});

describe('C4 — histéresis (isClearOfThreshold)', () => {
  it('pide el margen solo del lado por el que salió', () => {
    // Salió por arriba (7.0): para cerrar debe bajar a 6.45 o menos.
    assert.equal(isClearOfThreshold(6.48, phRange, 7.0), false);
    assert.equal(isClearOfThreshold(6.45, phRange, 7.0), true);
    // El lado contrario no exige margen.
    assert.equal(isClearOfThreshold(5.5, phRange, 7.0), true);
    // Salió por abajo (5.2): debe subir a 5.55 o más.
    assert.equal(isClearOfThreshold(5.52, phRange, 5.2), false);
    assert.equal(isClearOfThreshold(5.55, phRange, 5.2), true);
  });

  it('el tanque lleno (100 %) cierra una alerta de nivel bajo', () => {
    const tank = DEFAULT_CROP_THRESHOLDS.jitomate.tankLevel; // 40–100
    assert.equal(isClearOfThreshold(100, tank, 30), true);
    assert.equal(isClearOfThreshold(41, tank, 30), false);
    assert.equal(isClearOfThreshold(43, tank, 30), true);
  });

  it('si los umbrales cambiaron y el valor que la disparó ya está en rango, cierra sin margen', () => {
    const tank = DEFAULT_CROP_THRESHOLDS.jitomate.tankLevel;
    // La alerta se abrió con 45 % bajo un umbral anterior más estricto; hoy 45 está en rango.
    assert.equal(isClearOfThreshold(100, tank, 45), true, 'el tanque lleno debe cerrarla');
    assert.equal(isClearOfThreshold(40, tank, 45), true);
    assert.equal(isClearOfThreshold(39, tank, 45), false);
  });
});

describe('C4 — decideAlertChange', () => {
  const open: AlertRecord = {
    id: 'a1',
    zoneId: 'zona-1',
    variable: 'ph',
    severity: 'critical',
    value: 7.5,
    message: '',
    status: 'attended',
    createdAt: '2026-11-17T12:00:00.000Z',
    attendedBy: 'uid-op',
    attendedAt: '2026-11-17T12:01:00.000Z',
    resolvedAt: null,
  };
  const reading = (value: number, level: 'ok' | 'warn' | 'critical') => ({
    zoneId: 'zona-1',
    variable: 'ph' as const,
    value,
    level,
    range: phRange,
    message: 'm',
    timestamp: '2026-11-17T12:05:00.000Z',
  });

  it('no hace nada con una alerta atendida que sigue fuera de rango', () => {
    assert.deepEqual(decideAlertChange(open, reading(7.6, 'critical')), { kind: 'none' });
    assert.deepEqual(decideAlertChange(open, reading(6.8, 'warn')), { kind: 'none' });
  });

  it('una alerta con resolvedAt ya no cuenta como abierta', () => {
    assert.equal(isAlertOpen({ status: 'attended', resolvedAt: '2026-11-17T12:00:00.000Z' }), false);
    assert.equal(isAlertOpen({ status: 'auto_resolved', resolvedAt: null }), false);
    assert.equal(isAlertOpen({ status: 'attended', resolvedAt: null }), true);
  });
});
