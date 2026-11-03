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
        // El registro lo hace src/components/UpdatePrompt.tsx con useRegisterSW.
        injectRegister: false,
        // La versión nueva espera a que el usuario la acepte desde el aviso.
        registerType: 'prompt',
        workbox: {
          // Precarga todo lo que la app necesita para abrir sin internet.
          globPatterns: ['**/*.{js,css,html,svg,png}'],
          // El bundle principal ya pesa ~1.3 MB; el límite por defecto (2 MB) quedaría justo.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          // Firebase y otras APIs no se interceptan: solo se precargan archivos propios.
        },
        // globPatterns ya incluye los iconos y el plugin agrega el manifest; así no se repiten.
        includeManifestIcons: false,
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
