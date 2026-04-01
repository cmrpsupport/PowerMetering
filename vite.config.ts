import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

function gitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: rootDir }).trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __GIT_SHA__: JSON.stringify(gitShortSha()),
  },
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
