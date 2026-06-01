import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const FASTAPI_URL = 'http://localhost:8001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: FASTAPI_URL,
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        proxyTimeout: 30000,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.path = req.url.replace(/^\/api/, '');
          });
        },
      },
    },
  },
})
