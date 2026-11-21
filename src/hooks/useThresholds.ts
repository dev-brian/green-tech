import { useState, useEffect, useCallback } from 'react';
import {
  getThresholds,
  getThresholdsByCrop,
  updateThresholds,
  resetThresholds,
  validateThresholds,
  DEFAULT_THRESHOLDS,
  type GreenhouseThresholds,
} from '../lib/thresholdsService';
import { trackWrite } from '../lib/pendingWrites';
import { CROP_PROFILES, defaultThresholdsFor, type CropType } from '../lib/cropProfiles';

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
      const invalid = validateThresholds(next);
      if (invalid) {
        setError(invalid);
        setSuccessMsg(null);
        return;
      }
      setError(null);
      setSuccessMsg(null);
      const write = trackWrite('Umbrales', updateThresholds(greenhouseId, crop, next));
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
    [greenhouseId, crop],
  );

  const reset = useCallback(async () => {
    if (!greenhouseId) return;
    setError(null);
    setSuccessMsg(null);
    const write = trackWrite('Umbrales', resetThresholds(greenhouseId, crop));
    if (!navigator.onLine) {
      write.catch(() => setError('No se pudieron enviar los umbrales guardados sin conexión.'));
      setThresholds(defaultThresholdsFor(crop));
      setSuccessMsg('Guardado en este equipo. Se enviará cuando vuelva la conexión.');
      return;
    }
    setSaving(true);
    try {
      await write;
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

/**
 * Umbrales de los dos cultivos a la vez, para pantallas que muestran zonas de
 * jitomate y de lechuga juntas. `forCrop(crop)` devuelve los del cultivo
 * (jitomate si no se sabe).
 */
export function useThresholdsByCrop(greenhouseId: string | null) {
  const [byCrop, setByCrop] = useState<Record<CropType, GreenhouseThresholds>>(CROP_PROFILES);

  useEffect(() => {
    if (!greenhouseId) return;
    let cancelled = false;
    getThresholdsByCrop(greenhouseId)
      .then((t) => { if (!cancelled) setByCrop(t); })
      .catch(() => { /* se quedan los perfiles por defecto */ });
    return () => { cancelled = true; };
  }, [greenhouseId]);

  const forCrop = useCallback(
    (crop?: string | null): GreenhouseThresholds => (crop === 'lechuga' ? byCrop.lechuga : byCrop.jitomate),
    [byCrop],
  );

  return { forCrop };
}
