import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Tower vive en la raíz de su propio dominio, así que base es siempre '/'.
// Puerto 5174 para poder correr junto al web de Sandor (5173).
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
