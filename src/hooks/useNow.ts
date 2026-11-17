import { useEffect, useState } from 'react';

/**
 * Hora actual que se actualiza cada `intervalMs` y al volver a la pestaña.
 * Sirve para que "hace 40 s" y el estado "sin datos" avancen aunque no llegue
 * ningún dato nuevo de Firestore.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    // Los navegadores frenan los intervalos en segundo plano: al volver, recalcular ya.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}
