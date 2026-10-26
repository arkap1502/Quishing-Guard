import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icons/icon-192.svg', 'icons/icon-512.svg'],
    manifest: {
      name: 'Quishing Guard',
      short_name: 'Quishing Guard',
      description: 'Check where a QR code leads before you trust it.',
      theme_color: '#f8faf7',
      background_color: '#f8faf7',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      icons: [
        { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
        { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
  })],
})
