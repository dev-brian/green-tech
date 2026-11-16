/**
 * Orquestador del simulador: une el mundo, el escenario en curso, los nodos
 * de sensores y el publicador. No usa temporizadores propios (los pone
 * `server.ts`), así que se puede manejar paso a paso desde las pruebas.
 */

import { buildIngestPayload, measure, type Rng } from './devices/sensorNode.ts';
import {
  DEVICE_LABELS,
  applyCommand,
  describeCommand,
} from './model/commands.ts';
import {
  DEVICE_IDS,
  VARIABLES,
  type AlertLevel,
  type BackendCommands,
  type Command,
  type DeviceFault,
  type DeviceId,
  type HydroponicReadings,
  type HydroponicVariable,
  type Scenario,
  type SensorMode,
  type WorldState,
  type ZoneConfig,
} from './model/types.ts';
import { createWorld, hourOfDay, stepWorld, tankLevelPct, trueReadings } from './model/world.ts';
import type { Publisher } from './publisher/publisher.ts';
import {
  advanceRun,
  isRunFinished,
  runDurationSec,
  startRun,
  stopRun,
  type ScenarioRun,
} from './scenarios/runner.ts';

export type LogKind = 'command' | 'scenario' | 'publish' | 'reject' | 'queue' | 'backend' | 'system';

export interface LogEntry {
  id: number;
  at: number;
  kind: LogKind;
  zoneId?: string;
  text: string;
}

export type NodeLed = 'idle' | 'ok' | 'queued' | 'rejected' | 'off';

export interface ZoneSnapshot {
  id: string;
  name: string;
  crop: string;
  cropLabel: string;
  system: string;
  tank: { levelPct: number; volumeL: number; capacityL: number; ph: number; ec: number; tempC: number; leakLph: number };
  air: { tempC: number; rh: number };
  light: number;
  plants: { rootWetness: number; health: number };
  devices: Record<DeviceId, { fault: DeviceFault; running: boolean }>;
  /** Estado real de las 7 variables (lo que pasa de verdad en el invernadero). */
  truth: HydroponicReadings;
  node: {
    online: boolean;
    led: NodeLed;
    sensors: Record<HydroponicVariable, { mode: SensorMode; bias: number }>;
    /** Última lectura que salió (o intentó salir) por HTTP. */
    lastReadings: HydroponicReadings | null;
    lastSentAt: number | null;
    lastError: string | null;
    queue: number;
  };
  /** Lo que respondió el backend: semáforo, alertas y órdenes de actuadores. */
  backend: {
    levels: Partial<Record<HydroponicVariable, AlertLevel>> | null;
    actuators: BackendCommands | null;
    createdAlerts: number;
    resolvedAlerts: number;
  };
}

export interface Snapshot {
  realTime: number;
  simTimeMs: number;
  hour: number;
  speed: number;
  paused: boolean;
  publishIntervalSec: number;
  nextPublishInSec: number | null;
  env: WorldState['env'];
  power: boolean;
  network: boolean;
  ingest: {
    url: string;
    greenhouseId: string;
    sent: number;
    rejected: number;
    queued: number;
    lastOkAt: number | null;
    lastError: string | null;
    estWritesPerHour: number;
    estReadsPerHour: number;
  };
  zones: ZoneSnapshot[];
  scenario: {
    id: string;
    name: string;
    elapsedSec: number;
    durationSec: number;
    steps: { at: number; label: string; done: boolean; cleanup: boolean }[];
  } | null;
}

interface ZoneRuntime {
  led: NodeLed;
  lastReadings: HydroponicReadings | null;
  lastSentAt: number | null;
  lastError: string | null;
  levels: Partial<Record<HydroponicVariable, AlertLevel>> | null;
  createdAlerts: number;
  resolvedAlerts: number;
}

export interface SimulationOptions {
  publisher: Publisher;
  startTimeMs?: number;
  zones?: ZoneConfig[];
  rng?: Rng;
  speed?: number;
  publishIntervalSec?: number;
}

const ACTUATOR_LABELS: Record<keyof BackendCommands, string> = {
  recirculationPump: DEVICE_LABELS.recirculationPump,
  phDoser: DEVICE_LABELS.phDoser,
  nutrientDoser: DEVICE_LABELS.nutrientDoser,
  ventilation: DEVICE_LABELS.fans,
};

/** Costo aproximado de una lectura en Firestore (ver README del módulo). */
const WRITES_PER_INGEST = 3;
const READS_PER_INGEST = 10;

export const SPEED_LIMITS = { min: 0.1, max: 600 };
export const INTERVAL_LIMITS = { min: 2, max: 3600 };

export class Simulation {
  readonly world: WorldState;
  readonly publisher: Publisher;
  speed: number;
  paused = false;
  publishIntervalSec: number;
  nextPublishAt: number | null = null;

  private run: ScenarioRun | null = null;
  private readonly rng: Rng;
  private readonly runtime = new Map<string, ZoneRuntime>();
  private readonly logEntries: LogEntry[] = [];
  private logSeq = 0;
  private publishing = false;
  onLog: ((entry: LogEntry) => void) | null = null;

