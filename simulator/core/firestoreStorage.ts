/**
 * Adaptador de persistencia real en Firebase Firestore para el motor
 * de ingesta, estado latest, alertas y actuadores usando Firebase Admin SDK
 * (Plan Spark gratuito con cuenta de servicio; salta firestore.rules como backend real).
 * Escribe en:
 * - greenhouses/{id}/readings/{readingId}
 * - greenhouses/{id}/readingsHourly/{zoneId}_{yyyyMMddHH}
 * - greenhouses/{id}/state/latest
 * - greenhouses/{id}/alerts/{alertId}
 * - greenhouses/{id}/actuators/{zoneId}
 */

import { existsSync, readFileSync } from 'node:fs';
import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import {
  getFirestore,
  Timestamp,
  type CollectionReference,
  type Firestore,
} from 'firebase-admin/firestore';
import {
  DEFAULT_CROP_THRESHOLDS,
  type CropThresholds,
  type CropType,
  type HydroponicReadings,
  type HydroponicVariable,
  VARIABLE_KEYS,
} from './hydroponicModel.ts';
import {
  hourlyDocId,
  mergeIntoHourly,
  retentionCutoffs,
  type HourlyAggregate,
  type VariableStats,
} from './hourlyAggregation.ts';
import type {
  AlertRecord,
  PruneResult,
  TelemetryStorageAdapter,
  ZoneActuatorsState,
  ZoneLatestState,
} from './alertAndActuatorEngine.ts';

export function loadEnvLocal(): void {
  if (existsSync('.env.local')) {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim();
      }
    }
  }
}

