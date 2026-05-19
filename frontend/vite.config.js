import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        proxyTimeout: 10000,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            // Silence ECONNREFUSED — backend may still be starting up
            if (err.code !== 'ECONNREFUSED') {
              console.error('[Proxy Error]', err.message);
            }
          });
        }
      }
    }
  }
})
