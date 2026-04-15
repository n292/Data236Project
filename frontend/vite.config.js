import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Port 3000 matches manual test URLs. If "already in use", stop the other process:
  //   lsof -iTCP:3000 -sTCP:LISTEN   then   kill <PID>
  server: {
    port: 3000,
    strictPort: true
  }
})
