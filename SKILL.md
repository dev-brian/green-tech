---
name: greentech-invernadero-ui
description: >
  Sistema de diseño de GREEN TECH (PWA de invernadero hidropónico): fondo claro u oscuro, tarjetas de vidrio
  esmerilado, números grandes, verde hoja #729C51 y bermellón #EB5011 solo para lo crítico, ilustración
  del invernadero con sensores anclados, el semáforo de 7 variables por zona y un inicio "sencillo primero" (frase, qué hacer, medidores de rango). Incluye modo oscuro.
  Úsalo en cualquier trabajo de UI de la PWA (React + Tailwind 4) o de sus maquetas.
---

# Sistema de diseño GREEN TECH: invernadero claro

> **Regla de oro.** Antes de escribir CSS o JSX, comprueba que la pantalla:
> 1. Se pueda tocar con guantes: objetivos táctiles de 48 px o más.
> 2. Comunique cada estado con **color + ícono + palabra**, nunca solo con color.
> 3. Funcione en 360 px de ancho sin scroll horizontal.
> 4. Responda en 10 segundos a "¿qué zona está mal y qué variable?".
> 5. La entienda alguien que nunca ha revisado un invernadero hidropónico: primero la frase, después el número.
> 6. Se vea bien en modo claro y en modo oscuro.

---

## 1. Dirección visual

Tres ideas, tomadas de referencias concretas y no de la plantilla genérica de dashboard:

| Idea | De dónde viene | Cómo se aplica aquí |
| --- | --- | --- |
| **Luz de invernadero.** Fondo claro y cálido, tarjetas de vidrio esmerilado, un solo verde | AI Greenhouse (Imran Jakir) | Fondo `--bg`, tarjetas `.glass`, verde hoja como color de marca y de "todo bien" |
| **Instrumento, no galería.** Números enormes, etiquetas pequeñas, mucho aire | CoreDrill | Valor a 40–56 px, etiqueta de 13 px, unidad pegada al número en tamaño menor |
| **La pieza física al centro.** Una ilustración del equipo con datos anclados con líneas finas | CoreDrill | Invernadero isométrico con los 7 sensores señalados en la zona elegida |
| **Estructura operativa.** KPIs arriba, listas de dispositivos y alertas con acción | GoAgri | Franja de 4 KPIs, bandeja de alertas con **Atender**, lista de actuadores |

El tono: un invernadero bien llevado. **Calma cuando todo está bien, un solo grito cuando algo está mal.** El bermellón aparece solo donde hay algo crítico; si la pantalla no tiene nada crítico, no tiene naranja.

### Qué hace que se vea "hecho por IA" (y cómo evitarlo)

| Tropo genérico | En su lugar |
| --- | --- |
| Degradados morados o azul-violeta, fondos con "blobs" | Fondo plano `--bg`; la profundidad la dan el vidrio y la ilustración |
| Tarjetas todas iguales en una cuadrícula uniforme | Jerarquía: una tarjeta héroe grande, una columna de alertas, tarjetas chicas de apoyo |
| Franja de color en el borde izquierdo de cada tarjeta | Chip de estado + pozo de ícono teñido + punto en la ilustración |
| Emojis como íconos | Lucide con trazo 1.75 |
| Neumorfismo, sombras dobles, brillos neón | Una sombra suave (`--shadow-card`) y borde blanco de 1 px |
| Inter/Roboto a un solo peso, todo del mismo tamaño | Plus Jakarta Sans; contraste fuerte de tamaño entre valor y etiqueta |
| Textos de relleno ("Smart insights", "AI-powered") | Lenguaje de productor: "pH alto en Zona B", "Nivel del tanque bajo" |
| Animaciones de conteo, gráficas que "crecen" | El número cambia directo; solo se anima lo crítico |

### Sencillo primero (divulgación progresiva)

Son muchas variables, pero el usuario no tiene por qué verlas todas a la vez. Cada pantalla tiene tres capas y solo la primera es obligatoria:

1. **La frase.** "Hay 2 cosas por revisar" / "Todo en orden". Sin números.
2. **Qué hacer.** Una tarjeta por problema con: qué pasa en palabras simples, el número con su medidor de rango, **Qué significa**, **Qué está haciendo el sistema** y **Qué haces tú**, y un botón ("Ya lo revisé").
3. **El detalle.** Las 7 lecturas de una zona con medidores de rango; la tabla técnica de todas las zonas queda a un toque ("Ver tabla técnica"), nunca en el inicio.

