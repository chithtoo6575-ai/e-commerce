import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

function copy404Plugin() {
  return {
    name: 'copy-404',
    closeBundle() {
      const distDir = path.resolve(process.cwd(), 'dist')
      const indexHtml = path.join(distDir, 'index.html')
      const notFoundHtml = path.join(distDir, '404.html')
      if (fs.existsSync(indexHtml)) {
        fs.copyFileSync(indexHtml, notFoundHtml)
      }
    },
  }
}

const base = ((process.env.VITE_BASE_PATH && process.env.VITE_BASE_PATH.trim()) || '/e-commerce/').replace(/\/?$/, '/')

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), copy404Plugin()],
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8787',
      '/uploads': 'http://localhost:8787',
    },
  },
})
