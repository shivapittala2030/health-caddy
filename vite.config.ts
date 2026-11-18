import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// BASE_PATH lets the same build run at a domain root or under /health-caddy/ on GitHub Pages.
export default defineConfig({
  base: process.env.BASE_PATH || './',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