Reglas de lenguaje:

| Técnico | En la UI (con el técnico entre paréntesis la primera vez) |
| --- | --- |
| pH 7.10 > máx | "El agua está demasiado alcalina" · Acidez (pH) |
| EC | Nutrientes (EC) · "cuánto alimento lleva el agua" |
| tankLevel | Agua en el tanque |
| waterTemp | Temperatura del agua |
| Actuadores | Equipos |
| Grupo Solución | Agua con nutrientes |

- Una zona sana no muestra números en el inicio: "Todo en orden" y 7 puntos verdes.
- Una zona con problema dice solo cuál: "Queda poca agua en el tanque. Lo demás, bien."
- No hay KPIs abstractos en el inicio (zonas en riesgo, actuadores encendidos); se resumen en chips bajo la frase ("1 crítica · 1 en atención · 19 de 21 lecturas bien").
- Los textos de "Qué significa" y "Qué haces tú" vienen de un catálogo por variable y dirección (alto/bajo) en el código, revisado por el equipo; la UI no los inventa.

---

## 2. Tokens

Son las únicas variables permitidas. No se escriben colores hexadecimales en JSX ni en CSS de componentes.

```css
:root {
  /* Superficies */
  --bg:             #EEF1EA;                  /* fondo de la app: blanco verdoso cálido */
  --glass:          rgba(255, 255, 255, 0.72);/* tarjetas (con backdrop-filter) */
  --glass-border:   rgba(255, 255, 255, 0.9);
  --surface:        #F7F8F4;                  /* tarjeta sin blur (fallback y modo ahorro) */
  --surface-strong: #FFFFFF;                  /* inputs, filas dentro de tarjetas */
  --ink-block:      #0A0909;                  /* botón primario, navegación activa */
  --track:          rgba(10, 9, 9, 0.07);     /* fondo de medidores y píldoras */
  --text-on-crit:   #FFFFFF;

  /* Texto (contraste medido sobre --surface) */
  --text-primary:   #0A0909;   /* 18.6:1 */
  --text-secondary: #5B6356;   /*  5.8:1  etiquetas, unidades, horas */
  --text-on-ink:    #FFFFFF;

  /* Marca */
  --leaf:           #729C51;   /* relleno: barras, puntos, ilustración. NUNCA texto (3.0:1) */
  --leaf-ink:       #456B2C;   /* texto verde: 5.8:1 */
  --leaf-soft:      rgba(114, 156, 81, 0.14);
  --mist:           #C7DEED;   /* agua y solución en ilustraciones y gráficas. Decorativo */

  /* Semáforo: relleno (puntos, barras, pines de la ilustración) */
  --status-ok:       var(--leaf);
  --status-warn:     #E3A21A;
  --status-crit:     #EB5011;
  --status-offline:  #9AA294;

  /* Semáforo: texto (todos 4.5:1 o más sobre --surface y blanco) */
  --status-ok-text:      var(--leaf-ink); /* 5.8:1 */
  --status-warn-text:    #7A5200;         /* 6.5:1 */
  --status-crit-text:    #A8380A;         /* 6.1:1 */
  --status-offline-text: #5E665A;         /* 5.6:1 */

  /* Semáforo: fondos de chip */
  --status-ok-soft:      var(--leaf-soft);
  --status-warn-soft:    rgba(227, 162, 26, 0.18);
  --status-crit-solid:   #C2410C;          /* chip sólido de Crítico, texto blanco 5.2:1 */
  --status-crit-soft:    rgba(235, 80, 17, 0.12);
  --status-offline-soft: rgba(154, 162, 148, 0.18);

  /* Sombra y vidrio */
  --shadow-card: 0 1px 2px rgba(10, 9, 9, 0.04), 0 8px 24px rgba(52, 70, 38, 0.08);
  --blur:        16px;

  /* Espaciado (cuadrícula de 4/8 px) */
  --space-2xs:  4px;
  --space-xs:   8px;
  --space-sm:  12px;
  --space-md:  16px;
  --space-lg:  24px;
  --space-xl:  32px;
  --space-2xl: 48px;

  /* Radios */
  --radius-sm:   10px;   /* inputs, filas internas */
  --radius-md:   16px;   /* botones, pozos de ícono */
  --radius-lg:   24px;   /* tarjetas */
  --radius-full: 9999px; /* chips, botones redondos, puntos */
}
```

