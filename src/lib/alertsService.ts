import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'yellow' | 'red';
export type AlertStatus   = 'new' | 'attended' | 'auto_resolved';
export type AlertVariable = 'temperature' | 'humidity' | 'soilMoisture';

export interface FirestoreAlert {
  id: string;
  greenhouseId: string;
  sector: string;
  variable: AlertVariable;
  severity: AlertSeverity;
  message: string;
  value: number;
  status: AlertStatus;
  attendedBy: string | null;
  attendedAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface AlertFilters {
  severity?: AlertSeverity;
  status?: AlertStatus;
  sector?: string;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date();
}

function toDateOrNull(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return null;
}

function docToAlert(id: string, data: Record<string, unknown>): FirestoreAlert {
  return {
    id,
    greenhouseId:  String(data.greenhouseId  ?? ''),
    sector:        String(data.sector        ?? ''),
    variable:      (data.variable as AlertVariable) ?? 'temperature',
    severity:      (data.severity as AlertSeverity) ?? 'yellow',
    message:       String(data.message       ?? ''),
    value:         Number(data.value         ?? 0),
    status:        (data.status  as AlertStatus) ?? 'new',
    attendedBy:    data.attendedBy  ? String(data.attendedBy) : null,
    attendedAt:    toDateOrNull(data.attendedAt),
    createdAt:     toDate(data.createdAt),
    resolvedAt:    toDateOrNull(data.resolvedAt),
  };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Suscripción reactiva a las alertas de un invernadero.
 * Aplica filtros opcionales. Devuelve la función de desuscripción.
 */
export function subscribeToAlerts(
  greenhouseId: string,
  filters: AlertFilters,
  callback: (alerts: FirestoreAlert[]) => void,
): () => void {
  const q = query(
    collection(db, 'alerts'),
    where('greenhouseId', '==', greenhouseId),
    orderBy('createdAt', 'desc'),
    limit(100),
  );

  // Nota: Firestore requiere índice compuesto cuando se combinan where + orderBy
  // sobre campos distintos. Por simplicidad, el filtrado de severity/status/sector
  // se hace en cliente sobre los 100 documentos más recientes.

  return onSnapshot(q, (snapshot) => {
    let alerts: FirestoreAlert[] = snapshot.docs.map((d) =>
      docToAlert(d.id, d.data() as Record<string, unknown>)
    );

    if (filters.severity) {
      alerts = alerts.filter((a) => a.severity === filters.severity);
    }
    if (filters.status) {
      alerts = alerts.filter((a) => a.status === filters.status);
    }
    if (filters.sector) {
      alerts = alerts.filter((a) => a.sector === filters.sector);
    }

    callback(alerts);
  });
}

/**
 * Crea una nueva alerta en Firestore.
 */
export async function createAlert(payload: {
  greenhouseId: string;
  sector: string;
  variable: AlertVariable;
  severity: AlertSeverity;
  message: string;
  value: number;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'alerts'), {
    ...payload,
    status: 'new',
    attendedBy: null,
    attendedAt: null,
    resolvedAt: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Verifica si ya existe una alerta activa ('new') para una variable y sector.
 * Sirve para el anti-spam: no duplicar alertas mientras la condición persista.
 */
export async function hasActiveAlert(
  greenhouseId: string,
  sector: string,
  variable: AlertVariable,
): Promise<boolean> {
  const q = query(
    collection(db, 'alerts'),
    where('greenhouseId', '==', greenhouseId),
    where('sector', '==', sector),
    where('variable', '==', variable),
    where('status', '==', 'new'),
    limit(1),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Marca una alerta como atendida por el usuario dado.
 */
export async function markAlertAttended(
  alertId: string,
  userId: string,
): Promise<void> {
  await updateDoc(doc(db, 'alerts', alertId), {
    status: 'attended',
    attendedBy: userId,
    attendedAt: serverTimestamp(),
  });
}

/**
 * Devuelve el conteo de alertas no atendidas (status === 'new').
 */
export async function getUnattendedCount(greenhouseId: string): Promise<number> {
  const q = query(
    collection(db, 'alerts'),
    where('greenhouseId', '==', greenhouseId),
    where('status', '==', 'new'),
  );
  const snap = await getDocs(q);
  return snap.size;
}
