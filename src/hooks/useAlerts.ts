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
  const [filters, setFilters] = useState<AlertFilters>({});

  useEffect(() => {
    if (!greenhouseId) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsub = subscribeToAlerts(greenhouseId, filters, (data) => {
      setAlerts(data);
      setLoading(false);
    });

    return unsub;
  }, [greenhouseId, filters]);

  const markAttended = useCallback(
    async (alertId: string) => {
      if (!user) return;
      await markAlertAttended(alertId, user.uid);
    },
    [user],
  );

  // Conteo de alertas no atendidas para el badge de navegación
  const unattendedCount = alerts.filter((a) => a.status === 'new').length;

  return { alerts, loading, unattendedCount, filters, setFilters, markAttended };
}
