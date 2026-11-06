import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Electron loads the production renderer from file://, so assets must not
  // be rooted at the filesystem volume (for example, /favicon.svg).
  base: './',
  server: { port: 5178, open: true, host: '127.0.0.1' },
  preview: { port: 5178, open: true, host: '127.0.0.1' },
  build: { target: 'es2022', sourcemap: true },
})