### Modo oscuro

Mismos nombres de token, otros valores. Se activa con `prefers-color-scheme: dark` y el usuario puede forzarlo con un botón (sol/luna, 48 px, `aria-pressed`) que guarda la elección en `localStorage` y pone `data-theme="dark"` o `"light"` en `<html>`.

```css
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* mismos valores que abajo */ } }
:root[data-theme="dark"] {
  --bg:             #0F1310;                 /* negro verdoso, nunca negro puro */
  --glass:          rgba(26, 32, 27, 0.78);
  --glass-border:   rgba(255, 255, 255, 0.06);
  --surface:        #161B17;
  --surface-strong: #1F261F;
  --ink-block:      #EEF2EA;                 /* el botón primario se invierte: claro con texto oscuro */
  --text-on-ink:    #0F1310;
  --track:          rgba(255, 255, 255, 0.08);
  --text-on-crit:   #0F1310;
  --text-primary:   #EEF2EA;   /* 14.6:1 sobre --surface-strong */
  --text-secondary: #A3AD9C;   /*  6.3:1 */
  --leaf:           #8DB86A;
  --leaf-ink:       #A9CB8A;   /*  8.5:1 */
  --leaf-soft:      rgba(141, 184, 106, 0.16);
  --mist:           #2F4C5C;
  --status-warn:        #F2B84B;
  --status-crit:        #FF7A3D;
  --status-offline:     #6B7568;
  --status-warn-text:   #F5C46A;  /* 9.5:1 */
  --status-crit-text:   #FF8A57;  /* 6.6:1 */
  --status-offline-text:#9AA595;
  --status-warn-soft:   rgba(242, 184, 75, 0.16);
  --status-crit-solid:  #FF7A3D;  /* chip Crítico con texto #0F1310: 7.2:1 */
  --status-crit-soft:   rgba(255, 122, 61, 0.16);
  --status-offline-soft:rgba(154, 165, 149, 0.14);
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.3), 0 12px 32px rgba(0, 0, 0, 0.35);
}
```

- En oscuro el chip de Crítico lleva **texto oscuro** sobre bermellón claro (`--text-on-crit`); en claro, texto blanco sobre `#C2410C`. Usa un token `--text-on-crit` en vez de escribir `#fff`.
- La ilustración usa clases (`fill: var(--gh-floor)`, etc.), no colores fijos, para cambiar de tema sin otro SVG.
- No se baja la saturación del verde a gris: sigue siendo la señal de "en rango".

### En Tailwind 4

Declara los tokens en `src/index.css` con `@theme` para usarlos como clases (`bg-bg`, `text-leaf-ink`, `rounded-card`):

```css
@import "tailwindcss";
@theme {
  --color-bg: #EEF1EA;
  --color-surface: #F7F8F4;
  --color-ink: #0A0909;
  --color-ink-2: #5B6356;
  --color-leaf: #729C51;
  --color-leaf-ink: #456B2C;
  --color-mist: #C7DEED;
  --color-warn: #E3A21A;
  --color-warn-ink: #7A5200;
  --color-crit: #EB5011;
  --color-crit-ink: #A8380A;
  --color-crit-solid: #C2410C;
  --color-offline: #9AA294;
  --color-offline-ink: #5E665A;
  --radius-card: 24px;
  --font-sans: "Plus Jakarta Sans", system-ui, sans-serif;
}
```

---

## 3. Superficies

```css
.glass {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(var(--blur)) saturate(1.2);
}
/* Sin soporte de blur, o con ahorro de datos: tarjeta sólida */
@supports not (backdrop-filter: blur(1px)) { .glass { background: var(--surface); } }

.well {            /* contenedor interno: filas, gráficas, inputs */
  background: var(--surface-strong);
  border-radius: var(--radius-sm);
}
.icon-well {       /* pozo de ícono de 40 px teñido con el estado */
  display: grid; place-items: center;
  width: 40px; height: 40px; border-radius: var(--radius-md);
  background: var(--well-bg, var(--leaf-soft)); color: var(--well-fg, var(--leaf-ink));
}
```

