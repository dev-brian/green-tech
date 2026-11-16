/*
 * Manejo de notificaciones push FCM dentro del service worker de la PWA (T6.4 #51).
 * Workbox lo carga con importScripts desde sw.js (ver vite.config.ts).
 *
 * El backend (simulator/core/fcmPushNotifier.ts) envía un mensaje con
 * `notification` (título y cuerpo) y `data` (greenhouseId, alertId, zoneId,
 * variable, severity). Aquí se muestra siempre, con la app abierta o cerrada.
 */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { notification: { body: event.data ? event.data.text() : '' } };
  }

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || 'GreenTech: alerta crítica';
  const tag = notification.tag || (data.zoneId && data.variable ? `alert-${data.zoneId}-${data.variable}` : 'greentech-alert');

  event.waitUntil(
    self.registration.showNotification(title, {
      body: notification.body || '',
      icon: notification.icon || 'pwa-192x192.png',
      badge: 'pwa-192x192.png',
      tag,
      renotify: true,
      requireInteraction: notification.requireInteraction !== false,
      data,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // La PWA usa HashRouter: la bandeja de alertas vive en <scope>#/alerts
  const target = new URL('#/alerts', self.registration.scope).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope)) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
