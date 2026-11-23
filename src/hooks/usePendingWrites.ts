import { useSyncExternalStore } from 'react';
import { getPendingWrites, subscribePendingWrites } from '../lib/pendingWrites';

/** Escrituras hechas sin red que aún no confirma Firestore (T10.3 #61). */
export function usePendingWrites() {
  return useSyncExternalStore(subscribePendingWrites, getPendingWrites, getPendingWrites);
}
