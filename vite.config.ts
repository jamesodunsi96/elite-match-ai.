
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            registerType: 'autoUpdate',
      manifest: {
        name: 'Elite Match AI',
        short_name: 'Elite AI',
        description: 'Football intelligence and match analysis',
        theme_color: '#07110e',
        background_color: '#07110e',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
