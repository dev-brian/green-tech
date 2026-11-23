import { useState, useEffect, useCallback } from 'react';
import {
  subscribeToAlerts,
  markAlertAttended,
  type FirestoreAlert,
  type AlertFilters,
} from '../lib/alertsService';
import { useAuth } from '../context/AuthContext';

export type { FirestoreAlert, AlertFilters };

export function useAlerts(greenhouseId: string | null) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<FirestoreAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AlertFilters>({});

  useEffect(() => {
    if (!greenhouseId) {
      setTimeout(() => {
        setAlerts([]);
        setLoading(false);
      }, 0);
      return;
    }

    setTimeout(() => {
      setLoading(true);
      setError(null);
    }, 0);

    const unsub = subscribeToAlerts(
      greenhouseId,
      filters,
      (data) => {
        setAlerts(data);
        setError(null);
        setLoading(false);
      },
      () => {
        setAlerts([]);
        setError('No se pudieron cargar las alertas. Revisa tu conexión e intenta de nuevo.');
        setLoading(false);
      },
    );

    return unsub;
  }, [greenhouseId, filters]);

  const markAttended = useCallback(
    async (alertId: string) => {
      if (!user || !greenhouseId) return;
      await markAlertAttended(alertId, user.uid, greenhouseId);
    },
    [user, greenhouseId],
  );

  // Auditoría A5: "Ya lo revisé" muestra progreso y error. Sin conexión la
  // escritura queda en cola y el snapshot local ya la muestra atendida.
  const [attendState, setAttendState] = useState<Record<string, 'busy' | 'error'>>({});
  const attend = useCallback(
    (alertId: string) => {
      // Sin red la escritura queda en cola y la alerta ya se ve atendida (con
      // marca de pendiente); no se deja el botón en "Guardando…" (T10.3 #61).
      if (navigator.onLine) setAttendState((s) => ({ ...s, [alertId]: 'busy' }));
      markAttended(alertId)
        .then(() =>
          setAttendState((s) => {
            const next = { ...s };
            delete next[alertId];
            return next;
          }),
        )
        .catch((err) => {
          console.error('No se pudo marcar la alerta como atendida:', err);
          setAttendState((s) => ({ ...s, [alertId]: 'error' }));
        });
    },
    [markAttended],
  );

  // Conteo de alertas no atendidas para el badge de navegación
  const unattendedCount = alerts.filter((a) => a.status === 'new').length;

  return { alerts, loading, error, unattendedCount, filters, setFilters, markAttended, attend, attendState };
}