export function initFirestoreAdmin(): Firestore {
  loadEnvLocal();
  const existing = getApps();
  if (existing.length > 0) {
    return getFirestore(existing[0]);
  }

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  let app: App;

  if (rawServiceAccount) {
    const parsed = JSON.parse(rawServiceAccount) as ServiceAccount;
    app = initializeApp({
      credential: cert(parsed),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = initializeApp({
      credential: applicationDefault(),
    });
  } else {
    throw new Error(
      'Falta FIREBASE_SERVICE_ACCOUNT (JSON) o GOOGLE_APPLICATION_CREDENTIALS para conectar el backend a Firestore con Admin SDK.',
    );
  }

  return getFirestore(app);
}

export class FirestoreTelemetryStorage implements TelemetryStorageAdapter {
  private db: Firestore;

  constructor(db?: Firestore) {
    this.db = db ?? initFirestoreAdmin();
  }

  async getThresholds(greenhouseId: string, crop: CropType): Promise<CropThresholds> {
    try {
      const snap = await this.db.collection('greenhouses').doc(greenhouseId).get();
      if (!snap.exists) return DEFAULT_CROP_THRESHOLDS[crop];
      const data = snap.data() ?? {};
      const stored = data.thresholds as Partial<CropThresholds> | undefined;
      if (!stored) return DEFAULT_CROP_THRESHOLDS[crop];
      const base = DEFAULT_CROP_THRESHOLDS[crop];
      return {
        airTemp: { ...base.airTemp, ...stored.airTemp },
        humidity: { ...base.humidity, ...stored.humidity },
        light: { ...base.light, ...stored.light },
        ph: { ...base.ph, ...stored.ph },
        ec: { ...base.ec, ...stored.ec },
        solutionTemp: { ...base.solutionTemp, ...stored.solutionTemp },
        tankLevel: { ...base.tankLevel, ...stored.tankLevel },
      };
    } catch {
      return DEFAULT_CROP_THRESHOLDS[crop];
    }
  }

  async saveReading(
    greenhouseId: string,
    reading: {
      zoneId: string;
      crop: CropType;
      timestamp: string;
      readings: HydroponicReadings;
    },
  ): Promise<string> {
    const colRef = this.db
      .collection('greenhouses')
      .doc(greenhouseId)
      .collection('readings');
    const docRef = await colRef.add({
      zoneId: reading.zoneId,
      crop: reading.crop,
      timestamp: Timestamp.fromDate(new Date(reading.timestamp)),
      ...reading.readings,
    });
    return docRef.id;
  }

  async updateLatestState(
    greenhouseId: string,
    zoneId: string,
    zoneState: ZoneLatestState,
  ): Promise<void> {
    const latestRef = this.db
      .collection('greenhouses')
      .doc(greenhouseId)
      .collection('state')
      .doc('latest');
    await latestRef.set(
      {
        [zoneId]: {
          ...zoneState,
          timestamp: Timestamp.fromDate(new Date(zoneState.timestamp)),
        },
      },
      { merge: true },
    );
  }

  async getActiveAlert(
    greenhouseId: string,
    zoneId: string,
    variable: HydroponicVariable,
  ): Promise<AlertRecord | null> {
    const snap = await this.db
      .collection('greenhouses')
      .doc(greenhouseId)
      .collection('alerts')
      .where('zoneId', '==', zoneId)
      .where('variable', '==', variable)
      .where('status', '==', 'new')
      .limit(1)
      .get();

    if (snap.empty) return null;
    const d = snap.docs[0];
    const data = d.data();
    return {
      id: d.id,
      zoneId: String(data.zoneId ?? zoneId),
      variable: data.variable as HydroponicVariable,
      severity: data.severity === 'critical' ? 'critical' : 'warn',
      value: Number(data.value ?? 0),
      message: String(data.message ?? ''),
      status: 'new',
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : String(data.createdAt ?? new Date().toISOString()),
      attendedBy: data.attendedBy ? String(data.attendedBy) : null,
      attendedAt: null,
      resolvedAt: null,
    };
  }

  async createAlert(
    greenhouseId: string,
    alert: Omit<AlertRecord, 'id'>,
  ): Promise<AlertRecord> {
    const colRef = this.db
      .collection('greenhouses')
      .doc(greenhouseId)
      .collection('alerts');
    const docRef = await colRef.add({
      ...alert,
      createdAt: Timestamp.fromDate(new Date(alert.createdAt)),
    });
    return { id: docRef.id, ...alert };
  }

  async updateAlert(
    greenhouseId: string,
    alertId: string,
    patch: Partial<AlertRecord>,
  ): Promise<void> {
    const ref = this.db
      .collection('greenhouses')
      .doc(greenhouseId)
      .collection('alerts')
      .doc(alertId);
    const firestorePatch: Record<string, unknown> = {
      ...patch,
    };
    if (typeof patch.resolvedAt === 'string') {
      firestorePatch.resolvedAt = Timestamp.fromDate(new Date(patch.resolvedAt));
    }
    await ref.update(firestorePatch);
  }

  async getActuatorsState(
    greenhouseId: string,
    zoneId: string,
  ): Promise<ZoneActuatorsState> {
    const now = new Date().toISOString();
    const fallback: ZoneActuatorsState = {
      zoneId,
      recirculationPump: { on: true, updatedAt: now, updatedBy: 'backend' },
      phDoser: { on: false, updatedAt: now, updatedBy: 'backend' },
      nutrientDoser: { on: false, updatedAt: now, updatedBy: 'backend' },
      ventilation: { on: false, updatedAt: now, updatedBy: 'backend' },
      updatedAt: now,
    };
    try {
      const ref = this.db
        .collection('greenhouses')
        .doc(greenhouseId)
        .collection('actuators')
        .doc(zoneId);
      const snap = await ref.get();
      if (!snap.exists) return fallback;
      const d = snap.data() ?? {};
      return {
        zoneId,
        recirculationPump: d.recirculationPump ?? fallback.recirculationPump,
        phDoser: d.phDoser ?? fallback.phDoser,
        nutrientDoser: d.nutrientDoser ?? fallback.nutrientDoser,
        ventilation: d.ventilation ?? fallback.ventilation,
        updatedAt: String(d.updatedAt ?? now),
      };
    } catch {
      return fallback;
    }
  }

  async saveActuatorsState(
    greenhouseId: string,
    zoneId: string,
    state: ZoneActuatorsState,
  ): Promise<void> {
    const ref = this.db
      .collection('greenhouses')
      .doc(greenhouseId)
      .collection('actuators')
      .doc(zoneId);
    await ref.set({
      ...state,
    });
  }

  /**
   * Suma la lectura a su documento de readingsHourly dentro de una transacción,
   * para que dos lecturas de la misma hora no se pisen el promedio.
   */
  async upsertHourly(
    greenhouseId: string,
    zoneId: string,
    timestamp: string,
    readings: HydroponicReadings,
  ): Promise<HourlyAggregate> {
    const ref = this.db
      .collection('greenhouses')
      .doc(greenhouseId)
      .collection('readingsHourly')
      .doc(hourlyDocId(zoneId, timestamp));

    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists ? hourlyFromFirestore(snap.data() ?? {}, zoneId) : null;
      const next = mergeIntoHourly(prev, zoneId, timestamp, readings);
      tx.set(ref, { ...next, hour: Timestamp.fromDate(new Date(next.hour)) });
      return next;
    });
  }

  async pruneExpired(greenhouseId: string, now: Date = new Date()): Promise<PruneResult> {
    const gh = this.db.collection('greenhouses').doc(greenhouseId);
    const { readingsBefore, hourlyBefore } = retentionCutoffs(now);
    const readingsDeleted = await deleteOlderThan(gh.collection('readings'), 'timestamp', readingsBefore);
    const hourlyDeleted = await deleteOlderThan(gh.collection('readingsHourly'), 'hour', hourlyBefore);
    return { readingsDeleted, hourlyDeleted };
  }

  /** Lecturas crudas desde una fecha, para rellenar readingsHourly. */
  async listReadingsSince(
    greenhouseId: string,
    since: Date,
  ): Promise<Array<{ zoneId: string; timestamp: string } & HydroponicReadings>> {
    const snap = await this.db
      .collection('greenhouses')
      .doc(greenhouseId)
      .collection('readings')
      .where('timestamp', '>=', Timestamp.fromDate(since))
      .orderBy('timestamp')
      .get();
    const out: Array<{ zoneId: string; timestamp: string } & HydroponicReadings> = [];
    for (const d of snap.docs) {
      const data = d.data();
      if (!(data.timestamp instanceof Timestamp) || typeof data.zoneId !== 'string') continue;
      const row = { zoneId: data.zoneId, timestamp: data.timestamp.toDate().toISOString() } as {
        zoneId: string;
        timestamp: string;
      } & HydroponicReadings;
      let complete = true;
      for (const key of VARIABLE_KEYS) {
        const v = Number(data[key]);
        if (!Number.isFinite(v)) complete = false;
        row[key] = v;
      }
      if (complete) out.push(row);
    }
    return out;
  }

  /** Sobrescribe documentos de readingsHourly ya calculados (relleno). */
  async writeHourly(greenhouseId: string, aggregates: Map<string, HourlyAggregate>): Promise<void> {
    const col = this.db.collection('greenhouses').doc(greenhouseId).collection('readingsHourly');
    let batch = this.db.batch();
    let pending = 0;
    for (const [id, agg] of aggregates) {
      batch.set(col.doc(id), { ...agg, hour: Timestamp.fromDate(new Date(agg.hour)) });
      if (++pending === BATCH_LIMIT) {
        await batch.commit();
        batch = this.db.batch();
        pending = 0;
      }
    }
    if (pending > 0) await batch.commit();
  }
}

