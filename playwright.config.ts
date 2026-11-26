import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E — three modes:
 * - default / CI: L2 demo (`page.route` mocks OK)
 * - E2E_LOCAL=1: L3 against local InMemory API (no mock of paths under test)
 * - E2E_STAGING=1: L3 / smoke against Railway test API
 * - E2E_GJ_L3=1: Golden Journey L3 from the UI on an ephemeral stack (real backend + PostgreSQL + mock IdP), three
 *   distinct actors; `e2e/stack/up.sh` first, runbook backend docs/runbooks/golden-journey-l3.md
 * - E2E_EMBED=1: cross-origin proof of the embeddable widgets (NF-150, `npm run test:e2e:embed`): the app is BUILT and served by
 *   `vite preview`, the agency's WordPress site and its booking domain are two fictitious https origins that Playwright answers itself, the
 *   API is mocked. Only `e2e/embed-cross-origin.spec.ts` runs, in the job `e2e-embed`; the L2 shards never do.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
const isLocalRun = process.env.E2E_LOCAL === '1';
const isStagingRun = process.env.E2E_STAGING === '1';
const isDeploySmokeRun = process.env.E2E_DEPLOY_SMOKE === '1';
/** Golden Journey L3 on the ephemeral stack (FN-03): `e2e/stack/up.sh` starts it, `e2e/gj-l3/` is the suite. */
const isGjL3Run = process.env.E2E_GJ_L3 === '1';
const isProdSmokeRun = process.env.E2E_PROD_SMOKE === '1';
/** Landlord CondoLedger on the Vite app proxied to the Railway test API. */
const isCondoLedgerRun = process.env.E2E_CONDOLEDGER === '1';
/** The embeddable widgets framed by a page of another origin (E43/F01/US01): a build of the app, not the dev server, behind two fictitious https origins. */
const isEmbedRun = process.env.E2E_EMBED === '1';

/**
 * Auth0 tenant of a real-login run (E2E_LOCAL / E2E_STAGING): no default tenant in code (PL-11, A1-32). The test
 * tenant is set per run, never the production one (backend docs/runbooks/auth0.md section 1).
 */
