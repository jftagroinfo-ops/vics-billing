// FIXED: File must be named vite.config.js (not vite_config.js)
// Vite automatically looks for this exact filename. Rename the project file accordingly.

import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'SMA ERP',
        short_name: 'SMA ERP',
        description: 'JFT Agro Overseas — Enterprise Resource Planning System',
        theme_color: '#0f172a',
        background_color: '#0d1117',
        display: 'standalone',
        icons: [
          {
            src: 'assets/icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'assets/icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        // Skip Firestore/Firebase from service worker cache
        navigateFallbackDenylist: [/^\/api/, /firebase/, /googleapis/]
      }
    })
  ],
  server: {
    proxy: {
      '/gemini-api': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gemini-api/, '')
      },
      '/openai-api': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openai-api/, '')
      }
    }
  }
});
