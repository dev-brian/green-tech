/**
 * Adaptador de persistencia real en Firebase Firestore para el motor
 * de ingesta, estado latest, alertas y actuadores (Plan B Spark sin Blaze).
 * Escribe en:
 * - greenhouses/{id}/readings/{readingId}
 * - greenhouses/{id}/state/latest
 * - greenhouses/{id}/alerts/{alertId}
 * - greenhouses/{id}/actuators/{zoneId}
 */

import { existsSync, readFileSync } from 'node:fs';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  limit,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import {
  DEFAULT_CROP_THRESHOLDS,
  type CropThresholds,
  type CropType,
  type HydroponicReadings,
  type HydroponicVariable,
} from './hydroponicModel.ts';
import type {
  AlertRecord,
  TelemetryStorageAdapter,
  ZoneActuatorsState,
  ZoneLatestState,
} from './alertAndActuatorEngine.ts';

function loadEnvLocal(): void {
  if (existsSync('.env.local')) {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim();
      }
    }
  }
}

export function initFirestoreClient(): Firestore {
  loadEnvLocal();
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  };

  if (!firebaseConfig.projectId) {
    throw new Error(
      'Falta VITE_FIREBASE_PROJECT_ID en .env.local o variables de entorno para conectar a Firestore.',
    );
  }

  const existing = getApps();
  const app: FirebaseApp =
    existing.length > 0 ? existing[0] : initializeApp(firebaseConfig);
  return getFirestore(app);
}

export class FirestoreTelemetryStorage implements TelemetryStorageAdapter {
  private db: Firestore;
  private ingestKey: string;

  constructor(db?: Firestore, ingestKey?: string) {
    this.db = db ?? initFirestoreClient();
    this.ingestKey =
      ingestKey ?? process.env.DEVICE_INGEST_KEY ?? 'gt-dev-device-key-2026';
  }

  async getThresholds(greenhouseId: string, crop: CropType): Promise<CropThresholds> {
    try {
      const snap = await getDoc(doc(this.db, 'greenhouses', greenhouseId));
      if (!snap.exists()) return DEFAULT_CROP_THRESHOLDS[crop];
      const data = snap.data();
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
    const colRef = collection(this.db, 'greenhouses', greenhouseId, 'readings');
    const docRef = await addDoc(colRef, {
      zoneId: reading.zoneId,
      crop: reading.crop,
      timestamp: Timestamp.fromDate(new Date(reading.timestamp)),
      ...reading.readings,
      ingestKey: this.ingestKey,
    });
    return docRef.id;
  }

  async updateLatestState(
    greenhouseId: string,
    zoneId: string,
    zoneState: ZoneLatestState,
  ): Promise<void> {
    const latestRef = doc(this.db, 'greenhouses', greenhouseId, 'state', 'latest');
    await setDoc(
      latestRef,
      {
        [zoneId]: {
          ...zoneState,
          timestamp: Timestamp.fromDate(new Date(zoneState.timestamp)),
        },
        ingestKey: this.ingestKey,
      },
      { merge: true },
    );
  }

  async getActiveAlert(
    greenhouseId: string,
    zoneId: string,
    variable: HydroponicVariable,
  ): Promise<AlertRecord | null> {
    const q = query(
      collection(this.db, 'greenhouses', greenhouseId, 'alerts'),
      where('zoneId', '==', zoneId),
      where('variable', '==', variable),
      where('status', '==', 'new'),
      limit(1),
    );
    const snap = await getDocs(q);
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
    const colRef = collection(this.db, 'greenhouses', greenhouseId, 'alerts');
    const docRef = await addDoc(colRef, {
      ...alert,
      createdAt: Timestamp.fromDate(new Date(alert.createdAt)),
      ingestKey: this.ingestKey,
    });
    return { id: docRef.id, ...alert };
  }

  async updateAlert(
    greenhouseId: string,
    alertId: string,
    patch: Partial<AlertRecord>,
  ): Promise<void> {
    const ref = doc(this.db, 'greenhouses', greenhouseId, 'alerts', alertId);
    const firestorePatch: Record<string, unknown> = {
      ...patch,
      ingestKey: this.ingestKey,
    };
    if (typeof patch.resolvedAt === 'string') {
      firestorePatch.resolvedAt = Timestamp.fromDate(new Date(patch.resolvedAt));
    }
    await updateDoc(ref, firestorePatch);
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
      const ref = doc(this.db, 'greenhouses', greenhouseId, 'actuators', zoneId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return fallback;
      const d = snap.data();
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
    const ref = doc(this.db, 'greenhouses', greenhouseId, 'actuators', zoneId);
    await setDoc(ref, {
      ...state,
      ingestKey: this.ingestKey,
    });
  }
}
