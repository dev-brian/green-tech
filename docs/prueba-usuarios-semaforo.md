# Prueba con 3 usuarios del semáforo — HU-03 (T3.3)

> **Historia:** [HU-03 Dashboard semáforo](https://github.com/dev-brian/green-tech/issues/70)
> **Tarea:** [#73 T3.3 Prueba con 3 usuarios y ajustes](https://github.com/dev-brian/green-tech/issues/73)
> **Estado:** 🟡 Revisión previa y ajuste hechos (2026-11-24). Falta la sesión con 3 personas (§4).

## 1. Qué se comprueba

Criterio de la HU-03: **3 de 3 usuarios de prueba encuentran la zona en rojo en menos de 10 s**,
en un celular de 360 px.

Los otros criterios de la HU-03 ya están cubiertos:

| Criterio | Cómo se cumple | Evidencia |
| --- | --- | --- |
| La zona en peor estado aparece primero | T3.2 #72, PR #133 | En la revisión de §3 la Zona 2 (crítica) aparece antes que la 1 y la 3 |
| Más de 5 min sin lectura → gris "sin datos recientes" | T3.1 #71, PR #116 | `tests/zoneFreshness.test.ts` |
| Legible a 360 px, botones de al menos 48 px | T3.2 #72, PR #133 y PR #140 (sin scroll horizontal de 320 a 412 px) | §3 |

## 2. Preparación (5 min)

1. Abrir `https://dev-brian.github.io/green-tech/` en un celular Android, con la sesión de un
   invernadero de demo ya iniciada.
2. Correr el simulador con **una sola zona en crítico** (por ejemplo, el escenario de EC alta en la
   Zona 2) y comprobar que el inicio dice "Hay 1 cosa por revisar".
3. Dejar el celular en la pantalla de **Alertas**: la prueba empieza al tocar **Inicio**, para que
   el usuario no vea el tablero antes.
4. Cronómetro en otro teléfono.

**Usuarios:** 3 personas que **no** hayan usado la PWA (compañeros de otra carrera, familiares,
personal del invernadero). No se les explica la pantalla.

## 3. Revisión previa (2026-11-24, automatizada)

Build de producción a 360×740 px (Chromium móvil), con la Zona 2 Jitomate en crítico:

- La zona en rojo se nombra en el encabezado ("el agua lleva demasiados nutrientes en la Zona 2
  Jitomate DWC") y queda **visible sin hacer scroll** unos 0.35 s después de tocar Inicio (red
  local; con datos de internet tarda lo que tarde Firestore en responder).
- Es la primera zona en la lista de zonas.
- Ningún control visible mide menos de 44 px de alto.

Captura: [evidencias/semaforo/inicio-360.png](evidencias/semaforo/inicio-360.png)

**Ajuste hecho:** el aviso flotante decía "zona-2 — La conductividad…", con el id interno de la
zona. Ahora usa el nombre que le puso el admin ("Zona 2 Jitomate DWC — …"), el mismo del tablero
(`src/components/AlertSystem.tsx`). Si alguien buscaba "Zona 2 Jitomate" y el aviso decía "zona-2",
le costaba relacionarlos.

## 4. Guion de la sesión (por usuario, ~2 min)

Leer en voz alta, igual para los 3:

> "Esta app vigila un invernadero. Algo no está bien en una de sus zonas.
> Cuando toque la pantalla, dime **en qué zona está el problema**."

1. Tocar **Inicio** y arrancar el cronómetro.
2. Parar el cronómetro cuando el usuario **diga** la zona correcta (o la señale).
3. Si a los 30 s no la encuentra, parar y anotar "no la encontró".
4. Preguntar: *"¿Qué fue lo primero que viste?"* y *"¿Algo te confundió?"*. Anotar sus palabras.

## 5. Resultados

| # | Usuario (rol, sin nombre) | Celular | Tiempo | ¿Zona correcta? | Lo primero que vio / qué lo confundió |
| --- | --- | --- | --- | --- | --- |
| U1 | | | s | | |
| U2 | | | s | | |
| U3 | | | s | | |

**Cumple** si los 3 dicen la zona correcta en menos de 10 s.

## 6. Ajustes

| Fecha | Qué se observó | Cambio | PR |
| --- | --- | --- | --- |
| 2026-11-24 | El aviso flotante mostraba el id `zona-2` en lugar del nombre de la zona | Usa el nombre registrado | este PR |
| | | | |

Si alguno tarda 10 s o más, anotar aquí qué lo confundió y qué se cambió. Luego repetir la
prueba con una persona nueva.
