import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'SMA ERP v2',
        short_name: 'SMA ERP',
        description: 'Advanced Secure Enterprise System',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        icons: [
          {
            src: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/hexagon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/hexagon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
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
