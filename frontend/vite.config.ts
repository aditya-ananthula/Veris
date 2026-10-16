import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/ask': 'http://127.0.0.1:8000',
      '/documents': 'http://127.0.0.1:8000',
      '/absorb': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/capabilities': 'http://127.0.0.1:8000',
      '/intel': 'http://127.0.0.1:8000',
    },
  },
  preview: { port: 5173 },
});
