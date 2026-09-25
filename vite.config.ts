import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'
import { assertDemoBuildAllowed } from './src/config/demo-build-guard'
import { buildRobotsTxt } from './src/config/robots-txt'

/** SE-02 (A8-02): `dist/robots.txt`, allowing indexing only on the Vercel production environment. */
function robotsTxt(content: string): Plugin {
  return {
    name: 'casazen-robots-txt',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: content })
    },
  }
}

// https://vite.dev/config/
// Opt-in HTTPS for phone/LAN Auth0 (Web Crypto). Default HTTP so Playwright E2E can probe http://localhost:5173.
const useHttpsDev = process.env.VITE_HTTPS === '1';

export default defineConfig(({ command, mode }) => {
  const viteEnv = loadEnv(mode, process.cwd(), 'VITE_');
  // A9-38: demo mode (no login) only on the dev server or in `npm run build:demo`, never in a normal build.
  assertDemoBuildAllowed({
    command,
    mode,
    demoFlag: viteEnv.VITE_DEMO_MODE,
    vercelEnv: process.env.VERCEL_ENV,
  });

  // SE-02: computed before the build starts, so a production build without VITE_PUBLIC_SITE_URL fails right away.
  const plugins: PluginOption[] = useHttpsDev ? [react(), basicSsl()] : [react()];
  if (command === 'build') {
    plugins.push(
      robotsTxt(buildRobotsTxt({ vercelEnv: process.env.VERCEL_ENV, publicSiteUrl: viteEnv.VITE_PUBLIC_SITE_URL })),
    );
  }

  return {
    plugins,
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
