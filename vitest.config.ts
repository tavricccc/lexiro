import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@lottiefiles/dotlottie-vue': resolve(import.meta.dirname, 'tests/mocks/dotlottie-vue.ts'),
      'idb-keyval': resolve(import.meta.dirname, 'tests/mocks/idb-keyval.ts'),
    },
  },
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
