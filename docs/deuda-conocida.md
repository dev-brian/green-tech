# Deuda técnica conocida

Lo que la auditoría previa (16 nov 2026) encontró y **decidimos no resolver antes de la entrega del 30 nov**. Cada punto dice por qué se quedó así, qué riesgo implica hoy y qué haría falta para cerrarlo.

Lo ya corregido de la auditoría: C1 (#114), C4 (#115), A4 (#113), C2 (#116), A2 (#117), A5 (#118), A6 (#119), A7 (#120), A8 (#121), A9 (#122) y la parte simple de C3 (#123).

## C3. Una sola clave de dispositivo para todos los invernaderos

**Qué pasa.** `POST /ingestTelemetry` valida una única `DEVICE_INGEST_KEY` y toma `greenhouseId` del cuerpo. Las escrituras van con el Admin SDK, que se salta las reglas. Quien tenga la clave puede inyectar lecturas, crear alertas y disparar push en cualquier invernadero.

**Qué ya se mitigó (#123).** Comparación en tiempo constante, clave también en `/actuatorsState`, cuerpo de 16 KB máximo, `zoneId` validado, hora del dispositivo acotada y la variable opcional `INGEST_GREENHOUSE_IDS` para limitar la clave a una lista de invernaderos.

**Por qué no se hizo completo.** Hoy no hay sensores reales: solo escribe el simulador, desde el cron de GitHub o desde una máquina de desarrollo. La clave por dispositivo pide un registro de dispositivos y una pantalla para darlos de alta. No cabe antes del congelamiento del 24 nov.

**Riesgo hoy.** Bajo mientras la clave solo viva en los secretos de GitHub y en `.env.local`. Se vuelve **crítico el día que la clave se grabe en un ESP32**, porque se puede leer del firmware.

**Para cerrarlo.**

1. Colección `devices/{deviceId}` con `keyHash` (SHA-256), `greenhouseId` y `zoneIds` permitidas. Solo el backend la lee y la escribe.
2. El dispositivo manda `x-device-id` y `x-device-key`. El servidor compara el hash y **toma `greenhouseId` del registro, no del cuerpo**.
3. Pantalla de admin para dar de alta y revocar dispositivos.

## A3. El motor de alertas en producción es el simulador

**Qué pasa.** `.github/workflows/alert-engine.yml` corre cada 5 min `simulator/cli.ts --firestore --once`, que inventa lecturas para el invernadero de `GREENHOUSE_ID`, evalúa alertas y manda push reales.

- Cada corrida arranca desde los valores iniciales, así que los datos casi no cambian.
- GitHub retrasa los cron varios minutos (en la práctica corre cada 5 a 9 horas). #116 subió el umbral de "sin datos" a 15 min, pero el 25 nov volvió a 5 min para coincidir con la HU-03 y la app: con datos solo del cron, las zonas se ven en gris. En la demo las lecturas llegan del simulador cada minuto.
- GitHub **desactiva los cron tras 60 días sin actividad** en el repositorio.
- La purga solo limpia el invernadero de `GREENHOUSE_ID`; los demás crecen sin límite.

**Por qué se quedó así.** El proyecto está en el plan Spark gratuito (issue #30). Cloud Functions y Cloud Scheduler piden el plan Blaze. Para la entrega, el simulador en cron es suficiente como demostración.

**Riesgo hoy.** Aceptable para la demo. No sirve para un invernadero real: el cron escribe lecturas falsas sobre él.

**Para cerrarlo.**

1. Decidir dónde corre la ingesta real: Cloud Run o Cloud Functions con Cloud Scheduler (Blaze), o un servidor propio con `simulator/serve.ts --firestore`.
2. Dejar el cron solo para un invernadero marcado como demostración.
3. Purgar todos los invernaderos, no solo el de `GREENHOUSE_ID`.
4. Cuando haya ingesta real, que el backend cree una alerta "zona sin datos" para que llegue por push aunque nadie tenga la app abierta. Con el simulador en cron esa alerta nunca se dispararía, por eso no se hizo en #116.

## A1. Tres juegos de umbrales que no coinciden

**Qué pasa.**

- El backend evalúa cada zona con el perfil de su cultivo (`simulator/core/hydroponicModel.ts`). Por ejemplo, la EC ideal del jitomate es 2.0 a 3.5 y la de la lechuga 0.8 a 1.2.
- La PWA dibuja medidores y consejos con una tabla genérica (`src/lib/sensorThresholds.ts`, EC 1.2 a 2.4).
- Los umbrales se guardan **uno por invernadero** y el backend los aplica encima del perfil de cualquier cultivo. "Restaurar valores de fábrica" escribe la tabla genérica, y después la lechuga sana y el jitomate sano pasan a precaución.

**Qué ya ayuda.** El color de cada variable en el tablero viene del `level` que calculó el backend, no de la tabla local. Por eso el semáforo es correcto; lo que no cuadra es la banda verde del medidor y el texto "Ideal …". Las reglas (#114) ya validan el orden `redMin ≤ yellowMin ≤ yellowMax ≤ redMax`.

**Por qué no se hizo.** Es un cambio de esquema que afecta a la app Flutter y choca con el PR #108 de Gael, que agrega perfiles por cultivo pero con un solo juego por invernadero. Conviene resolverlo junto con ese PR.

**Para cerrarlo.**

1. Una sola fuente de perfiles por cultivo, compartida por backend y PWA.
2. Guardar ajustes por cultivo (`thresholds.{crop}.{variable}`) y solo las diferencias respecto al perfil.
3. Que el backend escriba en `state/latest` los rangos con los que evaluó cada zona, y que la PWA y la app dibujen esos.
4. Quitar "Restaurar valores de fábrica" mientras siga escribiendo la tabla genérica.

## Otros pendientes menores que quedaron fuera

| Qué | Por qué | Dónde |
| --- | --- | --- |
| Reglas e índices de Firestore se publican a mano | Automatizarlo pide una cuenta de servicio con permiso de administrar reglas | A7 |
| Firebase Auth y Firestore siguen en el paquete inicial | `AuthProvider` envuelve toda la app, incluida la landing | A8 |
| `PlantManagement` usa `alert()` y `confirm()` nativos | Reemplazarlos pide un diálogo propio; va con el rediseño visual | A5 |
| La app Flutter no calcula "sin datos" | Se queda en verde si el sensor deja de enviar; misma regla que la PWA: gris a los 5 min | C2 |
| Login en la PWA instalada en iPhone sin probar | No tenemos iPhone con la PWA instalada | A9 |
| Subir a Firebase 13 | Las vulnerabilidades que quedan en `pnpm audit` son transitivas de `firebase` y `firebase-admin`; el salto de versión mayor se deja para después del MVP | A4 |
