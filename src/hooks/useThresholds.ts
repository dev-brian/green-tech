import { useState, useEffect, useCallback } from 'react';
import {
  getThresholds,
  updateThresholds,
  resetThresholds,
  validateThresholds,
  DEFAULT_THRESHOLDS,
  type GreenhouseThresholds,
} from '../lib/thresholdsService';
import { trackWrite } from '../lib/pendingWrites';

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
    setTimeout(() => setLoading(true), 0);
    getThresholds(greenhouseId)
      .then(setThresholds)
      .catch(() => setThresholds(DEFAULT_THRESHOLDS))
      .finally(() => setLoading(false));
  }, [greenhouseId]);

  const save = useCallback(
    async (next: GreenhouseThresholds) => {
      if (!greenhouseId) return;
      const invalid = validateThresholds(next);
      if (invalid) {
        setError(invalid);
        setSuccessMsg(null);
        return;
      }
      setError(null);
      setSuccessMsg(null);
      const write = trackWrite('Umbrales', updateThresholds(greenhouseId, next));
      // Sin red, Firestore guarda el cambio en cola y lo manda solo al volver
      // la conexión; su promesa no termina hasta entonces (T10.3 #61).
      if (!navigator.onLine) {
        write.catch(() => setError('No se pudieron enviar los umbrales guardados sin conexión.'));
        setThresholds(next);
        setSuccessMsg('Guardado en este equipo. Se enviará cuando vuelva la conexión.');
        return;
      }
      setSaving(true);
      try {
        await write;
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
    setError(null);
    setSuccessMsg(null);
    const write = trackWrite('Umbrales', resetThresholds(greenhouseId));
    if (!navigator.onLine) {
      write.catch(() => setError('No se pudieron enviar los umbrales guardados sin conexión.'));
      setThresholds(DEFAULT_THRESHOLDS);
      setSuccessMsg('Guardado en este equipo. Se enviará cuando vuelva la conexión.');
      return;
    }
    setSaving(true);
    try {
      await write;
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
