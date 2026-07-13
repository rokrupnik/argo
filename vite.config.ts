import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/argo/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Argo — Investicije',
        short_name: 'Argo',
        description: 'Sledenje investicijam za družino',
        lang: 'sl',
        start_url: '/argo/',
        scope: '/argo/',
        display: 'standalone',
        background_color: '#f4f6fb',
        theme_color: '#1c2a4a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // dnevne cene in seznam instrumentov — najprej mreža, ob offline pa cache
            urlPattern: /\/argo\/(prices\/.*\.json|instruments\.json)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'argo-prices',
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
