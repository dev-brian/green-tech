import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogEntry, Snapshot } from '../../simulation.ts';
import { api } from './api.ts';
import { Readings } from './Readings.tsx';
import { Scene, type Selection } from './Scene.tsx';
import { SidePanel, type PanelTab } from './SidePanel.tsx';
import { TopBar } from './TopBar.tsx';

const MAX_LOG = 300;

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<PanelTab>('scenarios');
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const source = new EventSource('/api/events');
    source.addEventListener('open', () => setConnected(true));
    source.addEventListener('error', () => setConnected(false));
    source.addEventListener('state', (e) => setSnapshot(JSON.parse((e as MessageEvent).data)));
    source.addEventListener('history', (e) => setLog(JSON.parse((e as MessageEvent).data)));
    source.addEventListener('log', (e) => {
      const entry = JSON.parse((e as MessageEvent).data) as LogEntry;
      setLog((prev) => [...prev.slice(-(MAX_LOG - 1)), entry]);
    });
    return () => source.close();
  }, []);

  /** Ejecuta una acción de la API y muestra el error si falla. */
  const run = useCallback((action: () => Promise<unknown>) => {
    action().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
      window.clearTimeout(errorTimer.current);
      errorTimer.current = window.setTimeout(() => setError(null), 6000);
    });
  }, []);

  const select = useCallback((next: Selection) => {
    setSelection(next);
    if (next) setTab('inspector');
  }, []);

  if (!snapshot) {
    return (
      <div className="loading" role="status">
        Conectando con el simulador…
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar snapshot={snapshot} connected={connected} run={run} api={api} />
      {error && (
        <div className="toast" role="alert">
          {error}
        </div>
      )}
      <main className="layout">
        <section className="stage" aria-label="Invernadero">
          <Scene snapshot={snapshot} selection={selection} onSelect={select} />
          <Readings snapshot={snapshot} />
        </section>
        <SidePanel
          snapshot={snapshot}
          log={log}
          tab={tab}
          onTab={setTab}
          selection={selection}
          onSelect={select}
          run={run}
        />
      </main>
    </div>
  );
}
