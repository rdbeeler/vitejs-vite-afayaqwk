import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // Fixed: / instead of .

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/vitejs-vite-afayaqwk/',
})
