/**
 * T10.3 (#61) — Cambios hechos sin red que aún no llegan al servidor (HU-10).
 *
 * Firestore guarda en cola las escrituras hechas sin conexión y las manda
 * solas al volver la red, pero su promesa no se resuelve hasta entonces. Este
 * registro cuenta esas escrituras para que la PWA pueda decir "1 cambio
 * pendiente de enviar" y no dejar botones girando para siempre.
 *
 * Módulo puro (sin React ni Firebase) para probarlo con `node --test`.
 */

export interface PendingWrite {
  id: number;
  label: string;
}

type Listener = (pending: readonly PendingWrite[]) => void;

let nextId = 1;
let pending: readonly PendingWrite[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(pending);
}

/**
 * Registra una escritura en curso; se quita sola cuando la promesa termina
 * (bien o mal). Devuelve la misma promesa.
 */
export function trackWrite<T>(label: string, write: Promise<T>): Promise<T> {
  const entry: PendingWrite = { id: nextId++, label };
  pending = [...pending, entry];
  emit();
  const done = () => {
    pending = pending.filter((p) => p.id !== entry.id);
    emit();
  };
  write.then(done, done);
  return write;
}

export function getPendingWrites(): readonly PendingWrite[] {
  return pending;
}

export function subscribePendingWrites(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** "1 cambio pendiente de enviar" / "3 cambios pendientes de enviar". */
export function pendingText(count: number): string {
  return count === 1 ? '1 cambio pendiente de enviar' : `${count} cambios pendientes de enviar`;
}