- Una tarjeta es tocable si abre algo: `cursor: pointer`, al pasar el mouse sube 1 px y la sombra crece. Foco: `outline: 2px solid var(--ink-block); outline-offset: 3px`.
- El fondo de la tarjeta **nunca** cambia de color por estado. El estado vive en el chip, el pozo de ícono y el punto.
- El vidrio necesita algo detrás para verse. Sobre `--bg` liso se ve como blanco translúcido, y está bien. La foto del invernadero va solo en el encabezado héroe, con un velo blanco del 55 % encima para mantener el contraste.

---

## 4. Semáforo (estado de sensores)

Estados: `ok` (en rango), `warn` (cerca del límite), `crit` (fuera de rango), `offline` (sin lectura en más de 5 minutos). El estado lo calcula el backend; la UI solo lo pinta.

| Estado | Ícono Lucide | Palabra | Chip |
| --- | --- | --- | --- |
| ok | `CircleCheck` | Normal | texto `--status-ok-text`, fondo `--status-ok-soft` |
| warn | `TriangleAlert` | Atención | texto `--status-warn-text`, fondo `--status-warn-soft` |
| crit | `OctagonAlert` | Crítico | **sólido**: fondo `--status-crit-solid`, texto blanco |
| offline | `WifiOff` | Sin datos | texto `--status-offline-text`, fondo `--status-offline-soft` |

El chip de Crítico es sólido y los demás son suaves a propósito: así Crítico se distingue también por **claridad**, no solo por tono, y lo ve alguien con daltonismo.

```css
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 28px; padding: 0 12px; border-radius: var(--radius-full);
  font-size: 0.8125rem; font-weight: 600; white-space: nowrap;
}
.chip--ok      { color: var(--status-ok-text);      background: var(--status-ok-soft); }
.chip--warn    { color: var(--status-warn-text);    background: var(--status-warn-soft); }
.chip--crit    { color: #fff;                        background: var(--status-crit-solid); }
.chip--offline { color: var(--status-offline-text); background: var(--status-offline-soft); }
```

```tsx
import { CircleCheck, TriangleAlert, OctagonAlert, WifiOff } from 'lucide-react';

export type SensorStatus = 'ok' | 'warn' | 'crit' | 'offline';

const STATUS = {
  ok:      { Icon: CircleCheck,   label: 'Normal' },
  warn:    { Icon: TriangleAlert, label: 'Atención' },
  crit:    { Icon: OctagonAlert,  label: 'Crítico' },
  offline: { Icon: WifiOff,       label: 'Sin datos' },
} as const;

export function StatusChip({ status }: { status: SensorStatus }) {
  const { Icon, label } = STATUS[status];
  return (
    <span className={`chip chip--${status}`}>
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}
```

Si el backend usa `green | yellow | red | offline`, mapea en un solo lugar (`toStatus()`), no en cada componente.

---

## 5. Las 7 variables

Siempre en este orden y en estos dos grupos. La UI no inventa variables.

| Grupo | Variable | Clave | Ícono Lucide | Unidad | Formato |
| --- | --- | --- | --- | --- | --- |
| Ambiente | Temperatura del aire | `airTemp` | `Thermometer` | °C | 1 decimal: 24.5 |
| Ambiente | Humedad relativa | `humidity` | `Droplets` | % | entero: 68 |
| Ambiente | Luz | `light` | `Sun` | lux | entero con separador: 12,400 |
| Solución | pH | `ph` | `FlaskConical` | (sin unidad) | 2 decimales: 6.12 |
| Solución | Conductividad | `ec` | `Zap` | mS/cm | 2 decimales: 1.05 |
| Solución | Temp. de la solución | `waterTemp` | `Waves` | °C | 1 decimal: 21.3 |
| Solución | Nivel del tanque | `tankLevel` | `Gauge` | % | entero: 74 |

Las claves que manda son las de `docs/contrato-datos.md`. Formatea con `Intl.NumberFormat('es-MX', …)`.

---

## 6. Componentes

### 6.1 Encabezado de estado (lo primero que se lee)

