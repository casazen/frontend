import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { devPublicSite } from './scripts/dev-public-site'
import { vitestProjects } from './scripts/vitest-environments'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'
import { assertDemoBuildAllowed } from './src/config/demo-build-guard'
import { buildRobotsTxt } from './src/config/robots-txt'
import { isPublicSiteEnabled } from './src/site/site-gate'
import { assertVercelBuildEnv } from './src/config/vercel-build-env'

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

export default defineConfig(({ command, mode, isSsrBuild }) => {
  const viteEnv = loadEnv(mode, process.cwd(), 'VITE_');
  // A9-38: demo mode (no login) only on the dev server or in `npm run build:demo`, never in a normal build.
  const demoMode = assertDemoBuildAllowed({
    command,
    mode,
    demoFlag: viteEnv.VITE_DEMO_MODE,
    vercelEnv: process.env.VERCEL_ENV,
  });

  // DEPLOY-CFG: a Vercel preview/production build without its API URL or Auth0 variables fails here (the previous
  // deployment stays live) instead of calling the production API or opening a blank page.
  if (command === 'build') {
    assertVercelBuildEnv({ vercelEnv: process.env.VERCEL_ENV, demoBuild: demoMode, env: viteEnv });
  }

  // SE-02: computed before the build starts, so a production build without VITE_PUBLIC_SITE_URL fails right away.
  const plugins: PluginOption[] = useHttpsDev ? [react(), basicSsl()] : [react()];
  if (command === 'serve' && demoMode) plugins.push(devPublicSite());
  // The SSR build only bundles the public site's renderer for the prerender (SEO-VETRINA): robots.txt belongs to dist/.
  if (command === 'build' && !isSsrBuild) {
    plugins.push(
      robotsTxt(
        buildRobotsTxt({
          vercelEnv: process.env.VERCEL_ENV,
          publicSiteUrl: viteEnv.VITE_PUBLIC_SITE_URL,
          // SEO-VETRINA: production serves the public site only with the company data (src/site/site-gate.ts).
          publicSiteEnabled: isPublicSiteEnabled({
            vercelEnv: process.env.VERCEL_ENV,
            legalName: viteEnv.VITE_LEGAL_NAME,
            legalVatId: viteEnv.VITE_LEGAL_VAT_ID,
            contactEmail: viteEnv.VITE_SUPPORT_EMAIL,
            withoutVatId: viteEnv.VITE_PUBLIC_SITE_WITHOUT_VAT_ID,
          }),
        }),
      ),
    );
  }

  return {
    plugins,
    // The deployment this bundle is for (`VERCEL_ENV`: production, preview, development), written into the code at build time: the console links the download of the plugin for
    // WordPress of its own channel with it (`src/config/deploy-env.ts`), so nobody has to set a variable. Empty outside Vercel (a local or CI build).
    define: { __CASAZEN_DEPLOY_ENV__: JSON.stringify(process.env.VERCEL_ENV ?? '') },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      // Only the staging E2E server supplies this target. Forward real requests, including Authorization.
      proxy: process.env.E2E_API_PROXY_TARGET ? {
        '/api': {
          target: process.env.E2E_API_PROXY_TARGET.replace(/\/$/, ''),
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api(?=\/|$)/, ''),
        },
      } : undefined,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Two pages: the single-page app and the template of the public site, prerendered after the build by
    // scripts/prerender-site.mjs (SEO-VETRINA). The SSR build takes its entry from the command line.
    build: isSsrBuild
      ? {}
      : {
          rollupOptions: {
            input: {
              // Key `index`: the app's entry chunk keeps its name (`/assets/index-*.js`, read by the deploy smoke tests).
              index: path.resolve(__dirname, 'index.html'),
              site: path.resolve(__dirname, 'site.html'),
            },
          },
        },
    test: {
      globals: true,
      // Exclude Playwright E2E tests — they are run separately via `npm run test:e2e`.
      // `integrations/**` is the WordPress plugin: its tests (PHPUnit, and the Node tests of its tools) run in its own workflow.
      exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'integrations/**', '**/.worktrees/**'],
      // Two projects (scripts/vitest-environments.ts): the `.test.ts` files that touch no DOM run in plain Node with no setup,
      // every other test keeps jsdom and `src/test/setup.ts` (jest-dom, i18n, stand-ins). Only under vitest, which sets VITEST before it
      // reads this file: `vite dev` and `vite build` do not scan the test files.
      projects: process.env.VITEST ? vitestProjects(__dirname, ['./src/test/setup.ts']) : undefined,
    },
  }
})
