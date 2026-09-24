import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'
import { assertDemoBuildAllowed } from './src/config/demo-build-guard'

// https://vite.dev/config/
// Opt-in HTTPS for phone/LAN Auth0 (Web Crypto). Default HTTP so Playwright E2E can probe http://localhost:5173.
const useHttpsDev = process.env.VITE_HTTPS === '1';

export default defineConfig(({ command, mode }) => {
  // A9-38: demo mode (no login) only on the dev server or in `npm run build:demo`, never in a normal build.
  assertDemoBuildAllowed({
    command,
    mode,
    demoFlag: loadEnv(mode, process.cwd(), 'VITE_').VITE_DEMO_MODE,
    vercelEnv: process.env.VERCEL_ENV,
  });

  return {
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
  }
})