function requiredAuth0Env(name: 'VITE_AUTH0_DOMAIN' | 'VITE_AUTH0_CLIENT_ID'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for E2E_LOCAL / E2E_STAGING runs: set it to the Auth0 test tenant.`);
  }
  return value;
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',

  use: {
    // Prefer localhost over 127.0.0.1 so Auth0 callback URLs match the tenant allowlist.
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
  },

  projects: isEmbedRun
    ? [
        {
          name: 'embed',
          testMatch: '**/embed-cross-origin.spec.ts',
          // The spec only opens the two fictitious origins; the base address is the one of the build it waits for (`webServer` below).
          use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173' },
        },
      ]
    : isCondoLedgerRun
    ? [
        {
          name: 'condoledger',
          testMatch: '**/condoledger-landlord.spec.ts',
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : isGjL3Run
    ? [
        {
          name: 'gj-l3',
          testMatch: '**/gj-l3/**/*.spec.ts',
          // The mock IdP serves a throw-away self-signed certificate (the backend trusts it via SSL_CERT_FILE).
          use: {
            ...devices['Desktop Chrome'],
            baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
            ignoreHTTPSErrors: true,
          },
        },
      ]
    : isProdSmokeRun
    ? [
        {
          name: 'prod-smoke',
          testMatch: '**/prod-deploy-smoke.spec.ts',
          use: {
            ...devices['Desktop Chrome'],
            baseURL: process.env.E2E_PROD_FE_URL ?? 'https://casazen-app.vercel.app',
          },
        },
      ]
    : isDeploySmokeRun
    ? [
        {
          name: 'deploy-smoke',
          testMatch: '**/vercel-deploy-smoke.spec.ts',
          use: {
            ...devices['Desktop Chrome'],
            baseURL: process.env.E2E_DEPLOY_FE_URL ?? 'https://casazen-app.vercel.app',
          },
        },
      ]
    : isLocalRun
    ? [
        {
          name: 'setup',
          testMatch: /auth\.setup\.ts/,
          use: {
            ...devices['Desktop Chrome'],
            baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
          },
        },
        {
          name: 'local',
          testMatch: [
            '**/property-staging.spec.ts',
            '**/local-integration.spec.ts',
            '**/l3/**/*.spec.ts',
            '**/*-l3.spec.ts',
          ],
          dependencies: ['setup'],
          use: {
            ...devices['Desktop Chrome'],
            // Must be localhost (not 127.0.0.1) — Auth0 Allowed Callback URLs use localhost.
            baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
            storageState: 'e2e/.auth/long-term-user.json',
          },
        },
      ]
    : isStagingRun
    ? [
        {
          name: 'setup',
          testMatch: /auth\.setup\.ts/,
          use: {
            ...devices['Desktop Chrome'],
            baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
          },
        },
        {
          name: 'staging',
          testMatch: [
            '**/property-staging.spec.ts',
            '**/api-regression-smoke.spec.ts',
            '**/condoledger-landlord.spec.ts',
          ],
          dependencies: ['setup'],
          use: {
            ...devices['Desktop Chrome'],
            baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
            storageState: 'e2e/.auth/long-term-user.json',
          },
        },
        {
          name: 'staging-tenant',
          testMatch: '**/tenant-canoni-live.spec.ts',
          use: {
            ...devices['Desktop Chrome'],
            baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
          },
        },
        {
          name: 'staging-gj',
          // Real-API L3 only (the Golden Journey is the gj-l3 project on the ephemeral stack, FN-03)
          testMatch: [
            '**/l3/**/*.spec.ts',
            '**/*-l3.spec.ts',
          ],
          dependencies: ['setup'],
          use: {
            ...devices['Desktop Chrome'],
            baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
            storageState: 'e2e/.auth/long-term-user.json',
          },
        },
      ]
    : [
        {
          name: 'chromium',
          testIgnore: [
            '**/property-staging.spec.ts',
            '**/api-regression-smoke.spec.ts',
            '**/vercel-deploy-smoke.spec.ts',
            '**/local-integration.spec.ts',
            '**/l3/**',
            '**/gj-l3/**',
            '**/*-l3.spec.ts',
            '**/prod-deploy-smoke.spec.ts',
            '**/condoledger-landlord.spec.ts',
            '**/tenant-canoni-live.spec.ts',
            // Needs a build behind two fictitious origins (mode E2E_EMBED): the six L2 shards never run it.
            '**/embed-cross-origin.spec.ts',
          ],
          use: { ...devices['Desktop Chrome'] },
        },
      ],

  // The L3 stack is started by e2e/stack/up.sh (database, backend, mock services and Vite), not by Playwright.
  webServer: isEmbedRun
    ? {
        // A BUILD of the app, served as it is (`vite preview`): `dist/embed/v1/embed.js` and its manifest are written by the build (`scripts/build-embed.mjs`), and the
        // dev server has an HMR socket that does not survive a proxy and never applies `vercel.json`. The spec answers the booking domain from this server.
        // It is the build that ships (`npm run build`), not `build:demo`: the demo build starts every public page with `DemoAuthBridge`, which reads `sessionStorage`
        // while it renders (`config/demo.config.ts`), so a widget could never be proven to work with the storage blocked; the real one reads none (`AnonymousAuthBridge`).
        command: 'npm run build && npx vite preview --host localhost --port 4173 --strictPort',
        url: 'http://localhost:4173',
        // A server that was left running serves an older build: only on request (`PW_REUSE_SERVER=1`).
        reuseExistingServer: process.env.PW_REUSE_SERVER === '1',
        timeout: 300_000,
        env: {
          // Same-origin relative API, so that the mocks of the page answer it.
          VITE_API_BASE_URL: '/api',
          VITE_HTTPS: '0',
          VITE_SUPPORT_EMAIL: 'inviti@example.test',
          // A `.env` with the demo flag must not turn this into a demo build (a normal build refuses it).
          VITE_DEMO_MODE: 'false',
          // A build that ships wants a sign-in tenant when the app starts (`config/env.config.ts`), though none of the pages of this proof ever loads the sign-in
          // service: placeholders, on a host that does not exist.
          VITE_AUTH0_DOMAIN: 'e2e-placeholder.test',
          VITE_AUTH0_CLIENT_ID: 'e2e-placeholder-client',
        },
      }
    : isDeploySmokeRun || isProdSmokeRun || isGjL3Run
    ? undefined
    : isCondoLedgerRun
    ? {
        command: 'npx vite --host localhost --port 5173',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          VITE_HTTPS: '0',
          VITE_DEMO_MODE: 'false',
          VITE_API_BASE_URL: '/api',
          E2E_API_PROXY_TARGET:
            process.env.E2E_STAGING_API_URL ?? 'https://casazen-api-test.up.railway.app/api',
          VITE_AUTH0_DOMAIN: process.env.VITE_AUTH0_DOMAIN ?? '',
          VITE_AUTH0_CLIENT_ID: process.env.VITE_AUTH0_CLIENT_ID ?? '',
          VITE_AUTH0_AUDIENCE: process.env.VITE_AUTH0_AUDIENCE ?? 'https://casazen-api',
        },
      }
    : isLocalRun
    ? {
        // Bind localhost so Auth0 redirect_uri (window.location.origin) matches Allowed Callback URLs.
        command: 'npx vite --host localhost --port 5173',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 180_000,
        env: {
          VITE_HTTPS: '0',
          VITE_API_BASE_URL:
            process.env.E2E_LOCAL_API_URL ?? 'http://localhost:5000/api',
          VITE_AUTH0_DOMAIN: requiredAuth0Env('VITE_AUTH0_DOMAIN'),
          VITE_AUTH0_CLIENT_ID: requiredAuth0Env('VITE_AUTH0_CLIENT_ID'),
          VITE_AUTH0_AUDIENCE:
            process.env.VITE_AUTH0_AUDIENCE ?? 'https://casazen-api',
        },
      }
    : isStagingRun
    ? {
        command: 'npx vite --host localhost --port 5173',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          VITE_HTTPS: '0',
          // The staging API allows deployed origins; proxy local UI calls to the same real backend.
          VITE_API_BASE_URL: '/api',
          E2E_API_PROXY_TARGET:
            process.env.E2E_STAGING_API_URL ?? 'https://casazen-api-test.up.railway.app/api',
          VITE_AUTH0_DOMAIN: requiredAuth0Env('VITE_AUTH0_DOMAIN'),
          VITE_AUTH0_CLIENT_ID: requiredAuth0Env('VITE_AUTH0_CLIENT_ID'),
          VITE_AUTH0_AUDIENCE:
            process.env.VITE_AUTH0_AUDIENCE ?? 'https://casazen-api',
        },
      }
    : {
        command: 'npx vite --host localhost --port 5173',
        url: 'http://localhost:5173',
        // Always start a dedicated demo server so .env (VITE_DEMO_MODE=false / staging API) cannot leak in.
        reuseExistingServer: process.env.PW_REUSE_SERVER === '1',
        timeout: 180_000,
        env: {
          VITE_DEMO_MODE: 'true',
          VITE_HTTPS: '0',
          // Same-origin relative API so page.route mocks work without hitting Railway/local HTTPS.
          VITE_API_BASE_URL: '/api',
          VITE_SUPPORT_EMAIL: 'inviti@example.test',
        },
      },
});
