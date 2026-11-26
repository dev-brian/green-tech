# Monitoreo del sistema con Prometheus, Alertmanager y Grafana

Avisa al **equipo** cuando el sistema deja de funcionar: la ingesta se cae, una zona deja de mandar
lecturas o Firestore responde lento. Las alertas del **cultivo** (pH alto, temperatura) siguen
saliendo del motor de alertas y le llegan al productor por push; esto no las reemplaza.

```
greenhouse-sim / ESP32 ──POST /ingestTelemetry──▶ Ingesta :8787 ──▶ Firestore ──▶ PWA y app
                                                       │
                                                 GET /metrics (cada 15 s)
                                                       ▼
                                             Prometheus :9090 ──▶ Grafana :3000
                                                       │ reglas en firing
                                                       ▼
                                            Alertmanager :9093 ──▶ Slack
```

Solo la ingesta (`simulator/server.ts`) tiene métricas: es el único proceso del proyecto que
siempre está encendido. La PWA está en GitHub Pages y el motor programado corre unos segundos en
GitHub Actions cada 5 minutos; ninguno tiene un servidor que Prometheus pueda leer.

## Qué mide la ingesta (`GET /metrics`)

| Métrica | Qué es |
| --- | --- |
| `greentech_http_request_duration_seconds` | Histograma de duración por ruta, método y código. Su `_count` sirve como contador de peticiones |
| `greentech_readings_accepted_total` | Lecturas aceptadas por zona |
| `greentech_zone_last_reading_timestamp_seconds` | Hora de la última lectura de cada zona |
| `greentech_variable_value` | Último valor de las 7 variables por zona |
| `greentech_variable_level` | Semáforo de cada variable: 0 ok, 1 precaución, 2 crítico |
| `greentech_alerts_created_total` | Alertas de cultivo creadas por el motor |
| `greentech_process_resident_memory_bytes` | Memoria de la ingesta |

El código está en `simulator/core/metrics.ts`, sin dependencias nuevas, y lo prueba
`tests/metrics.test.ts`.

Si se define `METRICS_TOKEN`, `/metrics` pide `Authorization: Bearer <token>` (ver el comentario
en `prometheus.yml`). Sin él, `/metrics` es público para quien llegue al puerto 8787.

## Reglas de alerta (`alerts.yml`)

| Regla | Se dispara cuando | Gravedad |
| --- | --- | --- |
| `IngestaCaida` | Prometheus no puede leer `/metrics` por 1 min | critical |
| `ZonaSinDatos` | Una zona lleva más de 5 min sin lectura (el mismo umbral que pinta la zona en gris) | warning |
| `LecturasRechazadas` | Más de 3 respuestas 4xx/5xx por minuto en `/ingestTelemetry` durante 5 min | warning |
| `IngestaLenta` | El p95 de `/ingestTelemetry` pasa de 2 s durante 5 min | warning |
| `VariableCriticaSostenida` | Una variable lleva 15 min en rojo (¿sensor dañado?) | info |

Alertmanager agrupa por regla y zona, no repite avisos de zona cuando la ingesta está caída
(`inhibit_rules`) y avisa también cuando la alerta se resuelve.

## Cómo levantarlo

Requisitos: Docker Desktop y el `.env.local` de siempre (`DEVICE_INGEST_KEY`, `GREENHOUSE_ID`,
`FIREBASE_SERVICE_ACCOUNT`).

1. **Webhook de Slack.** En Slack: Apps → Incoming Webhooks → Add to Slack → canal
   `#green-tech-monitoreo`. Guarden la URL en `monitoring/secrets/slack_webhook` (una línea, sin
   comillas). Está en `.gitignore`: **nunca la suban**. Debe existir antes de levantar Docker; si no,
   Docker crea una carpeta con ese nombre y Alertmanager no arranca.

2. **Ingesta y simulador**, cada uno en su terminal:

   ```bash
   pnpm ingest:firestore -- --host=0.0.0.0
   pnpm sim
   ```

   `--host=0.0.0.0` hace falta porque Prometheus corre dentro de Docker y para la ingesta es otra
   máquina. Si Windows pregunta por el firewall, permitan solo redes privadas.

3. **Monitoreo:**

   ```bash
   cd monitoring
   docker compose up -d
   ```

4. **Revisar:**

   - [ ] `curl http://localhost:8787/metrics` muestra las métricas `greentech_…`
   - [ ] http://localhost:9090/targets → `greentech-ingesta` en **UP**
   - [ ] http://localhost:9090/alerts → las 5 reglas en verde (*inactive*)
   - [ ] http://localhost:9093 → Alertmanager sin alertas
   - [ ] http://localhost:3000 → tablero «GreenTech · Monitoreo del sistema» con datos

Para validar la configuración sin levantar nada:

```bash
docker run --rm -v "$(pwd -W):/cfg" --entrypoint promtool prom/prometheus:v2.53.0 check config /cfg/prometheus.yml
docker run --rm -v "$(pwd -W):/cfg" --entrypoint amtool prom/alertmanager:v0.27.0 check-config /cfg/alertmanager.yml
```

(En PowerShell usen `${PWD}` en lugar de `$(pwd -W)`.)

## Probar las alertas

| Prueba | Cómo | Qué debe pasar |
| --- | --- | --- |
| Zona sin datos | En el simulador, escenario `apagon-total`, o cerrar `pnpm sim` | A los 5 min la regla pasa a *pending*, al minuto a *firing* y llega 🔴 a Slack |
| Recuperación | Volver a encender el simulador | Llega ✅ resuelta |
| Ingesta caída | Cerrar la terminal de la ingesta | A 1 min llega 🔴 `IngestaCaida`, sin avisos por zona |
| Lecturas rechazadas | Escenario `sonda-desconectada` (la ingesta responde 422) | A los 5 min llega 🔴 `LecturasRechazadas` |

**Para grabar un video o una demo**, bajen los tiempos solo en su copia local (sin subirlo):
`scrape_interval: 5s` en `prometheus.yml`, `> 60` en lugar de `> 300` y `for: 30s` en
`ZonaSinDatos`. Después de editar: `curl -X POST http://localhost:9090/-/reload`.

## Apagar

```bash
docker compose down        # conserva el historial de Prometheus
docker compose down -v     # lo borra
```

## Límites

- Si se apaga la computadora del monitoreo, se pierde el monitoreo, igual que la ingesta. En
  producción irían en un servidor aparte.
- El motor de GitHub Actions no se puede leer con *pull*. Para eso haría falta Pushgateway o
  Grafana Cloud, que reciben métricas por *push*.
- Costo: USD 0. Es software libre, corre local y no consume cuota de Firestore.
