# Esquema de datos de Firebase GREEN TECH (v0.2)

> Estado: **acordado en #green-tech-dev el 4 nov 2026** con Rodrigo y Gael (tarea #32). La sección 1 describe lo que la PWA **ya usa hoy** en Firestore. La sección 2 es el **esquema v1** para el modelo hidropónico de 7 variables, que usan la PWA y la app Flutter. Nada de la sección 2 está implementado todavía.

Convenciones: nombres de campos en `camelCase` inglés; fechas como `Timestamp` de Firestore (en el modelo actual algunas son string ISO 8601, ver notas); unidades en SI o las indicadas. Cualquier cambio a este archivo entra por PR y lo aprueba alguien de la PWA y alguien de la app.

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
| `createdAt` | string ISO | ⚠️ string, no Timestamp. Obligatorio: `getPlants` ordena por este campo, así que una planta sin él no aparece en la PWA |

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

## 2. Esquema v1 (hidropónico)

Todo cuelga del invernadero, para que las reglas se resuelvan con `isMember(greenhouseId)`. Las lecturas, el último estado y las alertas los escribe **solo el backend** (Cloud Functions con Admin SDK). Las apps leen; lo único que escriben es atender una alerta y su propio token de push.

### 2.1 Variables

| Campo | Unidad | Rango físico válido (la ingesta rechaza lo que quede fuera) |
| --- | --- | --- |
| `airTemp` | °C | -10 a 60 |
| `humidity` | % HR | 0 a 100 |
| `light` | lux | 0 a 150000 |
| `ph` | pH | 0 a 14 |
| `ec` | mS/cm | 0 a 10 |
| `solutionTemp` | °C | 0 a 50 |
| `tankLevel` | % | 0 a 100 |

`soilMoisture` desaparece de las dos apps.

### 2.2 `greenhouses/{greenhouseId}/readings/{readingId}`

Una lectura **por minuto por zona**. Se conservan **7 días**; una función programada borra las más viejas.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `zoneId` | string | |
| `timestamp` | Timestamp | Hora de la medición |
| `airTemp` … `tankLevel` | number | Las 7 variables de 2.1 |

Consulta del histórico de 24 h: `where zoneId == Z`, `where timestamp >= desde`, `orderBy timestamp`. Necesita el índice compuesto `zoneId ASC, timestamp ASC`.

### 2.3 `greenhouses/{greenhouseId}/readingsHourly/{zoneId}_{yyyyMMddHH}`

Promedios por hora, para las gráficas de 7 y 30 días sin leer miles de lecturas. Se conservan **30 días**.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `zoneId` | string | |
| `hour` | Timestamp | Inicio de la hora |
| `count` | number | Lecturas que entraron en el promedio |
| `airTemp` … `tankLevel` | map | `{ avg, min, max }` por variable |

### 2.4 `greenhouses/{greenhouseId}/state/latest`

Un solo documento con el último estado de cada zona, que el backend sobrescribe con cada lectura. Sirve para el dashboard y para el modo sin internet. Es el mismo formato que ya lee la app (`docs/firestore-contract.md` en green-tech-app).

```jsonc
{
  "zona-1": {
    "airTemp":      { "value": 22.5, "level": "ok" },
    "ph":           { "value": 7.6,  "level": "critical" },
    // … las 7 variables
    "timestamp": "<Timestamp de la última lectura de esta zona>"
  }
}
```

- `level` ∈ `"ok"` · `"warn"` · `"critical"` y **lo calcula el backend** con los umbrales del invernadero. Ninguna app tiene rangos propios.
- Cada zona trae su `timestamp`, para mostrar "última lectura hace X" y pasar a gris si tiene más de 5 minutos.

### 2.5 `greenhouses/{greenhouseId}/alerts/{alertId}`

Las crea **solo** la Cloud Function que revisa los umbrales al llegar una lectura.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `zoneId` | string | |
| `variable` | string | Una de las 7 de 2.1 |
| `severity` | `"warn"` \| `"critical"` | Mismos valores que `level` |
| `value` | number | Lectura que disparó la alerta |
| `message` | string | Texto para mostrar |
| `status` | `"new"` \| `"attended"` \| `"auto_resolved"` | |
| `createdAt` | Timestamp | |
| `attendedBy` | string \| null | UID |
| `attendedAt`, `resolvedAt` | Timestamp \| null | |

- **Sin duplicados:** la función no crea otra alerta si ya hay una con el mismo `zoneId` y `variable` en `status == "new"`. Cuando la variable vuelve a `ok`, la marca `auto_resolved`.
- **Atender:** un miembro puede actualizar **solo** `status` (a `"attended"`), `attendedBy` (su propio UID) y `attendedAt`. Cualquier otro campo se rechaza en las reglas.
- **Push:** al crear una alerta `critical`, la función envía la notificación a los tokens de todos los miembros del invernadero (2.6).

### 2.6 `users/{uid}/fcmTokens/{tokenId}`

Tokens de Firebase Cloud Messaging de cada usuario, de la PWA y de la app.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `token` | string | |
| `platform` | `"web"` \| `"android"` | |
| `createdAt`, `lastSeenAt` | Timestamp | |

Solo el propio usuario puede leer y escribir sus tokens. La función borra los que FCM reporte como inválidos.

### 2.7 Ingesta

`POST /ingestTelemetry` (Cloud Function HTTP), cabecera `x-device-key`. La llama el simulador cada minuto por zona. Valida la clave, las unidades y los rangos de 2.1; guarda la lectura en `readings` y actualiza `state/latest`.

```json
{
  "greenhouseId": "abc123",
  "zoneId": "zona-1",
  "timestamp": "2026-11-03T18:00:00Z",
  "readings": { "airTemp": 24.1, "humidity": 68, "light": 32000, "ph": 6.1, "ec": 1.8, "solutionTemp": 21.5, "tankLevel": 74 }
}
```

### 2.8 Reglas (resumen)

- Solo el admin edita el invernadero y sus miembros; un usuario solo puede unirse a sí mismo como operador con un código válido. Hoy cualquier usuario con sesión puede hacerse admin, y eso se cierra en T11.1 (#26).
- `readings`, `readingsHourly`, `state` y `alerts`: lectura para miembros; escritura solo del backend, salvo atender alertas (2.5).
- `users/{uid}/fcmTokens`: solo el propio usuario.

### 2.9 Migración

- Las fechas pasan a `Timestamp` (hoy algunas son string ISO).
- `telemetry_data` y `alerts` en la raíz dejan de usarse.
- La PWA apaga `USE_LOCAL_DEMO_DATA` y deja de crear alertas desde el navegador (#29, #49).

## 3. Preguntas abiertas

- Alexa: para el semáforo y el selector de zonas, ¿falta algún campo además de `zoneId`? Falta definir la colección `zones` (nombre y cultivo de cada zona, T4.1).
- ¿Con una lectura por minuto los promedios por hora bastan para 7 días, o conviene leer crudas también ahí?
