import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/sk/',
  server: {
    port: 5173,
    proxy: {
      '/sk/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
