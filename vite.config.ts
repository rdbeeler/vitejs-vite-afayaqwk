import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // <-- Changed dot to slash here!

export default defineConfig({
  plugins: [react()],
  base: './',
});