Una línea grande que responde la pregunta de los 10 segundos antes que cualquier gráfica:

- Todo bien: **"Todo en rango"** + "3 zonas · última lectura hace 12 s".
- Algo mal: **"Zona B necesita atención"** + "pH 7.10, máximo 6.5 · hace 1 min" y botón **Ver zona**.

28–40 px, peso 700. Si hay varias zonas mal, nombra la peor y suma "y 1 zona más".

### 6.1b Medidor de rango (el componente más importante para novatos)

Una barra de 10 px con la **banda ideal** marcada en verde y un círculo de 20 px en la lectura actual, del color de su estado. Debajo, palabras en los extremos ("Muy ácida" / "Muy alcalina", "Vacío" / "Lleno"). Se entiende sin saber qué es el pH: el círculo está fuera de lo verde.

```css
.gauge { position: relative; height: 10px; border-radius: var(--radius-full); background: var(--track); }
.gauge .band { position: absolute; inset-block: 0; border-radius: inherit; background: var(--leaf-soft); box-shadow: inset 0 0 0 1.5px var(--leaf); }
.gauge .mark { position: absolute; top: 50%; width: 20px; height: 20px; border-radius: var(--radius-full); transform: translate(-50%, -50%); background: var(--status-ok); border: 3px solid var(--surface-strong); }
```

La escala de cada variable (mínimo y máximo de la barra) se define una vez por variable; la banda sale de los umbrales del cultivo que manda el backend.

### 6.1c Tarjeta "Qué hacer"

Pozo de ícono, título en lenguaje simple ("Queda poca agua en el tanque"), zona · cultivo · desde qué hora, chip, número grande + medidor, un bloque `.well` con **Qué significa / Qué está haciendo el sistema / Qué haces tú**, y botón primario "Ya lo revisé" + secundario "Ver la zona". Crítico primero, luego Atención. En móvil, una tarjeta debajo de otra.

### 6.2 Franja de KPIs (estilo GoAgri, solo vista técnica)

Cuatro tarjetas chicas: **Zonas en riesgo**, **Alertas sin atender**, **Actuadores encendidos**, **Última lectura**. Número de 32–40 px, etiqueta de 13 px. Solo la tarjeta que tiene un problema lleva color (pozo de ícono en bermellón); las demás quedan neutras. En móvil: 2 × 2.

### 6.3 Semáforo por zona

En el **inicio** cada zona es una tarjeta con nombre, cultivo, chip, una frase y 7 puntos de estado ("6 de 7 bien"). La **tabla técnica** (abajo) vive en su propia vista para quien ya conoce las variables.

Matriz de zonas × 7 variables:

```
                Aire   Hum.   Luz     pH     EC     T.sol  Tanque
Zona B·Jitomate 25.1   71     14,200  [7.10] 2.80   21.0   68      ← fila de la peor zona primero
Zona A·Lechuga  23.4   66     12,400  6.05   1.05   20.8   [31]
Zona C·Lechuga  22.9   69     11,900  5.98   1.10   20.5   74
```

- Cada celda: punto de estado de 8 px + valor con `tabular-nums`. En `warn` y `crit` la celda lleva además el ícono del estado y fondo suave; en `ok` queda limpia. Así los problemas resaltan y lo normal no hace ruido.
- Filas ordenadas de peor a mejor (crit, warn, offline, ok). Cada fila es un botón que abre el detalle de la zona.
- Columnas agrupadas bajo **Ambiente** y **Solución**.
- **Móvil (< 640 px):** la matriz se vuelve una tarjeta por zona con las 7 variables en una cuadrícula de 4 + 3 mini celdas (ícono, valor, punto). Nunca scroll horizontal.

### 6.4 Ilustración del invernadero (estilo CoreDrill)

Una ilustración isométrica del invernadero (canales NFT y tanque de solución) con los sensores de la zona elegida anclados por líneas finas de 1 px a etiquetas flotantes: etiqueta de 12 px y valor de 20 px. El pin del sensor en problema es bermellón y lleva un anillo; los demás son verde hoja.

