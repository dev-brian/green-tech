import { useEffect, useMemo, useState } from 'react';
import { subscribeToZones } from '../lib/zonesService';
import type { Zone } from '../lib/zones';

/** Zonas registradas del invernadero, en tiempo real (T4.1 #64). */
export function useZones(greenhouseId: string | null) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!greenhouseId) {
      const t = setTimeout(() => {
        setZones([]);
        setLoading(false);
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
    }, 0);
    const unsub = subscribeToZones(
      greenhouseId,
      (data) => {
        setZones(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => {
      clearTimeout(t);
      unsub();
    };
  }, [greenhouseId]);

  const zonesById = useMemo(
    () => Object.fromEntries(zones.map((z) => [z.id, z])) as Record<string, Zone>,
    [zones],
  );

  return { zones, zonesById, loading, error };
}
