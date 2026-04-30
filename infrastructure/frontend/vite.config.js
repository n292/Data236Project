import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Port 3000 matches manual test URLs. If "already in use", stop the other process:
  //   lsof -iTCP:3000 -sTCP:LISTEN   then   kill <PID>
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      // Profile service (FastAPI, port 8000) — must come before generic /api
      '/api/members':   { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/api/auth':      { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/uploads':       { target: 'http://127.0.0.1:8002', changeOrigin: true },
      // Analytics service (MongoDB-backed, port 4000)
      '/analytics':     { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/events':        { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/recruiter/live-feed': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      // Application service (Node.js, port 5003)
      '/api/applications': { target: 'http://127.0.0.1:5003', changeOrigin: true, rewrite: path => path.replace(/^\/api/, '') },
      // Messaging service (MongoDB-backed, port 3004)
      '/api/messaging': { target: 'http://127.0.0.1:3004', changeOrigin: true },
      // Connection service (port 3005)
      '/api/connections': { target: 'http://127.0.0.1:3005', changeOrigin: true },
      // AI service (FastAPI, port 8005)
      '/ai': { target: 'http://127.0.0.1:8005', changeOrigin: true },
      // Job service (Node.js, port 3002)
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true
      },
      '/health': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true
      }
    }
  }
})