/** Firestore admite hasta 500 escrituras por lote; se deja margen. */
const BATCH_LIMIT = 400;

async function deleteOlderThan(
  col: CollectionReference,
  field: 'timestamp' | 'hour',
  before: Date,
): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await col.where(field, '<', Timestamp.fromDate(before)).limit(BATCH_LIMIT).get();
    if (snap.empty) return deleted;
    const batch = col.firestore.batch();
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
    deleted += snap.size;
    if (snap.size < BATCH_LIMIT) return deleted;
  }
}

function hourlyFromFirestore(data: Record<string, unknown>, zoneId: string): HourlyAggregate | null {
  const count = Number(data.count);
  if (!Number.isFinite(count) || count <= 0) return null;
  const hour =
    data.hour instanceof Timestamp ? data.hour.toDate().toISOString() : String(data.hour ?? '');
  const agg = { zoneId, hour, count } as HourlyAggregate;
  for (const key of VARIABLE_KEYS) {
    const stats = data[key] as Partial<VariableStats> | undefined;
    if (
      !stats ||
      !Number.isFinite(stats.avg) ||
      !Number.isFinite(stats.min) ||
      !Number.isFinite(stats.max)
    ) {
      return null;
    }
    agg[key] = { avg: stats.avg!, min: stats.min!, max: stats.max! };
  }
  return agg;
}