  constructor(options: SimulationOptions) {
    this.publisher = options.publisher;
    this.rng = options.rng ?? Math.random;
    this.speed = options.speed ?? 1;
    this.publishIntervalSec = options.publishIntervalSec ?? 60;
    this.world = createWorld(options.startTimeMs ?? Date.now(), options.zones);
    for (const zone of this.world.zones) this.runtime.set(zone.config.id, this.freshRuntime());
  }

  private freshRuntime(): ZoneRuntime {
    return {
      led: 'idle',
      lastReadings: null,
      lastSentAt: null,
      lastError: null,
      levels: null,
      createdAlerts: 0,
      resolvedAlerts: 0,
    };
  }

  get zoneIds(): string[] {
    return this.world.zones.map((z) => z.config.id);
  }

  get log(): LogEntry[] {
    return this.logEntries;
  }

  private addLog(kind: LogKind, text: string, zoneId?: string): void {
    const entry: LogEntry = { id: ++this.logSeq, at: Date.now(), kind, text, zoneId };
    this.logEntries.push(entry);
    if (this.logEntries.length > 300) this.logEntries.shift();
    this.onLog?.(entry);
  }

  /** Avanza la simulación `realDtSec` segundos de reloj real. */
  advance(realDtSec: number): void {
    if (this.paused || realDtSec <= 0) return;
    let remaining = realDtSec * this.speed;
    // En trozos de un minuto simulado para que los pasos del escenario caigan a tiempo.
    while (remaining > 1e-9) {
      const dt = Math.min(remaining, 60);
      if (this.run) {
        advanceRun(this.run, this.world, dt, (command) => {
          this.addLog('scenario', describeCommand(command));
        });
        if (isRunFinished(this.run)) {
          this.addLog('scenario', `Escenario "${this.run.scenario.name}" terminado`);
          this.run = null;
        }
      }
      stepWorld(this.world, dt);
      remaining -= dt;
    }
  }

  /** Aplica un comando ya validado (desde la UI o la API). */
  command(command: Command): void {
    applyCommand(this.world, command);
    if (command.type === 'world.reset') {
      this.run = null;
      this.publisher.clearQueues();
      for (const id of this.zoneIds) this.runtime.set(id, this.freshRuntime());
    }
    this.addLog('command', describeCommand(command));
  }

  startScenario(scenario: Scenario, applySuggestedSpeed = true): void {
    if (this.run) this.stopScenario();
    this.run = startRun(scenario);
    if (applySuggestedSpeed) this.speed = scenario.suggestedSpeed;
    this.paused = false;
    this.addLog('scenario', `Escenario "${scenario.name}" lanzado a x${this.speed}`);
    // Los pasos en t = 0 se aplican de inmediato.
    advanceRun(this.run, this.world, 0, (command) => {
      this.addLog('scenario', describeCommand(command));
    });
  }

  stopScenario(): void {
    if (!this.run) return;
    const name = this.run.scenario.name;
    stopRun(this.run, this.world, (command) => {
      this.addLog('scenario', `${describeCommand(command)} (limpieza)`);
    });
    this.run = null;
    this.addLog('scenario', `Escenario "${name}" detenido`);
  }

  get activeScenarioId(): string | null {
    return this.run?.scenario.id ?? null;
  }

  private applyBackendCommands(zoneId: string, next: BackendCommands): void {
    const zone = this.world.zones.find((z) => z.config.id === zoneId);
    if (!zone) return;
    const prev = zone.backend;
    for (const key of Object.keys(next) as (keyof BackendCommands)[]) {
      // La primera lectura solo se anota si difiere del estado de reposo.
      const before = prev ? prev[key] : key === 'recirculationPump';
      if (before !== next[key]) {
        this.addLog(
          'backend',
          `El backend ordena ${ACTUATOR_LABELS[key].toLowerCase()} ${next[key] ? 'ENCENDIDA' : 'APAGADA'}`,
          zoneId,
        );
      }
    }
    zone.backend = next;
  }

