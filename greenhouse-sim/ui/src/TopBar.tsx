import { Pause, Play, Plug, RotateCcw, Send, Wifi, WifiOff, Zap, ZapOff } from 'lucide-react';
import type { Snapshot } from '../../simulation.ts';
import type { api as Api } from './api.ts';
import { formatAgo, formatClock } from './format.ts';

interface TopBarProps {
  snapshot: Snapshot;
  connected: boolean;
  run: (action: () => Promise<unknown>) => void;
  api: typeof Api;
}

const SPEEDS = [1, 10, 20, 60, 300];
const INTERVALS = [5, 10, 30, 60];
/** Cuota diaria gratuita de Firestore en el plan Spark. */
const SPARK_WRITES_PER_DAY = 20000;

export function TopBar({ snapshot, connected, run, api }: TopBarProps) {
  const { ingest } = snapshot;
  const ingestOk = ingest.lastError === null && ingest.lastOkAt !== null;
  const ingestState = !connected
    ? { cls: 'dot-off', text: 'Simulador desconectado' }
    : ingest.lastError
      ? { cls: 'dot-red', text: ingest.lastError }
      : ingestOk
        ? { cls: 'dot-green', text: `Último envío ${formatAgo(ingest.lastOkAt, snapshot.realTime)}` }
        : { cls: 'dot-blue', text: 'Esperando el primer envío' };
  const hoursOfQuota = ingest.estWritesPerHour > 0 ? SPARK_WRITES_PER_DAY / ingest.estWritesPerHour : Infinity;
  const intervals = INTERVALS.includes(snapshot.publishIntervalSec)
    ? INTERVALS
    : [...INTERVALS, snapshot.publishIntervalSec].sort((a, b) => a - b);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <div>
          <h1>GreenTech · Simulador de invernadero</h1>
          <p>
            {formatClock(snapshot.simTimeMs)} <span className="dim">hora simulada</span>
          </p>
        </div>
      </div>

      <div className="group" role="group" aria-label="Velocidad de la simulación">
        <button
          className={`chip${snapshot.paused ? ' chip-on' : ''}`}
          onClick={() => run(() => api.settings({ paused: !snapshot.paused }))}
          aria-label={snapshot.paused ? 'Reanudar' : 'Pausar'}
          title={snapshot.paused ? 'Reanudar' : 'Pausar'}
        >
          {snapshot.paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            className={`chip${!snapshot.paused && snapshot.speed === speed ? ' chip-on' : ''}`}
            onClick={() => run(() => api.settings({ speed, paused: false }))}
          >
            x{speed}
          </button>
        ))}
      </div>

      <div className="group" role="group" aria-label="Suministros">
        <button
          className={`chip chip-icon${snapshot.power ? '' : ' chip-alert'}`}
          onClick={() => run(() => api.command({ type: 'power.set', on: !snapshot.power }))}
          title={snapshot.power ? 'Cortar la electricidad' : 'Regresar la electricidad'}
        >
          {snapshot.power ? <Zap size={14} /> : <ZapOff size={14} />}
          {snapshot.power ? 'Electricidad' : 'Sin electricidad'}
        </button>
        <button
          className={`chip chip-icon${snapshot.network ? '' : ' chip-alert'}`}
          onClick={() => run(() => api.command({ type: 'network.set', online: !snapshot.network }))}
          title={snapshot.network ? 'Cortar internet' : 'Regresar internet'}
        >
          {snapshot.network ? <Wifi size={14} /> : <WifiOff size={14} />}
          {snapshot.network ? 'Internet' : 'Sin internet'}
        </button>
      </div>

      <div className="ingest" title={`${ingest.url} · invernadero ${ingest.greenhouseId}`}>
        <div className="ingest-line">
          <span className={`dot ${ingestState.cls}`} aria-hidden="true" />
          <Plug size={13} aria-hidden="true" />
          <strong>{ingest.url.replace(/^https?:\/\//, '')}</strong>
          <span className="dim">
            {ingest.sent} enviadas · {ingest.rejected} rechazadas · cola {ingest.queued}
          </span>
        </div>
        <div className="ingest-line dim ingest-status">{ingestState.text}</div>
      </div>

      <div className="group">
        <label className="field">
          <span>Publica cada</span>
          <select
            value={snapshot.publishIntervalSec}
            onChange={(e) => run(() => api.settings({ publishIntervalSec: Number(e.target.value) }))}
          >
            {intervals.map((s) => (
              <option key={s} value={s}>
                {s} s
              </option>
            ))}
          </select>
        </label>
        <span
          className={`quota${hoursOfQuota < 8 ? ' quota-warn' : ''}`}
          title="Estimado para Firestore: unas 3 escrituras y 10 lecturas por cada lectura publicada. El plan Spark da 20 000 escrituras al día."
        >
          ≈ {ingest.estWritesPerHour.toLocaleString('es-MX')} escrituras/h
          {hoursOfQuota < 24 ? ` · cuota para ${hoursOfQuota.toFixed(0)} h` : ''}
        </span>
        <button className="chip chip-icon" onClick={() => run(api.publishNow)} title="Publicar una lectura ahora">
          <Send size={14} /> Publicar
        </button>
        <button
          className="chip chip-icon"
          onClick={() => run(() => api.command({ type: 'world.reset' }))}
          title="Regresar el invernadero al estado inicial"
        >
          <RotateCcw size={14} /> Reiniciar
        </button>
      </div>
    </header>
  );
}