- SVG en línea, colores solo con los tokens (`--leaf`, `--mist`, neutros del fondo). Sin sombras realistas ni 3D fotográfico: tiene que pesar poco para la PWA.
- Las etiquetas son HTML encima del SVG (accesibles y traducibles), no texto dentro del SVG.
- En móvil la ilustración se reduce a una franja de 160 px con solo el pin crítico etiquetado, o se oculta si no hay nada crítico.

### 6.5 Tarjeta de métrica (detalle de zona)

```
┌───────────────────────────────┐
│ [🧪]  pH             [Crítico] │  ← pozo de ícono, etiqueta, chip
│                               │
│ 7.10                          │  ← valor 48 px
│ Rango 5.5 – 6.5 · hace 1 min  │
│ ▁▂▂▃▅▆█  ← barras de la última hora; la que sale de rango en bermellón
└───────────────────────────────┘
```

- Las barras siguen la idea de CoreDrill: todas en `--surface-strong` con borde superior neutro, y solo la hora que salió de rango (o la máxima) resaltada con su color y su valor encima.
- En `offline`: valor en `--status-offline-text`, chip "Sin datos" y "Última lectura 14:32". Nunca se muestra un valor viejo como si fuera actual.

### 6.6 Alerta en la bandeja

Fila `.well` con: pozo de ícono del estado, "pH alto · Zona B", "7.10 (máx. 6.5) · 14:32" y botón **Atender** (48 px, contorno oscuro). Las atendidas bajan, sin color, con "Atendida por Alexa · 14:35".

### 6.7 Actuador virtual

Fila con ícono, nombre, "Automático · desde 14:30" y un estado con texto ("Encendida" / "Apagada"), no solo un interruptor. Encendido = punto verde hoja; el ícono gira despacio solo con `prefers-reduced-motion: no-preference`.

| Actuador | Ícono Lucide |
| --- | --- |
| Bomba de recirculación | `RefreshCw` |
| Dosificadora de pH | `FlaskConical` |
| Dosificadora de nutrientes | `Beaker` |
| Ventilación | `Fan` |

### 6.8 Conexión (HU-10)

Chip en el encabezado: "En línea · hace 12 s" (punto verde) o "Sin conexión · datos de las 14:32" (`WifiOff`, chip offline). Lo editado sin red lleva el chip "Pendiente" (`CloudOff`, estilo warn) hasta que el servidor confirme.

### 6.9 Botones

| Tipo | Estilo |
| --- | --- |
| Primario | fondo `--ink-block`, texto blanco, `--radius-full`, alto 48 px |
| Secundario | fondo `--surface-strong`, borde 1 px `rgba(10,9,9,.12)`, texto `--text-primary` |
| Ícono | círculo de 48 px, fondo `--surface-strong`, `aria-label` obligatorio |

El verde no es color de botón: el verde significa "en rango". Un botón verde confunde.

---

## 7. Gráficas (Recharts)

- Fondo `.well`, sin bordes de gráfica; cuadrícula horizontal en `rgba(10,9,9,.06)`; ejes en `--text-secondary` a 12 px.
- Rango seguro del cultivo: banda `ReferenceArea` con `--leaf-soft`; límites con `ReferenceLine strokeDasharray="4 4"`.
- Línea de la variable en `--text-primary` a 2 px; los puntos fuera de rango en `--status-crit`.
- Una variable por gráfica. En el histórico, pequeños múltiplos: una gráfica por variable.
- Tooltip `.glass` con valor, unidad y hora. Números con `tabular-nums`.

---

## 8. Layout

- **Móvil (< 640 px):** una columna, margen de 16 px. Orden: encabezado de estado, KPIs 2 × 2, tarjetas de zona (peor primero), alertas. Navegación inferior fija de 4 destinos (Inicio, Alertas, Histórico, Más), cada uno de 48 px o más con ícono y texto; insignia de alertas sin atender sobre Alertas.
- **Tableta (≥ 640 px):** KPIs en 4 columnas; zonas en 2 columnas.
- **Escritorio (≥ 1024 px):** navegación en píldora en el encabezado (Inicio, Alertas, Histórico, Equipos) junto al botón de tema; contenido de máximo 1200 px, centrado. Orden del inicio:
  1. héroe: la frase + chips de resumen, con la ilustración del invernadero (zonas pintadas por estado y solo el pin crítico etiquetado);
  2. **Qué hacer ahora**: tarjetas de problema, dos por fila;
  3. **Tus zonas**: tarjetas de zona, tres por fila;
  4. **Lecturas de la zona elegida** (medidores de rango, agrupados en Aire y Agua con nutrientes) + **Equipos**.
