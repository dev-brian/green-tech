# Green Tech — Sistema Inteligente de Cultivo Hidropónico

Green Tech es una **PWA** (Progressive Web App) para monitorear invernaderos
**hidropónicos** en tiempo real. Cada zona publica **7 variables** —temperatura
del aire, humedad relativa, luz, pH, conductividad (EC), temperatura de la
solución y nivel del tanque— y la app las muestra con semáforo de estado,
alertas, histórico gráfico y exportación a CSV/PDF.

El backend (ingesta de lecturas, motor de alertas, notificaciones push y
actuadores virtuales) corre en el **plan gratuito de Firebase (Spark)** mediante
un proceso Node y GitHub Actions, sin Cloud Functions. Todo el intercambio de
datos sigue el contrato publicado en [`docs/contrato-datos.md`](docs/contrato-datos.md).

## 🌟 Características principales

- **Estado por zona (semáforo)**: las 7 variables con niveles `ok` / `warn` /
  `critical` calculados por el backend, con las zonas más urgentes primero.
- **Zonas de cultivo**: cada invernadero se divide en zonas con su propio
  cultivo, freshness y histórico por separado.
- **Alertas**: el motor evalúa los umbrales tras cada lectura y crea alertas sin
  duplicados; cualquier miembro puede marcar una alerta como atendida.
- **Notificaciones push (FCM)**: con permiso explícito (opt-in) y deep link a la
  bandeja de alertas desde el aviso.
- **Histórico y exportación**: gráficas por zona con exportación a **CSV** y
  **PDF** (botones visibles solo para administradores).
- **Roles y trabajo en equipo**: administrador y operador por invernadero, unión
  mediante código de invitación; cada rol ve solo sus acciones.
- **PWA instalable**: con actualizador de versión, iconos y service worker para
  uso sin conexión.
- **Simulador de sensores**: publica lecturas al endpoint de ingesta para
  probar todo el flujo sin hardware real.

## 🛠️ Tecnologías utilizadas

