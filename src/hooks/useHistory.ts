import { useEffect, useState } from 'react';
import { fetchHistory, historyErrorMessage } from '../lib/historyService';
import type { HistoryPoint, HistoryRange } from '../lib/history';

interface HistoryResult {
  key: string;
  points: HistoryPoint[];
  error: string | null;
}

/**
 * Histórico de una zona para el rango elegido (T7.2 #76).
 * `reload` vuelve a pedir los datos. El estado de carga se deriva de la
 * petición vigente, así que no hace falta cambiar estado dentro del efecto.
 */
export function useHistory(
  greenhouseId: string | null,
  zoneId: string | null,
  range: HistoryRange,
) {
  const [result, setResult] = useState<HistoryResult | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const key = greenhouseId && zoneId ? `${greenhouseId}|${zoneId}|${range}|${reloadCount}` : null;

  useEffect(() => {
    if (!key || !greenhouseId || !zoneId) return;
    let ignore = false;
    fetchHistory(greenhouseId, zoneId, range)
      .then((points) => {
        if (!ignore) setResult({ key, points, error: null });
      })
      .catch((err: unknown) => {
        console.error('Error al cargar el histórico:', err);
        if (!ignore) setResult({ key, points: [], error: historyErrorMessage(err) });
      });
    return () => {
      ignore = true;
    };
  }, [key, greenhouseId, zoneId, range]);

  const current = result && result.key === key ? result : null;
  // Al recargar la misma zona y rango se siguen mostrando los datos anteriores.
  const base = key?.slice(0, key.lastIndexOf('|') + 1);
  const previous = !current && base && result?.key.startsWith(base) ? result : null;

  return {
    points: (current ?? previous)?.points ?? [],
    error: current?.error ?? null,
    loading: key !== null && current === null,
    reload: () => setReloadCount((n) => n + 1),
  };
}
