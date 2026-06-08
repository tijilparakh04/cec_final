import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward frontend /api calls to the Express backend
      '/api': 'http://localhost:3001',
    },
  },
})

