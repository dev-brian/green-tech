/**
 * Push FCM en la PWA (T6.4 #51, contrato v0.2 §2.6).
 *
 * - Pide permiso de notificaciones al usuario.
 * - Obtiene el token FCM usando el service worker de la PWA (sw.js, que importa
 *   push-sw.js para mostrar la notificación).
 * - Guarda el token en users/{uid}/fcmTokens/{token} con platform 'web'.
 *
 * Requiere VITE_FIREBASE_VAPID_KEY (Firebase Console → Configuración del proyecto →
 * Cloud Messaging → Certificados push web).
 */

import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { app, db } from './firebase';

const VAPID_KEY = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined)?.trim() ?? '';
const STORED_TOKEN_KEY = 'gt-fcm-token';

export type PushStatus =
  | 'unsupported'     // navegador sin Push API / FCM, o modo desarrollo sin service worker
  | 'not-configured'  // falta VITE_FIREBASE_VAPID_KEY
  | 'denied'          // el usuario bloqueó las notificaciones
  | 'default'         // aún no se ha pedido permiso
  | 'enabled';        // permiso concedido y token guardado

export async function isPushSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(STORED_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(STORED_TOKEN_KEY, token);
    else localStorage.removeItem(STORED_TOKEN_KEY);
  } catch {
    // Sin almacenamiento local solo se pierde el atajo; el token sigue en Firestore.
  }
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!(await isPushSupported())) return 'unsupported';
  if (!VAPID_KEY) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted' && readStoredToken()) return 'enabled';
  return 'default';
}

/** Espera al service worker de la PWA; en `pnpm dev` no hay, así que se rinde. */
async function getPwaRegistration(timeoutMs = 10_000): Promise<ServiceWorkerRegistration | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

async function saveToken(uid: string, token: string): Promise<void> {
  // El token es el id del documento: registrar dos veces el mismo dispositivo no duplica.
  const ref = doc(db, 'users', uid, 'fcmTokens', token);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      token,
      platform: 'web',
      lastSeenAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

/**
 * Pide permiso (si hace falta), obtiene el token y lo guarda para el usuario.
 * Debe llamarse desde un gesto del usuario (clic) para que el navegador muestre el aviso.
 */
export async function enablePush(uid: string): Promise<PushStatus> {
  const status = await getPushStatus();
  if (status === 'unsupported' || status === 'not-configured' || status === 'denied') {
    return status;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default';

  const registration = await getPwaRegistration();
  if (!registration) return 'unsupported';

  const token = await getToken(getMessaging(app), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) return 'default';

  const previous = readStoredToken();
  if (previous && previous !== token) {
    await deleteDoc(doc(db, 'users', uid, 'fcmTokens', previous)).catch(() => undefined);
  }
  await saveToken(uid, token);
  writeStoredToken(token);
  return 'enabled';
}

/**
 * Si el usuario ya dio permiso, refresca el token y su lastSeenAt al entrar.
 * FCM puede rotar el token, así que conviene hacerlo en cada sesión.
 */
export async function refreshPushToken(uid: string): Promise<void> {
  if (!VAPID_KEY || !(await isPushSupported())) return;
  if (Notification.permission !== 'granted') return;
  try {
    await enablePush(uid);
  } catch {
    // Refrescar es oportunista: si falla, el botón de la bandeja permite reintentar.
  }
}

/** Da de baja el token del dispositivo (al cerrar sesión o desactivar). */
export async function disablePush(uid: string): Promise<void> {
  const token = readStoredToken();
  writeStoredToken(null);
  if (token) {
    await deleteDoc(doc(db, 'users', uid, 'fcmTokens', token)).catch(() => undefined);
  }
  if (await isPushSupported()) {
    await deleteToken(getMessaging(app)).catch(() => undefined);
  }
}
