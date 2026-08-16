import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E — three modes:
 * - default / CI: L2 demo (`page.route` mocks OK)
 * - E2E_LOCAL=1: L3 against local InMemory API (no mock of paths under test)
 * - E2E_STAGING=1: L3 / smoke against Railway test API
 *
 * @see https://playwright.dev/docs/test-configuration
 */
const isLocalRun = process.env.E2E_LOCAL === '1';
const isStagingRun = process.env.E2E_STAGING === '1';
const isDeploySmokeRun = process.env.E2E_DEPLOY_SMOKE === '1';
const isProdSmokeRun = process.env.E2E_PROD_SMOKE === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    // Prefer localhost over 127.0.0.1 so Auth0 callback URLs match the tenant allowlist.
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },

  projects: isProdSmokeRun
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
            '**/golden-journey-web.spec.ts',
            '**/golden-journey-supplier-mobile.spec.ts',
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
          ],
          dependencies: ['setup'],
          use: {
            ...devices['Desktop Chrome'],
            baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
            storageState: 'e2e/.auth/long-term-user.json',
          },
        },
        {
          name: 'staging-gj',
          // Real-API L3 only (demo golden-journey-web.spec.ts stays in L2 chromium project)
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
            '**/*-l3.spec.ts',
            '**/prod-deploy-smoke.spec.ts',
          ],
          use: { ...devices['Desktop Chrome'] },
        },
      ],

  webServer: isDeploySmokeRun || isProdSmokeRun
    ? undefined
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
          VITE_AUTH0_DOMAIN:
            process.env.VITE_AUTH0_DOMAIN ?? 'dev-mp6wadq7j6bophl5.us.auth0.com',
          VITE_AUTH0_CLIENT_ID:
            process.env.VITE_AUTH0_CLIENT_ID ?? 'xmZPesTR04r349c14n77MgJ2iSCeFaJb',
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
          VITE_API_BASE_URL:
            process.env.E2E_STAGING_API_URL ?? 'https://casazen-api-test.up.railway.app/api',
          VITE_AUTH0_DOMAIN:
            process.env.VITE_AUTH0_DOMAIN ?? 'dev-mp6wadq7j6bophl5.us.auth0.com',
          VITE_AUTH0_CLIENT_ID:
            process.env.VITE_AUTH0_CLIENT_ID ?? 'xmZPesTR04r349c14n77MgJ2iSCeFaJb',
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
        },
      },
});
