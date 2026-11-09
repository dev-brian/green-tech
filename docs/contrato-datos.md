# Esquema de datos de Firebase GREEN TECH (v0.2)

> Estado: **acordado en #green-tech-dev el 4 nov 2026** con Rodrigo y Gael (tarea #32). La sección 1 describe lo que la PWA **usaba antes** en Firestore. La sección 2 es el **esquema v1** para el modelo hidropónico de 7 variables, que usan la PWA y la app Flutter.

Convenciones: nombres de campos en `camelCase` inglés; fechas como `Timestamp` de Firestore (o ISO 8601 en respuestas HTTP); unidades en SI o las indicadas. Cualquier cambio a este archivo entra por PR y lo aprueba alguien de la PWA y alguien de la app.

## 1. Modelo base (invernaderos, miembros y plantas)

### `greenhouses/{greenhouseId}`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `name` | string | Nombre del invernadero |
| `inviteCode` | string | Código para que un operador se una |
| `inviteCodeCreatedAt` | string ISO | |
| `memberIds` | string[] | UIDs de miembros; se usa con `array-contains` |
| `createdAt` | string ISO | |
| `thresholds` | map | Umbrales personalizados por cultivo/variable |

### `greenhouses/{greenhouseId}/members/{uid}`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `role` | `"admin"` \| `"operador"` | |
| `email`, `name` | string | |
| `joinedAt` | string ISO | |
| `inviteCode` | string | Obligatorio al unirse como `"operador"` (validado en `firestore.rules`) |

### `greenhouses/{greenhouseId}/plants/{plantId}`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `name`, `status` | string | |
| `active` | bool | |
| `reqs` | map | `{ tempMin, tempMax, humidity, soilMoisture, lightHours }` |
| `createdAt` | string ISO | Obligatorio: `getPlants` ordena por este campo |

## 2. Esquema v1 (hidropónico)

Todo cuelga del invernadero, para que las reglas se resuelvan con `isMember(greenhouseId)`. Las lecturas, el último estado y las alertas los escribe **solo el backend** (proceso Node en servidor/GitHub Actions bajo el Plan B gratuito Spark, o Cloud Functions). Las apps leen; lo único que escriben los clientes es atender una alerta y su propio token de push.

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

Una lectura **por minuto por zona**. Se conservan **7 días**; una tarea programada borra las más viejas.

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

Las crea **solo** el motor del backend al evaluar los umbrales tras llegar una lectura.

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

- **Sin duplicados:** el backend no crea otra alerta si ya hay una con el mismo `zoneId` y `variable` en `status == "new"`. Cuando la variable vuelve a `ok`, la marca `auto_resolved`.
- **Atender:** un miembro puede actualizar **solo** `status` (a `"attended"`), `attendedBy` (su propio UID) y `attendedAt`. Cualquier otro campo se rechaza en las reglas.
- **Push:** al crear una alerta `critical`, la función envía la notificación a los tokens de todos los miembros del invernadero (2.6).

### 2.6 `users/{uid}/fcmTokens/{tokenId}`

Tokens de Firebase Cloud Messaging de cada usuario, de la PWA y de la app.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `token` | string | |
| `platform` | `"web"` \| `"android"` | |
| `createdAt`, `lastSeenAt` | Timestamp | |

Solo el propio usuario puede leer y escribir sus tokens.

### 2.7 Ingesta y Actuadores Virtuales (Endpoints HTTP)

- **`POST /ingestTelemetry`**: cabecera `x-device-key`. La llama el simulador (`simulator/cli.ts`) cada minuto por zona. Valida la clave, las unidades y los rangos físicos de 2.1; guarda la lectura en `readings`, actualiza `state/latest`, evalúa alertas (`alerts`) y actualiza los actuadores virtuales (`actuators`).

```json
{
  "greenhouseId": "abc123",
  "zoneId": "zona-1",
  "crop": "jitomate",
  "timestamp": "2026-11-08T12:00:00Z",
  "readings": { "airTemp": 24.1, "humidity": 68, "light": 32000, "ph": 6.1, "ec": 2.4, "solutionTemp": 21.5, "tankLevel": 84 }
}
```

- **`GET /actuatorsState?greenhouseId=abc123&zoneId=zona-1`**: endpoint de solo lectura del estado de los 4 actuadores virtuales (`recirculationPump`, `phDoser`, `nutrientDoser`, `ventilation`) para el lazo cerrado del simulador (T8.3 #69).
- **Plan B sin costo (T11.5 #30):** Para operar en el plan gratuito **Firebase Spark** sin pagar Blaze, el servidor HTTP y el motor de alertas corren en Node (`simulator/server.ts` y `simulator/cli.ts`) y mediante el workflow programado `.github/workflows/alert-engine.yml` cada 5 minutos.

### 2.8 Reglas (resumen)

- Solo el admin edita el invernadero y sus miembros; un usuario solo puede unirse a sí mismo como operador con un código válido (`T11.1 #26`).
- `readings`, `readingsHourly`, `state` y `alerts`: lectura para miembros; escritura solo del backend, salvo atender alertas (2.5).
- `users/{uid}/fcmTokens`: solo el propio usuario.
