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
  })
);

const HOURS = Number(args.hours ?? 24);
const INTERVAL_MIN = Number(args.interval ?? 30);
const NODE_ID = args.nodeId ?? 'ESP32-SIM-01';
const SECTOR = args.sector ?? 'Sector 1';
const CLEAR = Boolean(args.clear);

const THRESHOLDS = {
  temperature: { redMin: 12, yellowMin: 18, yellowMax: 27, redMax: 32 },
  humidity: { redMin: 40, yellowMin: 60, yellowMax: 80, redMax: 90 },
  soilMoisture: { redMin: 40, yellowMin: 60, yellowMax: 80, redMax: 90 },
};

function statusFor(value, t) {
  if (value < t.redMin || value > t.redMax) return 'red';
  if (value < t.yellowMin || value > t.yellowMax) return 'yellow';
  return 'green';
}

function worstOf(...statuses) {
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('yellow')) return 'yellow';
  return 'green';
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

  for (let i = points; i >= 0; i--) {
    const t = new Date(now - i * intervalMin * 60 * 1000);
    const hourOfDay = t.getHours() + t.getMinutes() / 60;

    const dayPhase = Math.sin(((hourOfDay - 8) / 24) * 2 * Math.PI);

    let temperature = 22 + dayPhase * 6 + (Math.random() - 0.5) * 1.5;
    let humidity = 68 - dayPhase * 12 + (Math.random() - 0.5) * 4;
    let soilMoisture = 65 + Math.sin((i / points) * Math.PI * 3) * 15 + (Math.random() - 0.5) * 3;


    if (i === Math.floor(points * 0.3)) temperature += 11;
    if (i === Math.floor(points * 0.65)) soilMoisture -= 30;

    temperature = Math.round(temperature * 10) / 10;
    humidity = Math.max(0, Math.min(100, Math.round(humidity)));
    soilMoisture = Math.max(0, Math.min(100, Math.round(soilMoisture)));

    const tempStatus = statusFor(temperature, THRESHOLDS.temperature);
    const humStatus = statusFor(humidity, THRESHOLDS.humidity);
    const soilStatus = statusFor(soilMoisture, THRESHOLDS.soilMoisture);

    readings.push({
      greenhouseId,
      nodeId: NODE_ID,
      sector: SECTOR,
      timestamp: Timestamp.fromDate(t),
      temperature,
      humidity,
      soilMoisture,
      semaphoreStatus: worstOf(tempStatus, humStatus, soilStatus),
      simulated: true,
    });
  }
  return readings;
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
    collection(db, 'telemetry_data'),
    where('greenhouseId', '==', greenhouseId),
    where('simulated', '==', true)
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
    console.error('✗ No se pudo autenticar de forma anónima.');
    console.error('  Habilita el proveedor "Anonymous" en Firebase Console → Authentication → Sign-in method.');
    console.error('  Detalle:', err.message);
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
  const readings = generateReadings(greenhouseId, HOURS, INTERVAL_MIN);

  const chunks = [];
  for (let i = 0; i < readings.length; i += 450) chunks.push(readings.slice(i, i + 450));

  let written = 0;
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((reading) => {
      const ref = doc(collection(db, 'telemetry_data'));
      batch.set(ref, reading);
    });
    await batch.commit();
    written += chunk.length;
  }

  console.log(`✓ Listo: ${written} lecturas de prueba escritas en telemetry_data.`);
  console.log('  Abre el Dashboard — el histórico y las tarjetas deberían mostrar estos datos en unos segundos.');
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ Error inesperado:', err);
  process.exit(1);
});
