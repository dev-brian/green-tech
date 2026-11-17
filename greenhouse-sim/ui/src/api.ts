/** Cliente de la API de control local del simulador. */

import type { Command, Scenario } from '../../model/types.ts';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data as T;
}

export const api = {
  command: (command: Command) => request('POST', '/api/command', { command }),
  settings: (settings: { speed?: number; paused?: boolean; publishIntervalSec?: number }) =>
    request('POST', '/api/settings', settings),
  publishNow: () => request('POST', '/api/publish-now', {}),
  scenarios: () => request<Scenario[]>('GET', '/api/scenarios'),
  runScenario: (id: string) => request('POST', `/api/scenarios/${id}/run`, {}),
  stopScenario: () => request('POST', '/api/scenario/stop', {}),
  saveScenario: (scenario: Partial<Scenario>) => request<Scenario>('POST', '/api/scenarios', scenario),
  deleteScenario: (id: string) => request('DELETE', `/api/scenarios/${id}`),
};
