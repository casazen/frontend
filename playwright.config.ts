import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for CasaZen frontend.
 *
 * Tests run against the Vite dev server in demo mode so Auth0 is bypassed.
 * All backend API calls are intercepted inside each test via page.route().
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
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
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
        },
        {
          name: 'local',
          testMatch: /\/(property-staging|local-integration)\.spec\.ts/,
          dependencies: ['setup'],
          use: {
            ...devices['Desktop Chrome'],
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
        },
        {
          name: 'staging',
          testMatch: /\/(property-staging|api-regression-smoke)\.spec\.ts/,
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
          ],
          use: { ...devices['Desktop Chrome'] },
        },
      ],

  webServer: isDeploySmokeRun || isProdSmokeRun
    ? undefined
    : isLocalRun
    ? {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
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
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
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
        command: 'npm run dev:demo',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        env: {
          VITE_DEMO_MODE: 'true',
        },
      },
});
