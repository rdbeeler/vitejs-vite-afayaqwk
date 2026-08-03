import { defineConfig } from 'vite'
import react from '@vitejs.plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/vitejs-vite-ukitnfuz/', // MUST have a slash at the start and end!
})
