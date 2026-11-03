import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? '/green-tech/' : '/'

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Registra el service worker con un script que el plugin agrega a index.html.
        injectRegister: 'auto',
        // La versión nueva espera a que el usuario la acepte (el aviso llega en T9.2).
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'apple-touch-icon-180.png'],
        manifest: {
          id: base,
          name: 'GreenTech — Invernadero hidropónico',
          short_name: 'GreenTech',
          description: 'Monitoreo del invernadero hidropónico: ambiente, solución nutritiva y alertas.',
          lang: 'es-MX',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          // Mismo color que --bg en src/index.css (neumorfismo oscuro).
          background_color: '#1e222b',
          theme_color: '#1e222b',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
  }
})