  /**
   * Un ciclo de publicación: cada nodo en línea consulta sus actuadores, mide
   * y envía. La hora de la lectura es siempre la del reloj real.
   */
  async publishCycle(now: Date = new Date()): Promise<void> {
    if (this.publishing) return;
    this.publishing = true;
    try {
      const online = this.world.network.online;
      await Promise.all(
        this.world.zones.map(async (zone) => {
          const zoneId = zone.config.id;
          const rt = this.runtime.get(zoneId) ?? this.freshRuntime();
          this.runtime.set(zoneId, rt);
          if (!zone.node.online) {
            rt.led = 'off';
            return;
          }

          if (online) {
            const actuators = await this.publisher.fetchActuators(zoneId);
            if (actuators) this.applyBackendCommands(zoneId, actuators);
          }

          const readings = measure(zone, this.rng);
          rt.lastReadings = readings;
          const payload = buildIngestPayload(this.publisher.greenhouseId, zone, readings, now);
          const outcomes = await this.publisher.publish(payload, online);

          for (const outcome of outcomes) {
            if (outcome.status === 'sent') {
              rt.led = 'ok';
              rt.lastSentAt = Date.now();
              rt.lastError = null;
              rt.levels = outcome.levels;
              rt.createdAlerts += outcome.createdAlerts;
              rt.resolvedAlerts += outcome.resolvedAlerts;
              const r = outcome.payload.readings;
              const alerts =
                (outcome.createdAlerts ? ` · ${outcome.createdAlerts} alerta(s) nueva(s)` : '') +
                (outcome.resolvedAlerts ? ` · ${outcome.resolvedAlerts} resuelta(s)` : '');
              this.addLog(
                'publish',
                `${outcome.backlog ? 'Reenviada' : 'Enviada'}: pH ${r.ph} · EC ${r.ec} · ${r.airTemp} °C · ${r.light} lux · tanque ${r.tankLevel} %${alerts}`,
                zoneId,
              );
            } else if (outcome.status === 'rejected') {
              rt.led = 'rejected';
              rt.lastError = `${outcome.httpStatus}: ${outcome.error}`;
              this.addLog('reject', `Rechazada (${outcome.httpStatus}): ${outcome.error}`, zoneId);
            } else {
              rt.led = 'queued';
              rt.lastError = outcome.reason;
              this.addLog('queue', `En cola (${outcome.queueSize}): ${outcome.reason}`, zoneId);
            }
          }
        }),
      );
    } finally {
      this.publishing = false;
    }
  }

  snapshot(): Snapshot {
    const world = this.world;
    const onlineNodes = world.zones.filter((z) => z.node.online).length;
    const ingestsPerHour = (onlineNodes * 3600) / this.publishIntervalSec;
    const stats = this.publisher.stats;

    return {
      realTime: Date.now(),
      simTimeMs: world.simTimeMs,
      hour: hourOfDay(world.simTimeMs),
      speed: this.speed,
      paused: this.paused,
      publishIntervalSec: this.publishIntervalSec,
      nextPublishInSec:
        this.nextPublishAt === null ? null : Math.max(0, (this.nextPublishAt - Date.now()) / 1000),
      env: { ...world.env },
      power: world.power.on,
      network: world.network.online,
      ingest: {
        url: this.publisher.ingestUrl,
        greenhouseId: this.publisher.greenhouseId,
        sent: stats.sent,
        rejected: stats.rejected,
        queued: this.publisher.queueSize(),
        lastOkAt: stats.lastOkAt,
        lastError: stats.lastError,
        estWritesPerHour: Math.round(ingestsPerHour * WRITES_PER_INGEST),
        estReadsPerHour: Math.round(ingestsPerHour * READS_PER_INGEST),
      },
      zones: world.zones.map((zone) => {
        const rt = this.runtime.get(zone.config.id) ?? this.freshRuntime();
        const devices = {} as ZoneSnapshot['devices'];
        for (const id of DEVICE_IDS) {
          devices[id] = { fault: zone.devices[id].fault, running: zone.devices[id].running };
        }
        const sensors = {} as ZoneSnapshot['node']['sensors'];
        for (const key of VARIABLES) {
          sensors[key] = { mode: zone.node.sensors[key].mode, bias: zone.node.sensors[key].bias };
        }
        return {
          id: zone.config.id,
          name: zone.config.name,
          crop: zone.config.crop,
          cropLabel: zone.config.cropLabel,
          system: zone.config.system,
          tank: {
            levelPct: tankLevelPct(zone),
            volumeL: zone.tank.volumeL,
            capacityL: zone.config.tankCapacityL,
            ph: zone.tank.ph,
            ec: zone.tank.ec,
            tempC: zone.tank.tempC,
            leakLph: zone.tank.leakLph,
          },
          air: { ...zone.air },
          light: zone.light,
          plants: { ...zone.plants },
          devices,
          truth: trueReadings(zone),
          node: {
            online: zone.node.online,
            led: zone.node.online ? rt.led : 'off',
            sensors,
            lastReadings: rt.lastReadings,
            lastSentAt: rt.lastSentAt,
            lastError: rt.lastError,
            queue: this.publisher.queueSize(zone.config.id),
          },
          backend: {
            levels: rt.levels,
            actuators: zone.backend,
            createdAlerts: rt.createdAlerts,
            resolvedAlerts: rt.resolvedAlerts,
          },
        };
      }),
      scenario: this.run
        ? {
            id: this.run.scenario.id,
            name: this.run.scenario.name,
            elapsedSec: this.run.elapsedSec,
            durationSec: runDurationSec(this.run),
            steps: this.run.steps.map((step, i) => ({
              at: step.at,
              label: describeCommand(step.command),
              done: this.run?.fired[i] ?? false,
              cleanup: step.cleanup === true,
            })),
          }
        : null,
    };
  }
}
