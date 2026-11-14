import { useEffect, useState } from 'react';
import { Play, Plus, Square, Trash2, X } from 'lucide-react';
import {
  DEVICE_LABELS,
  FAULT_LABELS,
  SENSOR_MODE_LABELS,
  VARIABLE_LABELS,
  describeCommand,
} from '../../model/commands.ts';
import {
  DEVICE_IDS,
  SENSOR_MODES,
  VARIABLES,
  type Command,
  type CommandType,
  type DeviceFault,
  type DeviceId,
  type HydroponicVariable,
  type Scenario,
  type SensorMode,
} from '../../model/types.ts';
import type { LogEntry, Snapshot, ZoneSnapshot } from '../../simulation.ts';
import { api } from './api.ts';
import { formatDuration, formatTime, formatValue } from './format.ts';
import type { Selection } from './Scene.tsx';

export type PanelTab = 'scenarios' | 'inspector' | 'log';
type Run = (action: () => Promise<unknown>) => void;

interface SidePanelProps {
  snapshot: Snapshot;
  log: LogEntry[];
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  run: Run;
}

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'scenarios', label: 'Escenarios' },
  { id: 'inspector', label: 'Inspector' },
  { id: 'log', label: 'Bitácora' },
];

export function SidePanel({ snapshot, log, tab, onTab, selection, onSelect, run }: SidePanelProps) {
  return (
    <aside className="panel">
      <div className="tabs" role="tablist" aria-label="Panel de control">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab${tab === t.id ? ' tab-on' : ''}`}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="panel-body" role="tabpanel">
        {tab === 'scenarios' && <ScenariosTab snapshot={snapshot} run={run} />}
        {tab === 'inspector' && (
          <InspectorTab snapshot={snapshot} selection={selection} onSelect={onSelect} run={run} />
        )}
        {tab === 'log' && <LogTab log={log} />}
      </div>
    </aside>
  );
}

// ── Escenarios ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<Scenario['category'], string> = {
  demo: 'Para presentar',
  solucion: 'Solución nutritiva',
  equipos: 'Equipos',
  energia: 'Energía',
  clima: 'Clima',
  red: 'Conexión',
  sensores: 'Sensores',
  propio: 'Mis escenarios',
};
const CATEGORY_ORDER: Scenario['category'][] = [
  'demo', 'solucion', 'equipos', 'energia', 'clima', 'red', 'sensores', 'propio',
];

function ScenariosTab({ snapshot, run }: { snapshot: Snapshot; run: Run }) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [building, setBuilding] = useState(false);
  const reload = () => api.scenarios().then(setScenarios);

  useEffect(() => {
    let alive = true;
    api
      .scenarios()
      .then((list) => alive && setScenarios(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const active = snapshot.scenario;
  const zoneIds = snapshot.zones.map((z) => z.id);

  return (
    <div className="stack">
      {active && (
        <section className="card card-active" aria-label="Escenario en curso">
          <header className="card-head">
            <div>
              <span className="eyebrow">En curso</span>
              <h3>{active.name}</h3>
            </div>
            <button className="btn btn-danger" onClick={() => run(api.stopScenario)}>
              <Square size={13} /> Detener
            </button>
          </header>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((100 * active.elapsedSec) / Math.max(1, active.durationSec))}
          >
            <span style={{ width: `${Math.min(100, (100 * active.elapsedSec) / Math.max(1, active.durationSec))}%` }} />
          </div>
          <p className="dim small">
            {formatDuration(active.elapsedSec)} de {formatDuration(active.durationSec)} simulados
          </p>
          <ol className="timeline">
            {active.steps.map((step, i) => (
              <li key={i} className={step.done ? 'done' : ''}>
                <span className="timeline-at">{formatDuration(step.at)}</span>
                <span>{step.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {building ? (
        <ScenarioBuilder
          zoneIds={zoneIds}
          onCancel={() => setBuilding(false)}
          onSave={(scenario) =>
            run(async () => {
              await api.saveScenario(scenario);
              await reload();
              setBuilding(false);
            })
          }
        />
      ) : (
        <button className="btn btn-ghost btn-wide" onClick={() => setBuilding(true)}>
          <Plus size={14} /> Crear escenario propio
        </button>
      )}

      {CATEGORY_ORDER.map((category) => {
        const items = scenarios.filter((s) => s.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="stack-tight">
            <h2 className="section-title">{CATEGORY_LABELS[category]}</h2>
            {items.map((scenario) => (
              <article key={scenario.id} className={`card${active?.id === scenario.id ? ' card-running' : ''}`}>
                <header className="card-head">
                  <h3>{scenario.name}</h3>
                  <div className="row">
                    {!scenario.builtin && (
                      <button
                        className="icon-btn"
                        aria-label={`Borrar ${scenario.name}`}
                        title="Borrar"
                        onClick={() =>
                          run(async () => {
                            await api.deleteScenario(scenario.id);
                            await reload();
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button className="btn btn-primary" onClick={() => run(() => api.runScenario(scenario.id))}>
                      <Play size={13} /> x{scenario.suggestedSpeed}
                    </button>
                  </div>
                </header>
                {scenario.description && <p>{scenario.description}</p>}
                {scenario.expect && (
                  <p className="expect">
                    <strong>En la PWA y la app:</strong> {scenario.expect}
                  </p>
                )}
                {!scenario.builtin && (
                  <ol className="timeline timeline-static">
                    {scenario.steps.map((step, i) => (
                      <li key={i}>
                        <span className="timeline-at">{formatDuration(step.at)}</span>
                        <span>{describeCommand(step.command)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

// ── Constructor de escenarios ───────────────────────────────────────────

type Quantity = 'dPh' | 'dEc' | 'dLiters' | 'dTemp';

interface DraftStep {
  minute: number;
  type: CommandType;
  zone: string;
  device: DeviceId;
  fault: DeviceFault;
  on: boolean;
  quantity: Quantity;
  amount: number;
  variable: HydroponicVariable;
  mode: SensorMode;
}

const STEP_TYPES: { type: CommandType; label: string }[] = [
  { type: 'device.fault', label: 'Falla o reparación de un equipo' },
  { type: 'tank.disturb', label: 'Alterar el tanque' },
  { type: 'tank.leak', label: 'Fuga en el tanque' },
  { type: 'power.set', label: 'Electricidad' },
  { type: 'network.set', label: 'Internet' },
  { type: 'env.set', label: 'Temperatura exterior' },
  { type: 'sensor.fault', label: 'Falla de una sonda' },
  { type: 'node.set', label: 'Nodo de sensores' },
  { type: 'clock.set', label: 'Mover el reloj' },
];

const QUANTITY_LABELS: Record<Quantity, string> = {
  dPh: 'pH',
  dEc: 'EC (mS/cm)',
  dLiters: 'Litros',
  dTemp: 'Temperatura (°C)',
};

function newStep(zone: string, minute: number): DraftStep {
  return {
    minute,
    type: 'device.fault',
    zone,
    device: 'recirculationPump',
    fault: 'failed',
    on: false,
    quantity: 'dPh',
    amount: 1,
    variable: 'ph',
    mode: 'bias',
  };
}

function draftToCommand(step: DraftStep): Command {
  switch (step.type) {
    case 'device.fault':
      return { type: 'device.fault', zone: step.zone, device: step.device, fault: step.fault };
    case 'tank.disturb':
      return { type: 'tank.disturb', zone: step.zone, [step.quantity]: step.amount };
    case 'tank.leak':
      return { type: 'tank.leak', zone: step.zone, litersPerHour: Math.max(0, step.amount) };
    case 'power.set':
      return { type: 'power.set', on: step.on };
    case 'network.set':
      return { type: 'network.set', online: step.on };
    case 'env.set':
      return { type: 'env.set', tempOffset: step.amount };
    case 'sensor.fault':
      return { type: 'sensor.fault', zone: step.zone, variable: step.variable, mode: step.mode, bias: step.amount };
    case 'node.set':
      return { type: 'node.set', zone: step.zone, online: step.on };
    case 'clock.set':
      return { type: 'clock.set', hour: Math.max(0, Math.min(23.99, step.amount)) };
    default:
      return { type: 'world.reset' };
  }
}

interface BuilderProps {
  zoneIds: string[];
  onCancel: () => void;
  onSave: (scenario: Partial<Scenario>) => void;
}

function ScenarioBuilder({ zoneIds, onCancel, onSave }: BuilderProps) {
  const [name, setName] = useState('');
  const [speed, setSpeed] = useState(60);
  const [steps, setSteps] = useState<DraftStep[]>([newStep(zoneIds[0], 0)]);

  const update = (i: number, patch: Partial<DraftStep>) =>
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const needsZone = (t: CommandType) =>
    t === 'device.fault' || t === 'tank.disturb' || t === 'tank.leak' || t === 'sensor.fault' || t === 'node.set';
  const amountLabel = (s: DraftStep): string | null => {
    if (s.type === 'tank.disturb') return 'Cambio';
    if (s.type === 'tank.leak') return 'L/h (0 repara)';
    if (s.type === 'env.set') return '°C sobre lo normal';
    if (s.type === 'clock.set') return 'Hora (0–23)';
    if (s.type === 'sensor.fault' && s.mode === 'bias') return 'Desfase';
    return null;
  };

  return (
    <section className="card builder" aria-label="Nuevo escenario">
      <header className="card-head">
        <h3>Nuevo escenario</h3>
        <button className="icon-btn" onClick={onCancel} aria-label="Cancelar">
          <X size={15} />
        </button>
      </header>
      <label className="field field-col">
        <span>Nombre</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Falla doble en zona 2" maxLength={80} />
      </label>
      <label className="field field-col">
        <span>Velocidad al lanzarlo</span>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          {[1, 10, 20, 60, 300].map((v) => (
            <option key={v} value={v}>
              x{v}
            </option>
          ))}
        </select>
      </label>

      {steps.map((step, i) => {
        const amount = amountLabel(step);
        return (
          <fieldset key={i} className="step">
            <legend>
              Paso {i + 1}
              {steps.length > 1 && (
                <button
                  className="icon-btn"
                  onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Quitar paso ${i + 1}`}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </legend>
            <div className="step-grid">
              <label className="field field-col">
                <span>Minuto simulado</span>
                <input type="number" min={0} step={1} value={step.minute} onChange={(e) => update(i, { minute: Number(e.target.value) })} />
              </label>
              <label className="field field-col span-2">
                <span>Qué pasa</span>
                <select value={step.type} onChange={(e) => update(i, { type: e.target.value as CommandType })}>
                  {STEP_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              {needsZone(step.type) && (
                <label className="field field-col">
                  <span>Zona</span>
                  <select value={step.zone} onChange={(e) => update(i, { zone: e.target.value })}>
                    {zoneIds.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                    <option value="all">Todas</option>
                  </select>
                </label>
              )}
              {step.type === 'device.fault' && (
                <>
                  <label className="field field-col">
                    <span>Equipo</span>
                    <select value={step.device} onChange={(e) => update(i, { device: e.target.value as DeviceId })}>
                      {DEVICE_IDS.map((id) => (
                        <option key={id} value={id}>
                          {DEVICE_LABELS[id]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field field-col">
                    <span>Estado</span>
                    <select value={step.fault} onChange={(e) => update(i, { fault: e.target.value as DeviceFault })}>
                      <option value="failed">Falla (no responde)</option>
                      <option value="stuckOn">Pegada encendida</option>
                      <option value="none">Reparada</option>
                    </select>
                  </label>
                </>
              )}
              {step.type === 'tank.disturb' && (
                <label className="field field-col">
                  <span>Variable</span>
                  <select value={step.quantity} onChange={(e) => update(i, { quantity: e.target.value as Quantity })}>
                    {(Object.keys(QUANTITY_LABELS) as Quantity[]).map((q) => (
                      <option key={q} value={q}>
                        {QUANTITY_LABELS[q]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {step.type === 'sensor.fault' && (
                <>
                  <label className="field field-col">
                    <span>Sonda</span>
                    <select value={step.variable} onChange={(e) => update(i, { variable: e.target.value as HydroponicVariable })}>
                      {VARIABLES.map((v) => (
                        <option key={v} value={v}>
                          {VARIABLE_LABELS[v].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field field-col">
                    <span>Estado</span>
                    <select value={step.mode} onChange={(e) => update(i, { mode: e.target.value as SensorMode })}>
                      {SENSOR_MODES.map((m) => (
                        <option key={m} value={m}>
                          {SENSOR_MODE_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {(step.type === 'power.set' || step.type === 'network.set' || step.type === 'node.set') && (
                <label className="field field-col">
                  <span>Estado</span>
                  <select value={step.on ? 'on' : 'off'} onChange={(e) => update(i, { on: e.target.value === 'on' })}>
                    <option value="off">Se corta / se apaga</option>
                    <option value="on">Regresa / se enciende</option>
                  </select>
                </label>
              )}
              {amount && (
                <label className="field field-col">
                  <span>{amount}</span>
                  <input type="number" step="0.1" value={step.amount} onChange={(e) => update(i, { amount: Number(e.target.value) })} />
                </label>
              )}
            </div>
            <p className="dim small">{describeCommand(draftToCommand(step))}</p>
          </fieldset>
        );
      })}

      <div className="row row-between">
        <button
          className="btn btn-ghost"
          onClick={() => setSteps((prev) => [...prev, newStep(zoneIds[0], (prev[prev.length - 1]?.minute ?? 0) + 10)])}
        >
          <Plus size={13} /> Agregar paso
        </button>
        <button
          className="btn btn-primary"
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              suggestedSpeed: speed,
              description: '',
              expect: '',
              steps: steps.map((s) => ({ at: Math.max(0, s.minute) * 60, command: draftToCommand(s) })),
            })
          }
        >
          Guardar
        </button>
      </div>
    </section>
  );
}

// ── Inspector ───────────────────────────────────────────────────────────

/** Desfase razonable al descalibrar cada sonda desde el inspector. */
const DEFAULT_BIAS: Record<HydroponicVariable, number> = {
  airTemp: 5,
  humidity: 15,
  light: 15000,
  ph: 0.8,
  ec: 0.6,
  solutionTemp: 4,
  tankLevel: -25,
};

interface InspectorProps {
  snapshot: Snapshot;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  run: Run;
}

function InspectorTab({ snapshot, selection, onSelect, run }: InspectorProps) {
  const zone = selection ? snapshot.zones.find((z) => z.id === selection.zoneId) : undefined;
  const send = (command: Command) => run(() => api.command(command));

  return (
    <div className="stack">
      {!zone || !selection ? (
        <section className="card">
          <h3>Nada seleccionado</h3>
          <p>Haz clic en un equipo del dibujo (bomba, tanque, dosificadora, ventilador, lámparas o nodo) para ver su estado y provocarle una falla.</p>
          <div className="quick-grid">
            {snapshot.zones.map((z) => (
              <button key={z.id} className="btn btn-ghost" onClick={() => onSelect({ zoneId: z.id, target: 'tank' })}>
                Tanque de {z.name}
              </button>
            ))}
          </div>
        </section>
      ) : selection.target === 'tank' ? (
        <TankInspector zone={zone} send={send} />
      ) : selection.target === 'node' ? (
        <NodeInspector zone={zone} send={send} />
      ) : (
        <DeviceInspector zone={zone} device={selection.target} power={snapshot.power} send={send} />
      )}

      <section className="card">
        <h3>Clima y reloj</h3>
        <p className="dim small">
          Exterior {snapshot.env.outsideTemp.toFixed(1)} °C · {snapshot.env.outsideRh.toFixed(0)} % HR · nubosidad{' '}
          {Math.round(snapshot.env.cloud * 100)} %
        </p>
        <span className="eyebrow">Temperatura exterior</span>
        <div className="quick-grid">
          {[-8, 0, 6, 12].map((offset) => (
            <button
              key={offset}
              className={`btn btn-ghost${snapshot.env.tempOffset === offset ? ' btn-on' : ''}`}
              onClick={() => send({ type: 'env.set', tempOffset: offset })}
            >
              {offset === 0 ? 'Normal' : `${offset > 0 ? '+' : ''}${offset} °C`}
            </button>
          ))}
        </div>
        <span className="eyebrow">Cielo</span>
        <div className="quick-grid">
          {[
            [0, 'Despejado'],
            [0.5, 'Medio nublado'],
            [1, 'Cerrado'],
          ].map(([cloud, label]) => (
            <button
              key={label}
              className={`btn btn-ghost${snapshot.env.cloud === cloud ? ' btn-on' : ''}`}
              onClick={() => send({ type: 'env.set', cloud: cloud as number })}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="eyebrow">Mover el reloj simulado</span>
        <div className="quick-grid">
          {[
            [6, 'Amanecer'],
            [12, 'Mediodía'],
            [20, 'Noche'],
          ].map(([hour, label]) => (
            <button key={label} className="btn btn-ghost" onClick={() => send({ type: 'clock.set', hour: hour as number })}>
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

type Send = (command: Command) => void;

function DeviceInspector({ zone, device, power, send }: { zone: ZoneSnapshot; device: DeviceId; power: boolean; send: Send }) {
  const state = zone.devices[device];
  const backend = zone.backend.actuators;
  const backendOrder: boolean | null =
    !backend
      ? null
      : device === 'recirculationPump'
        ? backend.recirculationPump
        : device === 'phDoser'
          ? backend.phDoser
          : device === 'nutrientDoser'
            ? backend.nutrientDoser
            : device === 'fans'
              ? backend.ventilation
              : null;
  const setFault = (fault: DeviceFault) => send({ type: 'device.fault', zone: zone.id, device, fault });

  return (
    <section className="card">
      <span className="eyebrow">{zone.name}</span>
      <h3>{DEVICE_LABELS[device]}</h3>
      <dl className="facts">
        <dt>Ahora</dt>
        <dd className={state.running ? 'ok' : ''}>{state.running ? 'Funcionando' : 'Detenida'}</dd>
        <dt>Condición</dt>
        <dd className={state.fault === 'none' ? '' : 'bad'}>{FAULT_LABELS[state.fault]}</dd>
        {backendOrder !== null && (
          <>
            <dt>Orden del backend</dt>
            <dd>{backendOrder ? 'Encendida' : 'Apagada'}</dd>
          </>
        )}
        {!power && (
          <>
            <dt>Energía</dt>
            <dd className="bad">Sin electricidad</dd>
          </>
        )}
      </dl>
      <div className="quick-grid">
        <button className={`btn btn-danger${state.fault === 'failed' ? ' btn-on' : ''}`} onClick={() => setFault('failed')}>
          Provocar falla
        </button>
        <button className={`btn btn-warn${state.fault === 'stuckOn' ? ' btn-on' : ''}`} onClick={() => setFault('stuckOn')}>
          Dejar pegada
        </button>
        <button className="btn btn-primary" disabled={state.fault === 'none'} onClick={() => setFault('none')}>
          Reparar
        </button>
      </div>
      {device === 'recirculationPump' && (
        <p className="dim small">
          La PWA no recibe una alerta directa por esta falla: ninguna de las 7 variables del contrato mide flujo. Se nota por el
          nivel del tanque y porque pH y EC dejan de moverse.
        </p>
      )}
    </section>
  );
}

function TankInspector({ zone, send }: { zone: ZoneSnapshot; send: Send }) {
  const disturb = (patch: Partial<Extract<Command, { type: 'tank.disturb' }>>) =>
    send({ type: 'tank.disturb', zone: zone.id, ...patch });
  return (
    <section className="card">
      <span className="eyebrow">{zone.name}</span>
      <h3>Tanque de solución</h3>
      <dl className="facts">
        <dt>Nivel</dt>
        <dd>
          {zone.tank.levelPct.toFixed(1)} % ({zone.tank.volumeL.toFixed(0)} de {zone.tank.capacityL} L)
        </dd>
        <dt>pH</dt>
        <dd>{zone.tank.ph.toFixed(2)}</dd>
        <dt>EC</dt>
        <dd>{zone.tank.ec.toFixed(2)} mS/cm</dd>
        <dt>Temperatura</dt>
        <dd>{zone.tank.tempC.toFixed(1)} °C</dd>
        <dt>Fuga</dt>
        <dd className={zone.tank.leakLph > 0 ? 'bad' : ''}>{zone.tank.leakLph > 0 ? `${zone.tank.leakLph} L/h` : 'No'}</dd>
        <dt>Salud del cultivo</dt>
        <dd>{zone.plants.health.toFixed(0)} %</dd>
      </dl>
      <span className="eyebrow">Alterar ahora</span>
      <div className="quick-grid">
        <button className="btn btn-ghost" onClick={() => disturb({ dPh: 0.5 })}>pH +0.5</button>
        <button className="btn btn-ghost" onClick={() => disturb({ dPh: -0.5 })}>pH −0.5</button>
        <button className="btn btn-ghost" onClick={() => disturb({ dEc: 0.5 })}>EC +0.5</button>
        <button className="btn btn-ghost" onClick={() => disturb({ dEc: -0.5 })}>EC −0.5</button>
        <button className="btn btn-ghost" onClick={() => disturb({ dLiters: -40 })}>Vaciar 40 L</button>
        <button className="btn btn-ghost" onClick={() => disturb({ dLiters: 40 })}>Agregar 40 L</button>
        <button className="btn btn-ghost" onClick={() => disturb({ dTemp: 4 })}>+4 °C</button>
        <button className="btn btn-ghost" onClick={() => disturb({ dTemp: -4 })}>−4 °C</button>
      </div>
      <div className="quick-grid">
        {zone.tank.leakLph > 0 ? (
          <button className="btn btn-primary" onClick={() => send({ type: 'tank.leak', zone: zone.id, litersPerHour: 0 })}>
            Reparar fuga
          </button>
        ) : (
          <button className="btn btn-danger" onClick={() => send({ type: 'tank.leak', zone: zone.id, litersPerHour: 150 })}>
            Provocar fuga (150 L/h)
          </button>
        )}
      </div>
    </section>
  );
}

function NodeInspector({ zone, send }: { zone: ZoneSnapshot; send: Send }) {
  const { node } = zone;
  return (
    <section className="card">
      <span className="eyebrow">{zone.name}</span>
      <h3>Nodo de sensores</h3>
      <dl className="facts">
        <dt>Estado</dt>
        <dd className={node.online ? 'ok' : 'bad'}>{node.online ? 'Encendido' : 'Apagado'}</dd>
        <dt>Cola sin enviar</dt>
        <dd>{node.queue}</dd>
        {node.lastError && (
          <>
            <dt>Último problema</dt>
            <dd className="bad">{node.lastError}</dd>
          </>
        )}
      </dl>
      <div className="quick-grid">
        <button
          className={node.online ? 'btn btn-danger' : 'btn btn-primary'}
          onClick={() => send({ type: 'node.set', zone: zone.id, online: !node.online })}
        >
          {node.online ? 'Apagar nodo' : 'Encender nodo'}
        </button>
      </div>
      <span className="eyebrow">Sondas</span>
      <table className="sensors">
        <thead>
          <tr>
            <th scope="col">Sonda</th>
            <th scope="col">Real</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {VARIABLES.map((key) => (
            <tr key={key}>
              <th scope="row">{VARIABLE_LABELS[key].label}</th>
              <td>{formatValue(key, zone.truth[key])}</td>
              <td>
                <select
                  aria-label={`Estado de la sonda de ${VARIABLE_LABELS[key].label}`}
                  className={node.sensors[key].mode === 'ok' ? '' : 'select-bad'}
                  value={node.sensors[key].mode}
                  onChange={(e) =>
                    send({
                      type: 'sensor.fault',
                      zone: zone.id,
                      variable: key,
                      mode: e.target.value as SensorMode,
                      bias: DEFAULT_BIAS[key],
                    })
                  }
                >
                  {SENSOR_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {SENSOR_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ── Bitácora ────────────────────────────────────────────────────────────

const KIND_LABELS: Record<LogEntry['kind'], string> = {
  command: 'Manual',
  scenario: 'Escenario',
  publish: 'Envío',
  reject: 'Rechazo',
  queue: 'Cola',
  backend: 'Backend',
  system: 'Sistema',
};

function LogTab({ log }: { log: LogEntry[] }) {
  const [hidePublish, setHidePublish] = useState(false);
  const entries = (hidePublish ? log.filter((e) => e.kind !== 'publish') : log).slice().reverse();
  return (
    <div className="stack-tight">
      <label className="check">
        <input type="checkbox" checked={hidePublish} onChange={(e) => setHidePublish(e.target.checked)} />
        Ocultar envíos normales
      </label>
      {entries.length === 0 ? (
        <p className="dim">Todavía no hay eventos.</p>
      ) : (
        <ol className="log" aria-live="polite">
          {entries.map((entry) => (
            <li key={entry.id} className={`log-${entry.kind}`}>
              <span className="log-meta">
                <time>{formatTime(entry.at)}</time>
                <span className="log-kind">{KIND_LABELS[entry.kind]}</span>
                {entry.zoneId && <span className="log-zone">{entry.zoneId}</span>}
              </span>
              <span>{entry.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
