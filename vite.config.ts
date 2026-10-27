/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base relative : l'app fonctionne aussi bien à la racine d'un domaine que dans un
// sous-dossier (GitHub Pages). Le routage par hash évite toute config serveur.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // ARTIFACT=1 : build d'aperçu sans service worker (hébergement sandboxé)
    !process.env.ARTIFACT && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FITTRACK 88',
        short_name: 'FITTRACK 88',
        description: 'Suivi personnel du poids, de la nutrition et de la course à pied.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0b0c0e',
        theme_color: '#0b0c0e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: { output: { manualChunks: { charts: ['recharts'], vendor: ['react', 'react-dom', 'react-router-dom', 'idb'] } } },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
