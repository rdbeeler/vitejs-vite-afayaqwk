import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // <-- Fixed dot to slash here!

export default defineConfig({
  plugins: [react()],
  base: './',
});
