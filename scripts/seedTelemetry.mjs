import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const HOURS = Number(args.hours ?? 12);
const INTERVAL_MIN = Number(args.interval ?? 30);
const NODE_ID = args.nodeId ?? 'ESP32-SIM-01';
const CLEAR = Boolean(args.clear);

const ZONES = [
  { zoneId: 'zona-1', crop: 'Lechuga NFT', basePh: 6.0, baseEc: 1.4 },
  { zoneId: 'zona-2', crop: 'Jitomate DWC', basePh: 6.2, baseEc: 2.2 },
  { zoneId: 'zona-3', crop: 'Hierbas Aromáticas', basePh: 5.9, baseEc: 1.6 },
];

const THRESHOLDS = {
  airTemp:      { redMin: 12, yellowMin: 18, yellowMax: 27, redMax: 32 },
  humidity:     { redMin: 40, yellowMin: 55, yellowMax: 75, redMax: 85 },
  light:        { redMin: 2000, yellowMin: 8000, yellowMax: 32000, redMax: 42000 },
  ph:           { redMin: 5.0, yellowMin: 5.5, yellowMax: 6.5, redMax: 7.2 },
  ec:           { redMin: 0.8, yellowMin: 1.2, yellowMax: 2.4, redMax: 3.0 },
  solutionTemp: { redMin: 14, yellowMin: 18, yellowMax: 24, redMax: 28 },
  tankLevel:    { redMin: 20, yellowMin: 40, yellowMax: 95, redMax: 100 },
};

function levelFor(value, t) {
  if (value < t.redMin || value > t.redMax) return 'critical';
  if (value < t.yellowMin || value > t.yellowMax) return 'warn';
  return 'ok';
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error('✗ No se encontró VITE_FIREBASE_PROJECT_ID. ¿Corres esto desde la raíz del proyecto (junto a .env.local)?');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function generateReadings(greenhouseId, hours, intervalMin) {
  const points = Math.floor((hours * 60) / intervalMin);
  const now = Date.now();
  const readings = [];
  const latestState = {};

  for (let i = points; i >= 0; i--) {
    const t = new Date(now - i * intervalMin * 60 * 1000);
    const hourOfDay = t.getHours() + t.getMinutes() / 60;
    const dayPhase = Math.sin(((hourOfDay - 8) / 24) * 2 * Math.PI);

    for (const z of ZONES) {
      let airTemp = Number((22 + dayPhase * 5 + (Math.random() - 0.5) * 1.2).toFixed(1));
      let humidity = Math.max(30, Math.min(95, Math.round(66 - dayPhase * 10 + (Math.random() - 0.5) * 4)));
      let light = Math.max(500, Math.round((dayPhase > 0 ? 18000 * dayPhase : 3500) + (Math.random() - 0.5) * 1200));
      let ph = Number((z.basePh + (Math.random() - 0.5) * 0.25).toFixed(2));
      let ec = Number((z.baseEc + (Math.random() - 0.5) * 0.2).toFixed(2));
      let solutionTemp = Number((airTemp - 1.5 + (Math.random() - 0.5) * 0.6).toFixed(1));
      let tankLevel = Math.max(15, Math.min(100, Math.round(88 - ((points - i) / Math.max(1, points)) * 22)));

      if (i === 0 && z.zoneId === 'zona-2') {
        ph = 7.35; // anomalía demostrativa en zona-2
      }

      const ts = Timestamp.fromDate(t);
      const reading = {
        greenhouseId,
        nodeId: NODE_ID,
        zoneId: z.zoneId,
        crop: z.crop,
        timestamp: ts,
        airTemp,
        humidity,
        light,
        ph,
        ec,
        solutionTemp,
        tankLevel,
        simulated: true,
      };
      readings.push(reading);

      if (i === 0) {
        latestState[z.zoneId] = {
          crop: z.crop,
          timestamp: ts,
          airTemp:      { value: airTemp,      level: levelFor(airTemp, THRESHOLDS.airTemp) },
          humidity:     { value: humidity,     level: levelFor(humidity, THRESHOLDS.humidity) },
          light:        { value: light,        level: levelFor(light, THRESHOLDS.light) },
          ph:           { value: ph,           level: levelFor(ph, THRESHOLDS.ph) },
          ec:           { value: ec,           level: levelFor(ec, THRESHOLDS.ec) },
          solutionTemp: { value: solutionTemp, level: levelFor(solutionTemp, THRESHOLDS.solutionTemp) },
          tankLevel:    { value: tankLevel,    level: levelFor(tankLevel, THRESHOLDS.tankLevel) },
        };
      }
    }
  }
  return { readings, latestState };
}

async function resolveGreenhouseId() {
  if (args.greenhouseId) return String(args.greenhouseId);

  const snap = await getDocs(collection(db, 'greenhouses'));
  const options = snap.docs.map((d) => ({ id: d.id, name: d.data().name ?? '(sin nombre)' }));

  if (options.length === 0) {
    console.error('✗ No hay invernaderos (greenhouses) en Firestore todavía. Crea uno desde el onboarding de la app primero.');
    process.exit(1);
  }
  if (options.length === 1) {
    console.log(`→ Usando el único invernadero encontrado: "${options[0].name}" (${options[0].id})`);
    return options[0].id;
  }

  console.log('Hay varios invernaderos. Vuelve a correr el script pasando uno de estos IDs:\n');
  options.forEach((o) => console.log(`  --greenhouseId=${o.id}   (${o.name})`));
  process.exit(1);
}

async function clearSimulated(greenhouseId) {
  const q = query(
    collection(db, 'greenhouses', greenhouseId, 'readings'),
    where('simulated', '==', true),
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log('No había datos simulados previos que borrar.');
    return;
  }
  const chunks = [];
  for (let i = 0; i < snap.docs.length; i += 450) chunks.push(snap.docs.slice(i, i + 450));
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  console.log(`✓ Borrados ${snap.docs.length} documentos simulados previos.`);
}

async function main() {
  console.log('→ Autenticando de forma anónima...');
  try {
    await signInAnonymously(auth);
  } catch (err) {
    console.error('✗ No se pudo autenticar de forma anónima:', err.message);
    process.exit(1);
  }

  const greenhouseId = await resolveGreenhouseId();

  if (CLEAR) {
    console.log(`→ Borrando datos simulados previos de "${greenhouseId}"...`);
    await clearSimulated(greenhouseId);
    if (!args.hours && !args.interval && args.clear === true && process.argv.length <= 4) {
      console.log('Listo. No se generaron datos nuevos (usa sin --clear para sembrar).');
      process.exit(0);
    }
  }

  console.log(`→ Generando ${HOURS}h de historia cada ${INTERVAL_MIN}min para "${greenhouseId}"...`);
  const { readings, latestState } = generateReadings(greenhouseId, HOURS, INTERVAL_MIN);

  const chunks = [];
  for (let i = 0; i < readings.length; i += 450) chunks.push(readings.slice(i, i + 450));

  let written = 0;
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((reading) => {
      const ref = doc(collection(db, 'greenhouses', greenhouseId, 'readings'));
      batch.set(ref, reading);
    });
    await batch.commit();
    written += chunk.length;
  }

  await setDoc(
    doc(db, 'greenhouses', greenhouseId, 'state', 'latest'),
    { ...latestState, updatedAt: Timestamp.now() },
    { merge: true },
  );

  console.log(`✓ Listo: ${written} lecturas escritas en greenhouses/${greenhouseId}/readings y state/latest actualizado.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ Error inesperado:', err);
  process.exit(1);
});
