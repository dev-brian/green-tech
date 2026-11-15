import { useState, useEffect, useCallback } from 'react';
import {
  getThresholds,
  updateThresholds,
  resetThresholds,
  DEFAULT_THRESHOLDS,
  type GreenhouseThresholds,
} from '../lib/thresholdsService';
import { defaultThresholdsFor } from '../lib/cropProfiles';

export type { GreenhouseThresholds };
export { DEFAULT_THRESHOLDS };

export function useThresholds(greenhouseId: string | null, crop?: string) {
  const [thresholds, setThresholds] = useState<GreenhouseThresholds>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Carga inicial (y recarga al cambiar de cultivo) desde Firestore.
  // El flag `cancelled` evita que la respuesta de un cultivo anterior
  // pise la del cultivo recién seleccionado (T5.2 #45).
  useEffect(() => {
    if (!greenhouseId) return;
    let cancelled = false;
    // setLoading va en un timeout: react-hooks/set-state-in-effect prohíbe
    // llamar setState síncrono dentro del efecto (mismo patrón que ya usaba
    // este hook).
    const timer = setTimeout(() => { if (!cancelled) setLoading(true); }, 0);
    getThresholds(greenhouseId, crop)
      .then((t) => { if (!cancelled) setThresholds(t); })
      .catch(() => { if (!cancelled) setThresholds(defaultThresholdsFor(crop)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [greenhouseId, crop]);

  const save = useCallback(
    async (next: GreenhouseThresholds) => {
      if (!greenhouseId) return;
      setSaving(true);
      setError(null);
      setSuccessMsg(null);
      try {
        await updateThresholds(greenhouseId, next);
        setThresholds(next);
        setSuccessMsg('Umbrales actualizados correctamente.');
        setTimeout(() => setSuccessMsg(null), 3500);
      } catch {
        setError('Error al guardar los umbrales. Intenta de nuevo.');
      } finally {
        setSaving(false);
      }
    },
    [greenhouseId],
  );

  const reset = useCallback(async () => {
    if (!greenhouseId) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await resetThresholds(greenhouseId, crop);
      setThresholds(defaultThresholdsFor(crop));
      setSuccessMsg('Umbrales restaurados a valores de fábrica.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch {
      setError('Error al restaurar los umbrales. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }, [greenhouseId, crop]);

  return { thresholds, loading, saving, error, successMsg, save, reset };
}
