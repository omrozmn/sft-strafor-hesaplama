import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/static/',
  server: {
    proxy: {
      '/calculate': {
        target: 'http://localhost:6098',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:6098',
        changeOrigin: true,
      }
    }
  }
})
