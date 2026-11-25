# Prueba de modo avión en 3 dispositivos — HU-10 (T10.4)

> **Historia:** [HU-10 Funciona sin internet](https://github.com/dev-brian/green-tech/issues/58)
> **Tarea:** [#62 T10.4 Prueba en modo avión en 3 dispositivos, documentada](https://github.com/dev-brian/green-tech/issues/62)
> **Responsable:** Gael · **Estado:** 🟢 C1, C2 y C3 comprobados el 2026-11-24 en Android (emulado) y
> escritorio con la build de producción (§5 y §8). Falta la corrida en iPhone/Safari real (D2).

## 1. Objetivo

Comprobar que, con la PWA ya abierta antes y el dispositivo en **modo avión**, el operador
sigue viendo el último estado conocido, recibe el aviso de sin conexión, conserva las alertas
ya vistas y que los cambios hechos sin red quedan **pendientes de enviar** hasta recuperarla.

### Criterios de aceptación de la HU-10

| # | Criterio | Tarea que lo habilita | Estado |
| --- | --- | --- | --- |
| C1 | Dado que la PWA ya se abrió antes, cuando abro en modo avión, entonces veo el último estado y un aviso **"Sin conexión · datos de las HH:MM"**. | T10.2 (aviso + hora del dato) sobre T10.1 (caché) | ✅ 2026-11-24 |
| C2 | Dado que estoy sin red, cuando cambio un umbral o atiendo una alerta, entonces queda marcado como **pendiente** y se envía solo al volver la red. | T10.3 (marcar pendientes) | ✅ 2026-11-24 |
| C3 | Las alertas que ya había visto siguen **visibles sin red**. | T10.1 (`persistentLocalCache` de Firestore) | ✅ 2026-11-24 |

### Dependencias (al escribir el protocolo, 2026-11-15; ya están todas en `main`: #99, #132)

- **T10.1** caché persistente de Firestore → PR [#99](https://github.com/dev-brian/green-tech/pull/99) (Brian), abierto.
- **T10.2** aviso de conexión y hora del dato → Alexa, sin PR.
- **T10.3** cambios pendientes de enviar → Alexa, sin PR.
- Lo que **sí** ya está en `develop`: el SW con precache del shell (T9.1/T9.2) → la app *abre* sin red.

Mientras esas tareas no entren, los criterios C1–C3 se marcan ⏳ en la matriz (§5) y este
documento queda como **protocolo ejecutable**: solo hay que repetir los pasos y anotar resultados.

## 2. Dispositivos de prueba

| # | Dis rol | Navegador | Cómo se instala / abre | Modo avión |
| --- | --- | --- | --- | --- |
| D1 | **Android** (teléfono) | Chrome | PWA instalada desde el menú *"Instalar aplicación"* | Ajustes → Red e Internet → Modo avión, o panel rápido |
| D2 | **iPhone** | Safari | *"Compartir → Añadir a pantalla de inicio"* | Centro de control → icono de avión |
| D3 | **Escritorio** | Chrome o Edge | Instalada desde el candado de la barra de direcciones (o pestaña normal) | Windows: Modo avión en Configuración → Red; macOS: menú WiFi |

> En los tres casos la app debe haberse **abierto al menos una vez con red** antes de la prueba
> (es el supuesto del criterio C1).

## 3. Preparación común

1. **Versión a probar:** la publicada en
   `https://dev-brian.github.io/green-tech/` (despliegue automático desde `main`), o en local
   con `pnpm build && pnpm preview` → `http://localhost:4173/green-tech/`.
2. **Datos recientes:** tener corriendo el simulador para que el estado no esté viejo
   (`pnpm sim:firestore` o el backend de GitHub Actions) y verificar que el Dashboard muestra
   valores con hora reciente.
3. **Cuenta con permisos:** iniciar sesión como **admin** de un invernadero (C2 requiere poder
   editar umbrales y atender alertas).
4. **Actualizar primero:** con red, aceptar el aviso de actualización de la PWA para que la
   versión probada sea la última.
5. **Capturas:** guardar las evidencias en `docs/evidencias/modo-avion/` con el nombre
   `<dispositivo>-<paso>-<criterio>.png` (p. ej. `android-p3-c1.png`).

## 4. Procedimiento (repetir por cada dispositivo)

| Paso | Acción | Esperado |
| --- | --- | --- |
| **P1** | Con red, abrir la PWA y cargar el Dashboard. Anotar la **hora del último dato**. | Semáforo y valores con hora reciente. |
| **P2** | Abrir **Alertas**, revisar la lista y anotar cuáles están *sin atender*. | Alertas visibles con hora. |
| **P3** | Activar **modo avión**. **Recargar** la app (o cerrarla y abrirla de nuevo). | La app **abre** (shell del SW) y muestra el último estado + aviso **"Sin conexión · datos de las HH:MM"** → **C1**. |
| **P4** | Navegar a **Alertas** sin red. | Las alertas vistas en P2 siguen **visibles** → **C3**. |
| **P5** | Sin red: cambiar un umbral (ej. pH máximo) **y** atender una alerta. | Quedan marcados como **pendientes**; no se pierden al recargar → **C2**. |
| **P6** | Desactivar el modo avión y dejar la app abierta ~1 min. | Los cambios pendientes se **envían solos**: el umbral aparece guardado y la alerta figura atendida en otro dispositivo → **C2**. |
| **P7** | Tomar las capturas de P3, P4 y P5 y anotar la matriz de la §5. | Evidencias en `docs/evidencias/modo-avion/`. |

**Fallo esperado (documentar, no es error):** si al recargar sin red Firestore no conserva la
última lectura, el estado aparecerá vacío → eso confirma que **C1/C3 requieren T10.1**; anotar
"pendiente de T10.1" en lugar de ❌.

## 5. Matriz de resultados

> Rellenar con ✅ / ❌ / ⏳ (pendiente de tarea) + fecha y captura.

| Dispositivo | Versión (commit / fecha) | C1: abre sin red + aviso | C3: alertas visibles | C2: cambios pendientes y autoenvío | Notas |
| --- | --- | --- | --- | --- | --- |
| D1 · Android / Chrome (Pixel 7 emulado en Chromium) | `develop` 31b1aa3 · 2026-11-24 | ✅ abre desde el SW con "Sin conexión · datos de las 20:16" ([captura](evidencias/modo-avion/android-p3-c1.png)) | ✅ las 6 alertas vistas en P2 siguen en la lista ([captura](evidencias/modo-avion/android-p4-c3.png)) | ✅ "2 cambios pendientes de enviar", alerta con "Pendiente de enviar" aun tras recargar sin red ([captura](evidencias/modo-avion/android-p5-c2.png)); al volver la red llegaron solos al servidor ([captura](evidencias/modo-avion/android-p6-c2.png)) | Automatizado, §8 |
| D2 · iPhone / Safari | — | ⏳ | ⏳ | ⏳ | Requiere un iPhone real: el contenedor de pruebas no tiene WebKit. |
| D3 · Escritorio / Chrome (1366×860) | `develop` 31b1aa3 · 2026-11-24 | ✅ ([captura](evidencias/modo-avion/escritorio-p3-c1.png)) | ✅ ([captura](evidencias/modo-avion/escritorio-p4-c3.png)) | ✅ ([captura](evidencias/modo-avion/escritorio-p5-c2.png), [al volver](evidencias/modo-avion/escritorio-p6-c2.png)) | Automatizado, §8 |

**Registro de la corrida**

| Fecha | Quién | Dispositivos | Resultado |
| --- | --- | --- | --- |
| 2026-11-15 | Gael | PC (escritorio, verificación local §6) | ✅ base técnica verificada · C1–C3 pendientes de T10.1–T10.3 |
| 2026-11-24 | Brian (con Claude Code) | D1 Android emulado, D3 escritorio | ✅ P1–P7 completos, C1–C3 cumplen (detalle en §8) |
| | | D2 iPhone / Safari real | pendiente |

## 6. Verificación local ya ejecutada (2026-11-15, rama del PR)

Comprueba la **base técnica** de C1 (que la app pueda abrir sin red) con la versión construida:

| Chequeo | Comando / evidencia | Resultado |
| --- | --- | --- |
| SW genera precache del shell | `pnpm build` → `dist/sw.js` | ✅ 13 entradas: `index.html`, bundle JS, CSS, iconos PWA, `manifest.webmanifest` |
| Tamaño permitido para precachear | `maximumFileSizeToCacheInBytes: 5 MiB` en `vite.config.ts` | ✅ nada queda fuera del precache |
| La app se sirve en la ruta de Pages | `pnpm preview` → `/green-tech/` | ✅ `200 text/html` |
| SW y manifest accesibles | `/green-tech/sw.js`, `/green-tech/manifest.webmanifest` | ✅ `200` (JS y `application/manifest+json`) |
| Deep-link SPA sin red parcial | `/green-tech/alertas` | ✅ `200` → `index.html` (`<title>GreenTech</title>`) |
| Registro del SW | `useRegisterSW` en `src/components/PwaUpdatePrompt.tsx` (registerType `prompt`) | ✅ el usuario acepta la actualización, no se auto-recarga |

**Lo que esta verificación NO cubre:** el comportamiento real del navegador con la red cortada
(y por tanto C1–C3 completos), que es exactamente lo que ejecutan los pasos P1–P7 en los
3 dispositivos cuando T10.1–T10.3 estén publicadas.

## 7. Criterios de HU-10 y checklist de cierre

- [x] Protocolo de prueba documentado para 3 dispositivos (Android, iPhone, escritorio).
- [x] Verificación local de la base técnica (precache del shell + servicio en la ruta de Pages).
- [x] C1 — último estado + aviso "Sin conexión · datos de las HH:MM" (Android y escritorio; iPhone pendiente).
- [x] C2 — cambios sin red marcados como pendientes y enviados al volver.
- [x] C3 — alertas ya vistas visibles sin red.
- [x] Matriz (§5) con capturas en `docs/evidencias/modo-avion/` (falta la fila D2 iPhone).



## 8. Corrida automatizada del 2026-11-24

Se ejecutaron P1–P7 tal cual con Playwright (Chromium) sobre la **build de producción**
(`pnpm build && pnpm preview`, ruta `/green-tech/`, service worker activo y controlando la página),
conectada a los emuladores de Firebase (Auth + Firestore, proyecto `demo-greentech`) con un
invernadero de prueba: 3 zonas, lecturas recientes, una zona en crítico y alertas sin atender.
El "modo avión" es `context.setOffline(true)`: corta **toda** la red de la página, incluido el
emulador, igual que el modo avión del teléfono.

| Paso | Android (Pixel 7) | Escritorio |
| --- | --- | --- |
| P1 Dashboard con red; SW controla la página | ✅ | ✅ |
| P2 Alertas sin atender | 6 | 5 |
| P3 Recarga sin red: abre, aviso y último estado | ✅ "Sin conexión · datos de las 20:16", Zona 2 Jitomate en crítico | ✅ igual |
| P4 Alertas visibles sin red | ✅ las 6 | ✅ las 5 |
| P5 Atender alerta + bajar un umbral sin red | ✅ "2 cambios pendientes de enviar"; la alerta dice "Pendiente de enviar" y sigue así tras recargar | ✅ igual |
| P6 Vuelve la red (15 s) | ✅ el servidor pasó de 6 a 7 alertas atendidas y guardó `thresholdsByCrop.jitomate` (12 → 11); el aviso de pendientes desaparece | ✅ 7 → 8; umbral 11 → 10 |

La comprobación de P6 se hizo leyendo Firestore con `firebase-admin` (el "otro dispositivo").
Lo único que no cubre es **Safari en iPhone (D2)**: hay que correr P1–P7 a mano en un iPhone
real y llenar su fila.
