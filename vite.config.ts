import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// FUTUREWORK: vitest config is co-located here since vite.config.ts doubles as
// the Vitest config root. If the test suite grows, consider splitting into a
// dedicated vitest.config.ts to keep build and test concerns separate.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@electron': path.resolve(__dirname, './electron'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    exclude: ['tests/**', 'node_modules/**', 'dist/**', 'electron-dist/**'],
  },
})
