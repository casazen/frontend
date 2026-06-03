import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for CasaZen frontend.
 *
 * Tests run against the Vite dev server in demo mode so Auth0 is bypassed.
 * All backend API calls are intercepted inside each test via page.route().
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev:demo',
    url: 'http://localhost:5173',
    // Always start dev:demo so VITE_DEMO_MODE is set (avoid reusing a non-demo dev server on :5173)
    reuseExistingServer: false,
    env: {
      VITE_DEMO_MODE: 'true',
    },
  },
});
