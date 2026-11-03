# Contrato de datos GREEN TECH (borrador v0.1)

> Estado: **borrador para acordar con el equipo Flutter** (tarea #32). La sección 1 describe lo que la PWA **ya usa hoy** en Firestore. La sección 2 es la **propuesta v1** para el modelo hidropónico de 7 variables. Nada de la sección 2 está implementado todavía.

Convenciones: nombres de campos en `camelCase` inglés; fechas como `Timestamp` de Firestore (en el modelo actual algunas son string ISO 8601, ver notas); unidades en SI o las indicadas.

## 1. Modelo actual (lo que existe en el código)

### `greenhouses/{greenhouseId}`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `name` | string | Nombre del invernadero |
| `inviteCode` | string | Código para que un operador se una |
| `inviteCodeCreatedAt` | string ISO | ⚠️ string, no Timestamp |
| `memberIds` | string[] | UIDs de miembros; se usa con `array-contains` |
| `createdAt` | string ISO | ⚠️ string, no Timestamp |
| `thresholds` | map | `{ temperature, humidity, soilMoisture }`, cada uno `{ redMin, yellowMin, yellowMax, redMax }` |

### `greenhouses/{greenhouseId}/members/{uid}`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `role` | `"admin"` \| `"operador"` | |
| `email`, `name` | string | |
| `joinedAt` | string ISO | |

### `greenhouses/{greenhouseId}/plants/{plantId}`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `name`, `status` | string | |
| `active` | bool | |
| `reqs` | map | `{ tempMin, tempMax, humidity, soilMoisture, lightHours }` |

### `telemetry_data/{docId}` (colección raíz)

| Campo | Tipo | Unidad |
| --- | --- | --- |
| `greenhouseId`, `nodeId`, `sector` | string | |
| `timestamp` | Timestamp | |
| `temperature` | number | °C |
| `humidity` | number | % HR |
| `soilMoisture` | number | % |
| `semaphoreStatus` | `"green"` \| `"yellow"` \| `"red"` | |

Consulta de la PWA: `where greenhouseId == X`, `orderBy timestamp desc`, `limit 50`.

### `alerts/{alertId}` (colección raíz)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `greenhouseId`, `sector`, `message` | string | |
| `variable` | `"temperature"` \| `"humidity"` \| `"soilMoisture"` | |
| `severity` | `"yellow"` \| `"red"` | |
| `value` | number | Lectura que disparó la alerta |
| `status` | `"new"` \| `"attended"` \| `"auto_resolved"` | |
| `attendedBy` | string \| null | UID |
| `createdAt`, `attendedAt`, `resolvedAt` | Timestamp \| null | |

**Importante:** el dashboard de la PWA hoy lee datos locales del navegador (`USE_LOCAL_DEMO_DATA = true` en `src/hooks/useTelemetrySource.ts`), no esta colección.

## 2. Propuesta v1 (hidropónico, por acordar)

Cambios propuestos, en orden de impacto:

1. **Variables**: reemplazar `soilMoisture` por las 7 variables del PLAN-MVP.

   | Campo | Unidad | Rango físico válido (ingesta rechaza fuera de esto) |
   | --- | --- | --- |
   | `airTemp` | °C | -10 a 60 |
   | `humidity` | % HR | 0 a 100 |
   | `light` | lux | 0 a 150000 |
   | `ph` | pH | 0 a 14 |
   | `ec` | mS/cm | 0 a 10 |
   | `solutionTemp` | °C | 0 a 50 |
   | `tankLevel` | % | 0 a 100 |

2. **Telemetría bajo el invernadero**: `greenhouses/{id}/telemetry/{readingId}` en vez de colección raíz, para que las reglas se resuelvan con `isMember(id)`.
3. **Último estado**: `greenhouses/{id}/zones/{zoneId}` con `lastReading`, `lastSeenAt` y `status`, para que la app Flutter y la PWA lean un solo documento por zona (y para el modo offline).
4. **Alertas** las crea **solo el backend** (Cloud Function), nunca el cliente. El cliente solo actualiza `status`, `attendedBy`, `attendedAt`.
5. **Fechas**: todo `Timestamp` (migrar los string ISO).
6. **Ingesta**: `POST /ingestTelemetry` (Cloud Function HTTP), cabecera `x-device-key`, cuerpo:

   ```json
   {
     "greenhouseId": "abc123",
     "zoneId": "zona-1",
     "timestamp": "2026-11-03T18:00:00Z",
     "readings": { "airTemp": 24.1, "humidity": 68, "light": 32000, "ph": 6.1, "ec": 1.8, "solutionTemp": 21.5, "tankLevel": 74 }
   }
   ```

## 3. Preguntas abiertas para el equipo Flutter

- ¿Aceptan los nombres de campo de la tabla 2.1?
- ¿La app Flutter escribe algo (atender alertas, actuadores) o solo lee?
- ¿Necesitan histórico completo o les basta `zones/{zoneId}.lastReading`?
- ¿Quién mantiene este archivo? Propuesta: cualquier cambio entra por PR y lo aprueba un miembro de cada equipo.
