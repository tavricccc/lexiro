import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const appVersion = Date.now().toString()
const basePath = process.env.VITE_BASE_PATH || '/'
const kib = 1024
const bundleBudgets = { entry: 230 * kib, css: 100 * kib, async: 350 * kib, firebase: 750 * kib, precache: 3 * 1024 * kib }

function assertBundleBudget(fileName: string, bytes: number, budget: number) {
  if (bytes > budget)
    throw new Error(`Bundle budget exceeded: ${fileName} is ${bytes} bytes (budget ${budget})`)
}

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
  build: {
    chunkSizeWarningLimit: 750,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'firebase',
              test: /node_modules[\\/](?:firebase|@firebase)[\\/]/,
              priority: 10,
            },
            {
              name: 'fsrs',
              test: /node_modules[\\/]ts-fsrs[\\/]/,
              priority: 20,
            },
          ],
        },
      },
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
    {
      name: 'bundle-budget',
      generateBundle(_, bundle) {
        for (const item of Object.values(bundle)) {
          const bytes = item.type === 'chunk' ? Buffer.byteLength(item.code) : Buffer.byteLength(typeof item.source === 'string' ? item.source : item.source)
          if (item.fileName.endsWith('.css'))
            assertBundleBudget(item.fileName, bytes, bundleBudgets.css)
          else if (item.type === 'chunk' && item.isEntry)
            assertBundleBudget(item.fileName, bytes, bundleBudgets.entry)
          else if (item.type === 'chunk' && item.fileName.includes('firebase-'))
            assertBundleBudget(item.fileName, bytes, bundleBudgets.firebase)
          else if (item.type === 'chunk')
            assertBundleBudget(item.fileName, bytes, bundleBudgets.async)
        }
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
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
            src: `${basePath}icons/lexiro.png`,
            sizes: '1254x1254',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: `${basePath}index.html`,
        navigateFallbackAllowlist: [/./],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        globIgnores: ['**/firebase-*.js', 'icons/*.png'],
        maximumFileSizeToCacheInBytes: bundleBudgets.async,
        manifestTransforms: [async (entries) => {
          const total = entries.reduce((sum, entry) => sum + (entry.size ?? 0), 0)
          assertBundleBudget('PWA precache', total, bundleBudgets.precache)
          return { manifest: entries, warnings: [] }
        }],
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
