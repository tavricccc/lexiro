import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const appVersion = Date.now().toString()
const basePath = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base: basePath,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  plugins: [
    vue(),
    tailwindcss(),
    {
      name: 'generate-version',
      closeBundle() {
        const distDir = resolve(import.meta.dirname, 'dist')
        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true })
        }
        writeFileSync(resolve(distDir, 'version.json'), JSON.stringify({ version: appVersion }))
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/lexiro.svg'],
      manifest: {
        name: 'lexiro',
        short_name: 'lexiro',
        description: 'lexiro vocabulary practice and backup app.',
        start_url: basePath,
        scope: basePath,
        display: 'standalone',
        background_color: '#fafafa',
        theme_color: '#111111',

        orientation: 'portrait-primary',
        icons: [
          {
            src: `${basePath}icons/lexiro.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: `${basePath}index.html`,
        navigateFallbackAllowlist: [/./],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin }) => (
              sameOrigin && ['script', 'style'].includes(request.destination)
            ),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'lexiro-scripts',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ request, sameOrigin }) => (
              sameOrigin && ['image', 'font'].includes(request.destination)
            ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'lexiro-assets',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
