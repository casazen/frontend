import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

// https://vite.dev/config/
// Opt-in HTTPS for phone/LAN Auth0 (Web Crypto). Default HTTP so Playwright E2E can probe http://localhost:5173.
const useHttpsDev = process.env.VITE_HTTPS === '1';

export default defineConfig({
  plugins: useHttpsDev ? [react(), basicSsl()] : [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Exclude Playwright E2E tests — they are run separately via `npm run test:e2e`
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