- **Frontend**: [React 19](https://react.dev/) +
  [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/),
  [Tailwind CSS v4](https://tailwindcss.com/),
  [React Router v7](https://reactrouter.com/), [Recharts](https://recharts.org/),
  [Lucide](https://lucide.dev/)
- **Datos y auth**: [Firebase](https://firebase.google.com/) (Authentication +
  Firestore), `firebase-admin` en los scripts de backend
- **PWA**: [vite-plugin-pwa](https://vite-pwa.org/)
- **Automatización**: GitHub Actions (CI en cada PR, motor de alertas cada
  5 minutos, deploy a GitHub Pages)

## 🚀 Cómo empezar (desarrollo local)

### Requisitos previos

- **Node.js 24** (la versión que usa CI; ≥ 22.18 también funciona)
- `pnpm` (gestor de paquetes del proyecto)

### Instalación

1. Clona el repositorio:
   ```bash
   git clone https://github.com/dev-brian/green-tech.git
   cd green-tech
   ```

2. Instala las dependencias:
   ```bash
   pnpm install
   ```

3. Configura tus variables de entorno:
   ```bash
   cp .env.local.example .env.local
   ```
   El `.env.local` tiene tres bloques: las llaves del cliente Firebase
   (`VITE_FIREBASE_*`, incluida la VAPID para push, las que usa la PWA), las del
   backend/simulador (`FIREBASE_SERVICE_ACCOUNT`, `GREENHOUSE_ID`,
   `DEVICE_INGEST_KEY`) y las opcionales del simulador interactivo
   (`INGEST_URL`, `SIM_PORT`, `SIM_PUBLISH_INTERVAL`).
   **Estas llaves NO están en el repositorio** (por seguridad) — pídeselas a un
   administrador del proyecto por un canal privado (WhatsApp, Slack, gestor de
   contraseñas, etc.), nunca las pegues en un commit ni en un chat público.

4. Inicia el servidor de desarrollo:
   ```bash
   pnpm run dev
   ```

5. Abre tu navegador y visita `http://localhost:5173`

*(Nota: si tienes problemas con los scripts de construcción de dependencias con pnpm v10+, ejecuta `pnpm approve-builds` antes de iniciar el proyecto).*

*(Nota: si cambias algo en `.env.local` mientras `pnpm dev` ya está corriendo, detenlo con Ctrl+C y vuelve a iniciarlo — Vite solo lee ese archivo al arrancar, no en caliente).*

### Pruebas y CI

```bash
pnpm lint         # ESLint
pnpm test         # unitarias: semáforo, ingesta/alertas, exportación CSV/PDF, zonas, push
pnpm test:rules   # reglas de Firestore (requiere Java + Firebase Emulator)
pnpm build        # type-check (tsc) + bundle de producción
```

GitHub Actions corre `lint`, `test`, `test:rules` y `build` en **cada PR** a
`main` o `develop`: si algo falla, el PR no debe fusionarse. El deploy a GitHub
Pages ocurre en cada push a `main`.

### Simulador (opcional)

Para probar el flujo completo sin hardware, configura las variables del bloque
"Backend" del `.env.local` y ejecuta:

```bash
pnpm sim:firestore   # publica lecturas en Firestore usando el contrato v0.2
```

También hay `pnpm seed:telemetry` para sembrar datos de ejemplo y
`pnpm simulator` para la CLI en modo memoria.

## 🧪 Simulador interactivo de invernadero

Para probar la PWA sin sensores hay un invernadero simulado con interfaz visual
y escenarios ("sube el pH", "falla una bomba", "corte de luz"). Publica por el
mismo endpoint que usarán los sensores reales.

```bash
pnpm sim:demo   # demo local, sin tocar Firestore: http://localhost:4100
```

Detalles y uso con Firestore en [`greenhouse-sim/README.md`](greenhouse-sim/README.md).

## 📁 Estructura del proyecto

```text
├── docs/
│   ├── contrato-datos.md     # Contrato de datos vigente (Firestore)
│   ├── push-fcm.md           # Notificaciones push
│   └── deuda-conocida.md     # Deuda técnica registrada
├── greenhouse-sim/           # Invernadero simulado con UI y escenarios
├── src/
│   ├── components/           # Navegación, alertas, exportación CSV/PDF, push, PWA
│   ├── context/              # Sesión, espacios de trabajo y roles
│   ├── hooks/                # useTelemetry, useAlerts, useThresholds, useHistory, PWA
│   ├── lib/                  # Firebase, servicios, umbrales, cropProfiles, csv/pdf
│   ├── pages/
│   │   ├── Landing.tsx              # Presentación pública
│   │   ├── auth/LoginPage.tsx       # Inicio de sesión
│   │   ├── OnboardingWizard.tsx     # Alta de invernadero
│   │   ├── Dashboard.tsx            # Estado actual, histórico y exportación
│   │   ├── ZonesPage.tsx            # Zonas del invernadero
│   │   ├── HistoryPage.tsx          # Histórico gráfico + exportación
│   │   ├── AlertsPage.tsx           # Alertas + umbrales (admin)
│   │   ├── ControlPanel.tsx         # Actuadores y configuración
│   │   └── PlantManagement.tsx      # Catálogo de cultivos (admin)
│   ├── App.tsx               # Rutas y protección por rol
│   └── index.css             # Tokens de diseño y estilos globales
├── simulator/                # Ingesta HTTP, motor de alertas y CLI
├── tests/                    # Pruebas unitarias y de reglas (emulador)
├── .github/workflows/        # CI, motor de alertas programado, deploy
├── firestore.rules           # Reglas de seguridad de Firestore
└── SPECS.md                  # Visión futura (no es la especificación vigente)
```

## 📚 Documentación

- [`docs/contrato-datos.md`](docs/contrato-datos.md) — **especificación vigente**
  de datos: colecciones, campos, unidades, endpoints de ingesta y reglas.
- [`docs/deuda-conocida.md`](docs/deuda-conocida.md) — deuda técnica conocida.
- [`SPECS.md`](SPECS.md) — **visión futura** de la plataforma completa
  (reportes firmados, analítica predictiva, API REST); no describe lo que hoy
  está implementado.
- Las [Issues](https://github.com/dev-brian/green-tech/issues) del repositorio —
  historias de usuario y tareas por sprint.
