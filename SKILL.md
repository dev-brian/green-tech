---
name: dark-neumorphism-iot-ui
description: >
  Reglas estrictas de diseño Neumórfico Oscuro (Soft UI) para dashboards IoT agrícolas.
  Enfocado en accesibilidad para productores con brecha digital, estados de sensores tipo LED,
  espaciado matemático con sistema de 8 puntos, Mobile-First y cumplimiento WCAG AA.
  Activa este skill cuando trabajes en cualquier componente de UI del proyecto GREEN TECH.
---

# Reglas de Diseño: Neumorfismo Oscuro IoT — GREEN TECH

> **REGLA DE ORO:** Antes de escribir cualquier CSS o JSX, verifica que el componente:
> 1. Sea usable con guantes (táctiles ≥ 48px).
> 2. Comunique su estado sin depender solo del color.
> 3. Funcione en 375px de ancho (iPhone SE) sin scroll horizontal.

---

## 1. Filosofía Central (Leer antes de codificar)

El Neumorfismo Oscuro IoT no es decoración — es un sistema de comunicación industrial. Cada decisión de sombra, color y espaciado tiene un propósito funcional:

- **Extruido (`.nm-flat`)** = Elemento que el usuario PUEDE PRESIONAR (botones, tarjetas interactivas).
- **Hundido (`.nm-concave`)** = Contenedor que RECIBE información (gráficas, inputs, paneles de datos).
- **LED de Semáforo** = Estado crítico del sensor. NUNCA pintar toda la tarjeta de rojo/verde — solo el indicador LED.
- **Sin modo claro.** Esta interfaz es 100% dark. El modo claro fue descartado.

---

## 2. Arquitectura de Color y Sombras (Variables CSS)

Estas son las únicas variables de color permitidas. No crear variables ad-hoc inline.

```css
:root {
  /* ─── Fondo Base ─────────────────────────────────── */
  --bg:             #1e222b;   /* Superficie principal de TODOS los componentes */
  --bg-sunken:      #1b1f27;   /* Para inputs y graficas hundidas (ligeramente mas oscuro) */

  /* ─── Texto ──────────────────────────────────────── */
  --text-primary:   #f1f5f9;   /* Ratio WCAG AA >= 4.5:1 sobre --bg */
  --text-secondary: #94a3b8;   /* Para etiquetas, unidades, timestamps */
  --text-disabled:  #4a5568;   /* Placeholder y estados deshabilitados */

  /* ─── Sombras Neumorficas ────────────────────────── */
  --shadow-light:   #272d3a;   /* Luz superior-izquierda */
  --shadow-dark:    #15181f;   /* Sombra inferior-derecha */

  /* ─── Acento Marca (Verde) ───────────────────────── */
  --accent:         #10b981;
  --accent-glow:    rgba(16, 185, 129, 0.20);

  /* ─── Semaforo IoT (Estados de Sensores) ─────────── */
  --status-green:        #10b981;
  --status-yellow:       #f59e0b;
  --status-red:          #ef4444;
  --status-green-glow:   rgba(16,  185, 129, 0.35);
  --status-yellow-glow:  rgba(245, 158,  11, 0.35);
  --status-red-glow:     rgba(239,  68,  68, 0.35);
  --status-offline:      #4a5568;

  /* ─── Sistema de Espaciado (8-Point Grid) ────────── */
  --space-xs:   8px;
  --space-sm:  16px;
  --space-md:  24px;
  --space-lg:  32px;
  --space-xl:  48px;
  --space-2xl: 64px;

  /* ─── Bordes ─────────────────────────────────────── */
  --radius-sm:   6px;
  --radius-md:   8px;
  --radius-lg:  12px;
  --radius-full: 9999px;
}
```

---

## 3. Clases de Componentes Neumorficos

### 3.1 Extruido — `.nm-flat` (Botones, Tarjetas Interactivas)

