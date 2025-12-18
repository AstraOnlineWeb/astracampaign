import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  esbuild: false,
  server: {
    port: 3006,
    host: true,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: process.env.DOCKER === 'true' ? 'http://backend:3003' : (process.env.VITE_API_URL || 'http://localhost:3003'),
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash].[ext]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  }
})