/**
 * Lo que salió por HTTP de cada nodo y lo que respondió el backend. El color
 * es el `level` que calculó la ingesta: el simulador no evalúa umbrales.
 */

import { VARIABLE_LABELS } from '../../model/commands.ts';
import { VARIABLES } from '../../model/types.ts';
import type { Snapshot, ZoneSnapshot } from '../../simulation.ts';
import { formatAgo, formatValue } from './format.ts';

const LED_TEXT: Record<string, string> = {
  idle: 'Sin envíos todavía',
  ok: 'Enviando',
  queued: 'Guardando en cola',
  rejected: 'Lectura rechazada',
  off: 'Nodo apagado',
};

function ZoneReadings({ zone, now }: { zone: ZoneSnapshot; now: number }) {
  const { node, backend } = zone;
  const stale = node.led === 'off' || node.led === 'rejected' || node.led === 'queued';
  return (
    <article className="readings-zone" aria-label={`Lecturas de ${zone.name}`}>
      <header>
        <h3>
          <span className={`dot led-${node.led}`} aria-hidden="true" />
          {zone.name}
        </h3>
        <span className="dim">
          {LED_TEXT[node.led]}
          {node.lastSentAt ? ` · ${formatAgo(node.lastSentAt, now)}` : ''}
        </span>
      </header>
      {node.lastError && node.led !== 'ok' && <p className="readings-error">{node.lastError}</p>}
      <ul>
        {VARIABLES.map((key) => {
          const meta = VARIABLE_LABELS[key];
          const sent = node.lastReadings?.[key];
          const level = stale ? 'none' : (backend.levels?.[key] ?? 'none');
          const faulty = node.sensors[key].mode !== 'ok';
          return (
            <li key={key} className={`reading level-${level}${faulty ? ' reading-faulty' : ''}`}>
              <span className="reading-label">{meta.label}</span>
              <span className="reading-value">
                {sent === undefined ? '—' : formatValue(key, sent)}
                {meta.unit && <small> {meta.unit}</small>}
              </span>
              {faulty && (
                <span className="reading-real" title="Valor real en el invernadero; la sonda tiene una falla">
                  real {formatValue(key, zone.truth[key])}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <footer className="dim">
        Backend: {backend.createdAlerts} alerta(s) creadas · {backend.resolvedAlerts} resueltas
      </footer>
    </article>
  );
}

export function Readings({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="readings">
      {snapshot.zones.map((zone) => (
        <ZoneReadings key={zone.id} zone={zone} now={snapshot.realTime} />
      ))}
    </div>
  );
}
