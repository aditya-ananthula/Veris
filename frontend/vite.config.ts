import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const target = process.env.VERIS_DEV_API_ORIGIN || 'http://127.0.0.1:8000';
const proxy = Object.fromEntries(['/ask', '/documents', '/absorb', '/health', '/capabilities', '/intel/'].map(route => [route, {
  target,
  bypass(req: { headers: { accept?: string } }) {
    if (route === '/documents' && req.headers.accept?.includes('text/html')) return '/index.html';
  },
}]));

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  server: {
    port: 5173,
    proxy,
  },
  preview: { port: 5173 },
});
