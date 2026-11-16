# Latencia de alertas (T6.6 #53)

Criterio de HU-06 (#47): *dado que nadie tiene la app abierta, cuando una lectura sale de rango, se crea una alerta en menos de 5 s*.

## Cómo se mide

`tests/alertLatency.emulator.mjs` corre contra el emulador de Firestore:

1. Un operador con sesión escucha `greenhouses/{id}/alerts` con `onSnapshot`, pasando por `firestore.rules` igual que la PWA.
2. El reloj arranca y se manda `POST /ingestTelemetry` al servidor de ingesta real (`simulator/server.ts`) con pH 7.6 en jitomate (rojo arriba de 7.0).
3. El servidor escribe con Admin SDK (`FirestoreTelemetryStorage`), igual que en producción con el Plan B Spark.
4. El reloj para cuando el operador recibe la alerta `new`.

Se mide la primera lectura del invernadero (sin calentar nada) y 5 zonas seguidas; ninguna puede tardar 5 s o más. También comprueba que no se duplique la alerta activa.

## Correrla

```bash
pnpm test:emulator   # necesita Java y firebase-tools
```

CI la corre en cada PR a `develop` y `main` (paso "Pruebas con Firebase Emulator").

## Resultado (15 nov 2026, contenedor de CI)

| Caso | Tiempo |
| --- | --- |
| Primera lectura, alerta visible para el operador | ~150–240 ms |
| 5 zonas seguidas, peor caso | ~90–100 ms |

## Lo que esta prueba no cubre

- La red real entre el sensor y el servidor, y entre Firestore y el celular.
- El cron de `alert-engine.yml` (cada 5 min) **no cumple** el criterio por sí solo: una lectura que entra por el cron puede esperar hasta 5 min. Los < 5 s se cumplen cuando el sensor o el simulador manda al servidor de ingesta en cuanto mide (`POST /ingestTelemetry`).
- El push FCM (T6.5 #52) va después de crear la alerta y se mide aparte.
