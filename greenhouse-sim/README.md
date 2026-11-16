# Simulador interactivo de invernadero

Gemelo digital de un invernadero hidropónico para GreenTech. Corre como un proceso aparte y se comporta como los nodos de sensores reales: mide, arma el JSON del contrato (`docs/contrato-datos.md`, sección 2.7) y lo publica por `POST /ingestTelemetry` con la cabecera `x-device-key`. La PWA y la app no necesitan ningún cambio para verlo.

Diseño completo (arquitectura, modelo de datos, UI y escenarios): https://claude.ai/artifact/JLVayLVWsUR5RCWVxFXYbJ

## Cómo usarlo

### 1. Probar sin configurar nada

```bash
pnpm sim:demo
```

Levanta la ingesta en memoria y el simulador, cada uno en su proceso, y abre la interfaz en http://localhost:4100. Nada llega a Firestore. Sirve para conocer la interfaz y ensayar escenarios.

### 2. Verlo en la PWA y la app (Firestore real)

En `.env.local` hacen falta `DEVICE_INGEST_KEY`, `GREENHOUSE_ID` y `FIREBASE_SERVICE_ACCOUNT` (ver `.env.local.example`). En dos terminales:

```bash
pnpm ingest:firestore   # backend de ingesta en http://127.0.0.1:8787, escribe en Firestore
pnpm sim                # simulador + interfaz en http://localhost:4100
```

Abre la PWA o la app con un usuario miembro de ese invernadero: las lecturas, el semáforo y las alertas aparecen en tiempo real.

### 3. Sin interfaz

```bash
pnpm sim --headless --scenario=sube-ph --speed=60 --interval=10
pnpm sim --once          # un solo ciclo de publicación (para tareas programadas)
```

### Opciones

| Argumento | Variable | Por defecto | Para qué |
| --- | --- | --- | --- |
| `--ingestUrl` | `INGEST_URL` | `http://127.0.0.1:8787` | A dónde publica |
| `--deviceKey` | `DEVICE_INGEST_KEY` | (obligatoria) | Clave del dispositivo |
| `--greenhouseId` | `GREENHOUSE_ID` | (obligatorio) | Invernadero que recibe las lecturas |
| `--port` | `SIM_PORT` | `4100` | Puerto de la interfaz |
| `--interval` | `SIM_PUBLISH_INTERVAL` | `60` | Segundos reales entre lecturas |
| `--speed` | `SIM_SPEED` | `1` | Velocidad de la física |

No hay clave por defecto: sin `DEVICE_INGEST_KEY` ni el simulador ni la ingesta arrancan.

## Qué simula

Tres zonas, cada una con su circuito completo: tanque de 200 L, bomba de recirculación, camas, dosificadora de ácido, dosificadora de nutrientes, bomba de llenado, ventilación, lámparas y un nodo de sensores. Comparten clima exterior, red eléctrica e internet.

Las 7 variables salen de balances que se afectan entre sí (`model/world.ts`): la transpiración baja el nivel y concentra las sales, el agua de llenado diluye y sube el pH, las lámparas y el sol calientan el aire, la solución sigue al aire con retraso. Cada zona tiene un controlador local que mantiene todo en verde en operación normal, y además obedece las órdenes del backend (`GET /actuatorsState`).

La velocidad (x1 a x300) acelera solo la física. La hora de cada lectura publicada es siempre la real.

## Escenarios incluidos

| Id | Qué pasa | Qué se ve en la PWA y la app |
| --- | --- | --- |
| `demo-guiada` | pH alto, reparación y corte de luz encadenados | Alerta que escala y se resuelve; luego luz en rojo |
| `sube-ph` | Agua alcalina y dosificadora de ácido vacía | pH amarillo, rojo, y recuperación |
| `sobredosis-acido` | Dosificadora de ácido pegada | pH rojo por abajo |
| `sin-nutrientes` | Dosificadora de nutrientes sin responder | EC baja poco a poco |
| `falla-bomba-llenado` | No se repone agua | Nivel amarillo y rojo; el backend apaga la recirculación |
| `fuga-tanque` | Fuga de 150 L/h | Nivel cae rápido |
| `falla-bomba-recirculacion` | La bomba se detiene | Nivel sube unos puntos; sin alerta directa (ver límites) |
| `corte-de-luz` | Sin electricidad de noche, nodos con batería | Luz en rojo en todas las zonas |
| `apagon-total` | Sin electricidad ni nodos | Zonas "sin datos" a los 5 minutos |
| `ola-de-calor` | Exterior +12 °C | Temperatura en rojo, humedad baja |
| `sin-internet` | Se cae la conexión | Zonas congeladas; al volver llega el atraso |
| `sonda-ph-descalibrada` | La sonda marca 0.8 de más | Alerta falsa y sobredosis real |
| `sonda-desconectada` | Sonda de temperatura suelta (-127 °C) | La ingesta rechaza con 422; zona "sin datos" |

Desde la interfaz se arman escenarios propios (pestaña Escenarios, "Crear escenario propio"). Se guardan en `greenhouse-sim/data/scenarios.json`, que no se sube a git.

## Estructura

| Carpeta | Responsabilidad |
| --- | --- |
| `model/` | Física, comandos y tipos. Sin red ni DOM |
| `scenarios/` | Biblioteca de escenarios y reproductor |
| `devices/` | Nodo de sensores: ruido, fallas de sonda y armado del JSON |
| `publisher/` | Cliente HTTP de la ingesta con cola de reenvío |
| `simulation.ts` | Une mundo, escenario, nodos y publicador |
| `server.ts` | Proceso principal: reloj, API de control local, eventos y UI |
| `ui/` | Vista React + SVG (Vite en modo middleware, sin paso de build) |

El simulador importa del backend (`simulator/core/`) únicamente tipos. Todo lo demás pasa por HTTP, así que cambiar a hardware real es apuntar un ESP32 a la misma URL con la misma clave y apagar este proceso.

La API de control (`/api/*`) solo escucha en `127.0.0.1` y no tiene autenticación: es una herramienta local.

## Límites conocidos

- **La falla de la bomba de recirculación no dispara alerta.** Ninguna de las 7 variables del contrato mide flujo. Haría falta una variable de flujo o el estado real de los equipos en una versión nueva del contrato.
- **Los umbrales no conocen la noche.** Las lámparas del simulador mantienen un mínimo de luz nocturno para no generar alertas falsas.
- **Solo jitomate y lechuga.** La ingesta no conoce otros cultivos; la zona 3 usa los umbrales de lechuga.
- **Cuota de Firestore (plan Spark).** Cada lectura cuesta unas 3 escrituras y 10 lecturas. Con 3 zonas cada 60 s son 540 escrituras por hora y aguanta el día; cada 10 s la cuota diaria se acaba en unas 5 horas. La interfaz muestra el gasto estimado.
- **Escenarios en tiempo real.** `apagon-total`, `sin-internet` y `sonda-desconectada` duran 7 minutos reales porque las apps marcan "sin datos" a los 5 minutos de reloj real.

## Pruebas

```bash
pnpm test   # incluye tests/greenhouseSim.test.ts
```

Cubren la física (48 h en verde, escenarios), el formato del contrato y el recorrido completo contra la ingesta real en memoria: alertas, órdenes de actuadores, clave incorrecta y cola sin internet.
