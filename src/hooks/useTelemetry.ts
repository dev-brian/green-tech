import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface TelemetryReading {
  id: string;
  greenhouseId: string;
  nodeId: string;
  sector: string;
  timestamp: Date;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  airTemp?: number;
  light?: number;
  ph?: number;
  ec?: number;
  solutionTemp?: number;
  tankLevel?: number;
  semaphoreStatus: 'green' | 'yellow' | 'red';
}

function parseTimestamp(raw: unknown): Date {
  if (raw instanceof Timestamp) return raw.toDate();
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string') {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function useTelemetry(greenhouseId: string | null) {
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [latestReading, setLatestReading] = useState<TelemetryReading | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!greenhouseId) return;

    // Lee de la subcolección del esquema v0.2: greenhouses/{greenhouseId}/readings
    const q = query(
      collection(db, 'greenhouses', greenhouseId, 'readings'),
      orderBy('timestamp', 'desc'),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: TelemetryReading[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const airTemp = Number(d.airTemp ?? d.temperature ?? 0);
          const humidity = Number(d.humidity ?? 0);
          const tankLevel = Number(d.tankLevel ?? d.soilMoisture ?? 0);

          return {
            id: docSnap.id,
            greenhouseId,
            nodeId: String(d.nodeId ?? 'ESP32-SIM'),
            sector: String(d.zoneId ?? d.sector ?? 'zona-1'),
            timestamp: parseTimestamp(d.timestamp),
            temperature: airTemp,
            humidity,
            soilMoisture: tankLevel,
            airTemp,
            light: typeof d.light === 'number' ? d.light : undefined,
            ph: typeof d.ph === 'number' ? d.ph : undefined,
            ec: typeof d.ec === 'number' ? d.ec : undefined,
            solutionTemp: typeof d.solutionTemp === 'number' ? d.solutionTemp : undefined,
            tankLevel,
            semaphoreStatus:
              d.semaphoreStatus === 'red' || d.semaphoreStatus === 'yellow'
                ? d.semaphoreStatus
                : 'green',
          };
        });

        const chronological = [...data].reverse();
        setReadings(chronological);
        setLatestReading(data.length > 0 ? data[0] : null);
        setFetching(false);
      },
      (error) => {
        console.error('Error fetching telemetry:', error);
        setFetching(false);
      },
    );

    return () => unsubscribe();
  }, [greenhouseId]);

  const activeReadings = greenhouseId ? readings : [];
  const activeLatest = greenhouseId ? latestReading : null;
  const activeLoading = greenhouseId ? fetching : false;

  return { readings: activeReadings, latestReading: activeLatest, loading: activeLoading };
}