```css
.nm-flat {
  background:    var(--bg);
  border-radius: var(--radius-md);
  border:        1px solid rgba(255, 255, 255, 0.03);
  box-shadow:
     5px  5px 10px var(--shadow-dark),
    -5px -5px 10px var(--shadow-light);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

@media (hover: hover) and (pointer: fine) {
  .nm-flat:hover {
    box-shadow:
       7px  7px 14px var(--shadow-dark),
      -7px -7px 14px var(--shadow-light);
  }
}

.nm-flat:active {
  transform: translateY(1px);
  box-shadow:
    inset  4px  4px  8px var(--shadow-dark),
    inset -4px -4px  8px var(--shadow-light);
}

.nm-flat:disabled,
.nm-flat[aria-disabled="true"] {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}
```

### 3.2 Hundido — `.nm-concave` (Graficas, Inputs, Paneles de Datos)

```css
.nm-concave {
  background:    var(--bg-sunken);
  border-radius: var(--radius-md);
  border:        1px solid rgba(0, 0, 0, 0.25);
  box-shadow:
    inset  4px  4px  8px var(--shadow-dark),
    inset -4px -4px  8px var(--shadow-light);
}

.nm-concave:focus,
.nm-concave:focus-within {
  outline: none;
  border-color: var(--accent);
  box-shadow:
    inset  4px  4px  8px var(--shadow-dark),
    inset -4px -4px  8px var(--shadow-light),
    0 0 0 2px var(--accent-glow);
}
```

---

## 4. Sistema de Semaforo IoT (Indicadores LED)

**Regla critica:** El estado de un sensor se comunica UNICAMENTE a traves del indicador LED, no del color de fondo de la tarjeta.

```css
.nm-led {
  width:  14px;
  height: 14px;
  border-radius: var(--radius-full);
  background:    var(--bg);
  flex-shrink: 0;
  box-shadow:
    inset  2px  2px 5px var(--shadow-dark),
    inset -2px -2px 5px var(--shadow-light);
  transition: box-shadow 0.3s ease;
}

.nm-led--green {
  border: 1px solid var(--status-green);
  box-shadow:
    inset  2px  2px 5px var(--shadow-dark),
    inset -2px -2px 5px var(--shadow-light),
    inset 0 0 12px var(--status-green-glow),
    0 0 6px var(--status-green-glow);
}

.nm-led--yellow {
  border: 1px solid var(--status-yellow);
  box-shadow:
    inset  2px  2px 5px var(--shadow-dark),
    inset -2px -2px 5px var(--shadow-light),
    inset 0 0 12px var(--status-yellow-glow),
    0 0 6px var(--status-yellow-glow);
}

.nm-led--red {
  border: 1px solid var(--status-red);
  box-shadow:
    inset  2px  2px 5px var(--shadow-dark),
    inset -2px -2px 5px var(--shadow-light),
    inset 0 0 12px var(--status-red-glow),
    0 0 6px var(--status-red-glow);
}

.nm-led--red-pulse {
  animation: led-pulse 1.5s ease-in-out infinite;
}

@keyframes led-pulse {
  0%, 100% {
    box-shadow:
      inset  2px  2px 5px var(--shadow-dark),
      inset -2px -2px 5px var(--shadow-light),
      inset 0 0 12px var(--status-red-glow),
      0 0  6px var(--status-red-glow);
  }
  50% {
    box-shadow:
      inset  2px  2px 5px var(--shadow-dark),
      inset -2px -2px 5px var(--shadow-light),
      inset 0 0 20px var(--status-red-glow),
      0 0 14px var(--status-red-glow);
  }
}

.nm-led--offline {
  border: 1px solid var(--status-offline);
}
```

**Uso en React:**
```tsx
type SensorStatus = 'green' | 'yellow' | 'red' | 'offline';

function SensorLED({ status, isCritical }: { status: SensorStatus; isCritical?: boolean }) {
  const ledClass = [
    'nm-led',
    `nm-led--${status}`,
    status === 'red' && isCritical ? 'nm-led--red-pulse' : '',
  ].filter(Boolean).join(' ');

  return (
    <span
      className={ledClass}
      role="status"
      aria-label={`Estado del sensor: ${status}`}
    />
  );
}
```

---

## 5. Botones de Accion (Minimo 48px de alto)

