# Green Tech - Sistema Inteligente de Cultivo

Green Tech es una aplicación web moderna diseñada para monitorear, controlar y optimizar el entorno de invernaderos y cultivos en tiempo real utilizando tecnología de vanguardia y precisión inteligente.

## 🌟 Características Principales

- **Monitoreo 24/7**: Sensores de alta precisión que vigilan constantemente la temperatura, humedad y el pH del agua.
- **Riego Automatizado**: Control automático de bombas de agua basado en las necesidades reales y actuales de cada planta.
- **Alertas al Instante**: Sistema de notificaciones en tiempo real que alerta si algún parámetro sale del rango óptimo establecido.
- **Gestión de Plantas**: Administración y seguimiento individual del estado de las plantas.
- **Panel de Control Integral**: Un *dashboard* completo con gráficos interactivos y controles manuales/automáticos.

## 🛠️ Tecnologías Utilizadas

Este proyecto está construido con herramientas modernas para asegurar el mejor rendimiento y experiencia de desarrollo:

- **Frontend Core**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Enrutamiento**: [React Router v7](https://reactrouter.com/)
- **Gráficos**: [Recharts](https://recharts.org/)
- **Iconos**: [Lucide React](https://lucide.dev/)

## 🚀 Cómo empezar (Desarrollo Local)

### Requisitos Previos
- Node.js (v18 o superior recomendado)
- `pnpm` (Gestor de paquetes recomendado para este proyecto)

### Instalación

1. Clona el repositorio:
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd green-tech
   ```

2. Instala las dependencias:
   ```bash
   pnpm install
   ```

3. Configura tus variables de entorno (llaves de Firebase y OpenWeatherMap):
   ```bash
   cp .env.local.example .env.local
   ```
   Abre el `.env.local` recién creado y reemplaza cada valor vacío con la llave real.
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

## 📁 Estructura del Proyecto

```text
src/
├── assets/          # Recursos estáticos (imágenes, fuentes, etc.)
├── components/      # Componentes reutilizables (Navegación, Sistema de Alertas, etc.)
├── pages/           # Vistas principales de la aplicación
│   ├── Landing.tsx          # Página de inicio / Presentación
│   ├── Dashboard.tsx        # Panel principal de monitoreo y gráficos
│   ├── ControlPanel.tsx     # Controles manuales del sistema
│   └── PlantManagement.tsx  # Gestión del inventario de plantas
├── App.tsx          # Componente raíz y configuración de rutas
├── index.css        # Estilos globales y configuración de Tailwind
└── main.tsx         # Punto de entrada de la aplicación React
```
