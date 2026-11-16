# PWA sin internet (HU-10)

## Qué ya funciona

| Pieza | Dónde | Qué guarda |
| --- | --- | --- |
| Service worker (Workbox, `vite-plugin-pwa`) | `vite.config.ts` | HTML, JS, CSS e íconos: la PWA abre sin red |
| Caché persistente de Firestore (T10.1 #59) | `src/lib/firebase.ts` | Lo último que se leyó: `state/latest`, alertas, lecturas, umbrales, invernaderos del usuario |
| Sesión de Firebase Auth | SDK (IndexedDB) | El usuario sigue con sesión al abrir sin red |

Las escrituras hechas sin red (atender una alerta, cambiar un umbral) quedan en la cola del SDK y se envían solas al volver la conexión. Con varias pestañas abiertas, todas comparten la misma caché.

## Lo que falta (otras tareas de HU-10)

- **T10.2 #60:** aviso "Sin conexión · datos de las HH:MM". Se puede saber con `snapshot.metadata.fromCache` y el `timestamp` de cada zona en `state/latest`.
- **T10.3 #61:** marcar cambios pendientes. Sin red, el `await updateDoc(...)` **no termina** hasta que vuelve la conexión, así que un botón que espere esa promesa se queda cargando. Hay que actualizar la interfaz sin esperarla y usar `snapshot.metadata.hasPendingWrites` para mostrar "pendiente".

## Cómo probarlo (T10.4 #62)

1. Abrir la PWA publicada con internet, iniciar sesión y entrar al dashboard y a alertas.
2. Poner el dispositivo en modo avión (o en Chrome: DevTools → Network → Offline).
3. Cerrar la PWA y volver a abrirla: debe verse el último estado de las zonas y las alertas que ya se habían visto.
4. Atender una alerta sin red, quitar el modo avión y revisar en otro dispositivo que quedó atendida.

Comprobado en Chromium con el emulador de Firestore: tras recargar sin red, `state/latest` se lee desde la caché; sin la caché persistente la misma lectura llega vacía.
