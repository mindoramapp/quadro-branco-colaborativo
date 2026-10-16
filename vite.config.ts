import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const server = `http://localhost:${process.env.PORT ?? 4444}`

export default defineConfig({
  plugins: [react()],
  // simple-peer (usado pelo y-webrtc) espera o `global` do Node
  define: { global: 'globalThis' },
  server: {
    port: 5173,
    proxy: {
      '/api': server,
      '/sync': { target: server, ws: true },
      '/signal': { target: server, ws: true },
    },
  },
})
