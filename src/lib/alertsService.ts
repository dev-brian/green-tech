import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
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
export type AlertVariable =
  | 'airTemp'
  | 'humidity'
  | 'light'
  | 'ph'
  | 'ec'
  | 'solutionTemp'
  | 'tankLevel'
  | 'temperature';

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
  if (typeof v === 'string') {
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function toDateOrNull(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function normalizeSeverity(raw: unknown): AlertSeverity {
  if (raw === 'critical' || raw === 'red') return 'red';
  return 'yellow';
}

function docToAlert(
  id: string,
  greenhouseId: string,
  data: Record<string, unknown>,
): FirestoreAlert {
  const rawVariable = String(data.variable ?? 'airTemp');
  const variable: AlertVariable =
    rawVariable === 'temperature' ? 'airTemp' : (rawVariable as AlertVariable);
  return {
    id,
    greenhouseId:  String(data.greenhouseId ?? greenhouseId),
    sector:        String(data.zoneId ?? data.sector ?? 'zona-1'),
    variable,
    severity:      normalizeSeverity(data.severity),
    message:       String(data.message ?? ''),
    value:         Number(data.value ?? 0),
    status:        (data.status as AlertStatus) ?? 'new',
    attendedBy:    data.attendedBy ? String(data.attendedBy) : null,
    attendedAt:    toDateOrNull(data.attendedAt),
    createdAt:     toDate(data.createdAt),
    resolvedAt:    toDateOrNull(data.resolvedAt),
  };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Suscripción reactiva a las alertas de un invernadero (subcolección v0.2:
 * greenhouses/{greenhouseId}/alerts).
 */
export function subscribeToAlerts(
  greenhouseId: string,
  filters: AlertFilters,
  callback: (alerts: FirestoreAlert[]) => void,
): () => void {
  const q = query(
    collection(db, 'greenhouses', greenhouseId, 'alerts'),
    orderBy('createdAt', 'desc'),
    limit(100),
  );

  return onSnapshot(q, (snapshot) => {
    let alerts: FirestoreAlert[] = snapshot.docs.map((d) =>
      docToAlert(d.id, greenhouseId, d.data() as Record<string, unknown>),
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
 * Marca una alerta como atendida por el usuario dado (solo permite modificar
 * status, attendedBy y attendedAt según las reglas de Firestore T11.1).
 */
export async function markAlertAttended(
  alertId: string,
  userId: string,
  greenhouseId?: string,
): Promise<void> {
  const ref = greenhouseId
    ? doc(db, 'greenhouses', greenhouseId, 'alerts', alertId)
    : doc(db, 'alerts', alertId);
  await updateDoc(ref, {
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
    collection(db, 'greenhouses', greenhouseId, 'alerts'),
    where('status', '==', 'new'),
  );
  const snap = await getDocs(q);
  return snap.size;
}