```css
.btn-nm-primary {
  display:         inline-flex;
  align-items:     center;
  justify-content: center;
  gap:             var(--space-xs);
  min-height:      48px;
  padding:         0 var(--space-md);
  color:           var(--accent);
  font-weight:     600;
  font-size:       0.9375rem;
  letter-spacing:  0.02em;
  border:          none;
  cursor:          pointer;
  width:           100%; /* Mobile-First: ancho completo */
}

@media (min-width: 640px) {
  .btn-nm-primary { width: auto; }
}

.btn-nm-secondary { color: var(--text-secondary); }
.btn-nm-secondary:hover { color: var(--text-primary); }
.btn-nm-danger { color: var(--status-red); }
```

---

## 6. Layout Mobile-First y Grid

```css
/* Dashboard principal */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap:     var(--space-md);
  padding: var(--space-sm);
}

@media (min-width: 640px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, 1fr);
    padding: var(--space-md);
  }
}

@media (min-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: repeat(3, 1fr);
    gap:     var(--space-lg);
    padding: var(--space-lg);
  }
}

/* Fila de metricas (4 indicadores) */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-sm);
}

@media (min-width: 640px) {
  .metrics-grid { grid-template-columns: repeat(4, 1fr); }
}
```

**Tabla de espaciado obligatoria:**

| Uso | Variable | Valor |
|-----|----------|-------|
| Entre tarjetas de sensores | `gap: var(--space-md)` | 24px |
| Padding interno de tarjeta (movil) | `var(--space-sm)` | 16px |
| Padding interno de tarjeta (desktop) | `var(--space-md)` | 24px |
| Margen del contenedor (movil) | `var(--space-sm)` | 16px |
| Margen del contenedor (desktop) | `var(--space-lg)` | 32px |
| Entre etiqueta y valor | `var(--space-xs)` | 8px |
| Entre secciones del dashboard | `var(--space-xl)` | 48px |

---

## 7. Tipografia

```css
.metric-value {
  font-size: clamp(2rem, 6vw, 3rem);
  font-weight: 700;
  line-height: 1;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums; /* Evita "saltos" al actualizar datos */
}

.metric-unit {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 400;
  align-self: flex-end;
  margin-bottom: 0.3em;
}

.metric-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.metric-timestamp {
  font-size: 0.75rem;
  color: var(--text-disabled);
}
```

---

## 8. Iconografia (Lucide React)

Siempre usar `strokeWidth={1.5}`. El trazo fino contrasta con la pesadez de las sombras.

```tsx
// CORRECTO
<Thermometer size={24} strokeWidth={1.5} color="var(--text-secondary)" />

// INCORRECTO — strokeWidth por defecto (2) es demasiado grueso
<Thermometer size={24} color="green" />
```

**Tamanos estandar:**
- `size={16}` — Badges o timestamps.
- `size={20}` — Navegacion y botones secundarios.
- `size={24}` — Tarjetas de sensores y botones primarios.
- `size={32}` — Iconos decorativos y estados vacios.

---

## 9. Patrones Prohibidos

| Prohibido | Alternativa |
|-----------|-------------|
| Pintar fondo de tarjeta con color de estado | Usar `.nm-led--red/yellow/green` |
| `border-radius: 16px` o `24px` | `var(--radius-md)` = 8px |
| Valores de margin/padding arbitrarios (ej. `13px`) | Variables `--space-*` del sistema |
| `transition: all 0.3s` | `transition: box-shadow 0.15s ease, transform 0.15s ease` |
| `color: white` o `color: #fff` hardcodeado | `color: var(--text-primary)` |
| `height: Npx` fijo en contenedores | Usar `min-height` |
| Modo claro / tema blanco | No existe. Interfaz 100% dark. |
| `!important` | Refactorizar especificidad CSS |

---

## 10. Checklist de QA antes de hacer commit

- [ ] El componente funciona en 375px sin scroll horizontal.
- [ ] Todos los botones de accion tienen `min-height: 48px`.
- [ ] El semaforo usa `.nm-led` y NO el color de fondo de la tarjeta.
- [ ] Los valores de gap y padding son multiplos de 8 (variables `--space-*`).
- [ ] Los textos de metricas tienen `font-variant-numeric: tabular-nums`.
- [ ] Los iconos de Lucide usan `strokeWidth={1.5}`.
- [ ] No hay colores hexadecimales hardcodeados en JSX o CSS.
- [ ] Los estados hover solo aplican en `@media (hover: hover) and (pointer: fine)`.
