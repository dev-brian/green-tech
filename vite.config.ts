import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Ruta del proyecto en GitHub Pages
const PAGES_BASE = '/green-tech/'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // El usuario decide cuándo actualizar (ver PwaUpdatePrompt)
      registerType: 'prompt',
      injectRegister: false,
      // Los iconos ya entran al precache por globPatterns
      includeManifestIcons: false,
      manifest: {
        id: PAGES_BASE,
        name: 'GreenTech',
        short_name: 'GreenTech',
        description: 'Monitoreo en tiempo real de invernaderos hidropónicos.',
        lang: 'es',
        start_url: PAGES_BASE,
        scope: PAGES_BASE,
        display: 'standalone',
        background_color: '#1e222b',
        theme_color: '#1e222b',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Workbox omite sin error los archivos de más de 2 MiB, lo que dejaría la app incompleta
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  base: mode === 'production' ? PAGES_BASE : '/',
}))
