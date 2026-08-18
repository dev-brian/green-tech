import { useState, useEffect, useCallback } from 'react';
import {
  getThresholds,
  updateThresholds,
  resetThresholds,
  DEFAULT_THRESHOLDS,
  type GreenhouseThresholds,
} from '../lib/thresholdsService';

export type { GreenhouseThresholds };
export { DEFAULT_THRESHOLDS };

export function useThresholds(greenhouseId: string | null) {
  const [thresholds, setThresholds] = useState<GreenhouseThresholds>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Carga inicial desde Firestore
  useEffect(() => {
    if (!greenhouseId) return;
    setLoading(true);
    getThresholds(greenhouseId)
      .then(setThresholds)
      .catch(() => setThresholds(DEFAULT_THRESHOLDS))
      .finally(() => setLoading(false));
  }, [greenhouseId]);

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
      await resetThresholds(greenhouseId);
      setThresholds(DEFAULT_THRESHOLDS);
      setSuccessMsg('Umbrales restaurados a valores de fábrica.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch {
      setError('Error al restaurar los umbrales. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }, [greenhouseId]);

  return { thresholds, loading, saving, error, successMsg, save, reset };
}
