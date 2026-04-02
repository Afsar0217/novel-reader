import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist'))   return 'pdfjs'
          if (id.includes('framer-motion')) return 'framer'
          if (id.includes('mqtt'))          return 'mqtt'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
})
