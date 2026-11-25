import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'mock_api_key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'mock_auth_domain',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mock_project_id',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'mock_storage_bucket',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'mock_sender_id',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'mock_app_id'
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
/**
 * Caché persistente de Firestore en IndexedDB (T10.1 #59, HU-10).
 * Lo último que se leyó (state/latest, alertas, lecturas) queda guardado en el
 * dispositivo: si se abre la PWA sin señal, las consultas y onSnapshot responden
 * desde la caché, y las escrituras (atender una alerta, cambiar un umbral) se
 * encolan y se envían solas al volver la red.
 * Con varias pestañas abiertas comparten la misma caché. Si el navegador no
 * permite IndexedDB (p. ej. algunas ventanas privadas), el SDK usa caché en
 * memoria y la app sigue funcionando en línea.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const googleProvider = new GoogleAuthProvider();

/**
 * Pruebas e2e (tests/e2e): con VITE_FIREBASE_EMULATORS=true la PWA habla con
 * los emuladores locales de Auth y Firestore en vez del proyecto real. Solo se
 * activa en el build de `pnpm test:e2e`; el build normal no lo trae encendido.
 * El inicio con Google necesita apis.google.com, así que las pruebas entran con
 * correo y contraseña de usuarios creados en el emulador (window.__GT_E2E__).
 */
if (import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  (window as unknown as { __GT_E2E__: unknown }).__GT_E2E__ = {
    signIn: (email: string, password: string) => signInWithEmailAndPassword(auth, email, password),
  };
}
