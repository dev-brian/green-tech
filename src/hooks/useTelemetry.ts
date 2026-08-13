import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
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
  semaphoreStatus: 'green' | 'yellow' | 'red';
}

export function useTelemetry(greenhouseId: string | null) {
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [latestReading, setLatestReading] = useState<TelemetryReading | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!greenhouseId) return;

    // Listen to latest readings for charts (last 24h)
    const q = query(
      collection(db, 'telemetry_data'),
      where('greenhouseId', '==', greenhouseId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: TelemetryReading[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as TelemetryReading[];

      setReadings(data.reverse()); // Chronological order
      if (data.length > 0) {
        setLatestReading(data[0]); // Most recent
      }
      setFetching(false);
    }, (error) => {
      console.error('Error fetching telemetry:', error);
      setFetching(false);
    });

    return () => unsubscribe();
  }, [greenhouseId]);

  const activeReadings = greenhouseId ? readings : [];
  const activeLatest = greenhouseId ? latestReading : null;
  const activeLoading = greenhouseId ? fetching : false;

  return { readings: activeReadings, latestReading: activeLatest, loading: activeLoading };
}
