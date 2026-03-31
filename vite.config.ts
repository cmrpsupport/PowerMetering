import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Windows localhost-only deployment: proxy API calls to Node-RED.
    // This makes /api/* work even if VITE_API_BASE_URL isn't set.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:1880',
        changeOrigin: true,
      },
    },
  },
})
