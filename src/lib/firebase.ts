import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
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

const app = initializeApp(firebaseConfig);

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
