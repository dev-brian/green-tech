import { useSyncExternalStore } from 'react';

/** Evento no estándar de Chromium; TypeScript no lo incluye en sus tipos del DOM. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * - `prompt`: Android/escritorio con Chromium, se puede abrir el diálogo nativo.
 * - `ios`: iPhone/iPad, solo se instala a mano con "Agregar a inicio".
 * - `none`: ya está instalada o el navegador no ofrece instalación.
 */
export type PwaInstallMode = 'prompt' | 'ios' | 'none';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  // iPadOS se identifica como Mac, pero a diferencia de una Mac tiene pantalla táctil.
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

// El evento puede dispararse antes de montar React, por eso se escucha a nivel de módulo.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  notify();
});

window.addEventListener('appinstalled', () => {
  installed = true;
  deferredPrompt = null;
  notify();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getMode(): PwaInstallMode {
  if (installed || isStandalone()) return 'none';
  if (deferredPrompt) return 'prompt';
  return isIos() ? 'ios' : 'none';
}

async function promptInstall() {
  if (!deferredPrompt) return;
  const event = deferredPrompt;
  await event.prompt();
  await event.userChoice;
  // El navegador solo permite usar cada evento una vez.
  deferredPrompt = null;
  notify();
}

export function usePwaInstall() {
  const mode = useSyncExternalStore(subscribe, getMode);
  return { mode, promptInstall };
}
