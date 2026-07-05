import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' invece di 'autoUpdate': su un tablet in servizio un reload
      // automatico interromperebbe l'inserimento di una comanda. L'aggiornamento
      // viene proposto e applicato solo quando l'operatore conferma
      // (vedi components/PwaUpdatePrompt.jsx).
      registerType: 'prompt',
      manifest: {
        name: 'Gestione Comande',
        short_name: 'Comande',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#ffffff',
        theme_color: '#1a56a0',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 5 }
          }
        ]
      }
    })
  ],
  server: {
    proxy: { '/api': 'http://localhost:8000' }
  }
})