- La tabla técnica, los KPIs y las gráficas por hora van en las vistas de Zona e Histórico, no en el inicio.

---

## 9. Tipografía

**Plus Jakarta Sans** (Google Fonts, pesos 400, 500, 600, 700). Es la alternativa libre más cercana a Gilroy, la de la referencia; si el equipo tiene licencia de Gilroy, se cambia solo `--font-sans`.

```css
.display      { font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
.value-xl     { font-size: clamp(2.5rem, 6vw, 3.5rem); font-weight: 600; letter-spacing: -0.03em; line-height: 1; font-variant-numeric: tabular-nums; }
.value-lg     { font-size: 2rem; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.value-unit   { font-size: 0.45em; font-weight: 500; color: var(--text-secondary); margin-left: 2px; } /* "24.5 °C" con la unidad chica */
.card-title   { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.01em; }
.label        { font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary); }
.body         { font-size: 1rem; line-height: 1.5; }
```

- Mínimo 13 px en etiquetas y 16 px en texto de lectura.
- Nada en mayúsculas sostenidas salvo siglas (pH, EC).
- Español de México y lenguaje de productor: "Nivel del tanque bajo", no "tankLevel < min". Horas relativas ("hace 2 min") hasta 1 hora; después, hora exacta ("14:32").

---

## 10. Íconos

Lucide React. `strokeWidth={1.75}` en tarjetas y navegación, `2` en chips. 16 px en chips, 20 px en botones y navegación, 24 px en pozos de ícono. Decorativos con `aria-hidden="true"`; botones de solo ícono con `aria-label`.

---

## 11. Movimiento

- 150–250 ms, `ease-out`. Nunca `transition: all`.
- Lo único que se anima de forma continua es el anillo del pin crítico en la ilustración y el giro de un actuador encendido, ambos dentro de `@media (prefers-reduced-motion: no-preference)`.
- Los valores cambian directo, sin animación de conteo.

---

## 12. Patrones prohibidos

| Prohibido | En su lugar |
| --- | --- |
| Fondo de tarjeta pintado con el color del estado | Chip, pozo de ícono y punto |
| Estado solo con color | Color + ícono + palabra |
| `--leaf` o `--status-crit` como color de texto | Sus variantes `*-ink` / `*-text` |
| Botones verdes | Primario negro, secundario blanco |
| Bermellón en algo que no sea crítico (decoración, marca) | Verde hoja o neutros |
| Degradados de fondo, blobs, neón, neumorfismo | Fondo plano y vidrio |
| Franja de color en el borde izquierdo | Chip + pozo de ícono |
| Colores hex en JSX o CSS de componentes | Tokens del punto 2 |
| Valor viejo mostrado como actual | Estado `offline` con la hora de la última lectura |
| Varias variables con escalas distintas en una gráfica | Una gráfica por variable |
| Variables fuera de las 7 | Solo las del punto 5 |

---

## 13. Checklist antes del PR

- [ ] Funciona en 360 px sin scroll horizontal y en 1024 px con el riel lateral.
- [ ] Todos los objetivos táctiles miden 48 px o más.
- [ ] Cada estado se ve con color + ícono + palabra; Crítico usa chip sólido.
- [ ] El encabezado de estado nombra la peor zona y la variable.
- [ ] Texto informativo con contraste de 4.5:1 o más (solo tokens `*-ink`, `*-text` y `--text-*`).
- [ ] El estado `offline` se ve y muestra la hora de la última lectura.
- [ ] Solo las 7 variables, con su ícono, unidad y formato del punto 5; valores con `tabular-nums`.
- [ ] Sin bermellón si no hay nada crítico en pantalla.
- [ ] El inicio se entiende sin conocer las variables: frase, tarjetas "Qué hacer" y medidores; la tabla técnica está a un toque.
- [ ] Revisado en modo claro y en modo oscuro (contraste incluido).
- [ ] Animaciones dentro de `prefers-reduced-motion: no-preference`.
- [ ] Sin colores hex en componentes, sin `transition: all`, sin `!important`.
