# Push FCM de alertas críticas

Tareas: T6.4 (#51) en la PWA y T6.5 (#52) en el backend. Contrato: `docs/contrato-datos.md` §2.5 y §2.6.

## Cómo funciona

1. **Registro del dispositivo (PWA).** En *Alertas y Notificaciones* el usuario pulsa **Activar**. La PWA pide permiso, obtiene el token FCM con el service worker de la propia PWA y lo guarda en `users/{uid}/fcmTokens/{token}` con `token`, `platform: "web"`, `createdAt` y `lastSeenAt`. El id del documento es el token, así que registrar dos veces el mismo navegador no duplica. Al volver a entrar se refresca el token; al cerrar sesión o pulsar **Desactivar** se borra.
2. **Envío (backend).** `processIngestedReading` avisa al notificador cuando se **crea** una alerta `critical` o una alerta `warn` activa **sube** a `critical`. Las alertas `warn` y las repeticiones de una alerta ya activa no generan push.
3. **Destinatarios.** `FcmPushNotifier` (`simulator/core/fcmPushNotifier.ts`) lee `greenhouses/{id}.memberIds`, junta los tokens de `users/{uid}/fcmTokens` (PWA y app Android) y envía con `sendEachForMulticast` de firebase-admin. Los tokens que FCM rechaza como no registrados o inválidos se borran.
4. **Notificación (PWA).** `public/push-sw.js` se carga en `sw.js` vía `workbox.importScripts`. Muestra la notificación aunque la PWA esté cerrada y, al tocarla, abre `#/alerts`.

Un fallo de FCM nunca rompe la ingesta: se registra en el log y la lectura y la alerta se guardan igual.

## Configuración pendiente

| Dónde | Qué | Para qué |
| --- | --- | --- |
| Firebase Console → Configuración del proyecto → Cloud Messaging → *Certificados push web* | Generar el par de claves y copiar la **clave pública** | PWA |
| `.env.local` y el build de producción | `VITE_FIREBASE_VAPID_KEY=<clave pública>` | Sin ella, la tarjeta dice "aún no configuradas" |
| Google Cloud → APIs | Habilitar **Firebase Cloud Messaging API (V1)** si no está | Backend |
| GitHub → Secrets | `FIREBASE_SERVICE_ACCOUNT`, `GREENHOUSE_ID`, `DEVICE_INGEST_KEY` (ya pendientes) | El cron de `alert-engine.yml` envía el push |

La cuenta de servicio de firebase-admin ya tiene permiso para enviar mensajes; no hace falta otra credencial.

## Probarlo

1. `pnpm build && pnpm preview` (en `pnpm dev` no hay service worker, así que el push no se registra).
2. Inicia sesión, entra a *Alertas* y pulsa **Activar**. Revisa en Firestore que aparezca `users/{tuUid}/fcmTokens/...`.
3. Con `.env.local` completo: `node simulator/cli.ts --firestore --once --scenario=ph-alto`. El log muestra `[Push] ... enviada a N/M dispositivos`.

## Limitaciones

- iPhone solo recibe push web si la PWA está **instalada en la pantalla de inicio** (iOS 16.4+).
- Con la PWA abierta en primer plano también se muestra la notificación del sistema; la bandeja se actualiza sola por Firestore.
