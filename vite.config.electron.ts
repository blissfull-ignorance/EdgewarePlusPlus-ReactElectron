import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  plugins: [
    electron({
      entry: 'electron/main.ts',
      preload: 'electron/preload.ts',
      externals: ['fengari', 'fengari-interop'],
      outputDirectory: 'dist-electron',
    }),
  ],
})
