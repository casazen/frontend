import { test, expect } from '@playwright/test';

const FE_URL =
  process.env.E2E_DEPLOY_FE_URL ??
  (process.env.E2E_STAGING === '1'
    ? 'https://casazen-app.vercel.app'
    : 'http://localhost:5173');

/**
 * Verifies deployed Vercel FE serves the React SPA (not a broken .env or placeholder).
 * Run in CI: E2E_DEPLOY_SMOKE=1 E2E_DEPLOY_FE_URL=https://casazen-app.vercel.app
 */
test.describe('Vercel deploy smoke', () => {
  test.skip(!process.env.E2E_DEPLOY_SMOKE, 'Set E2E_DEPLOY_SMOKE=1 for live FE deploy checks');

  test('serves React root on deployed URL', async ({ page }) => {
    await page.goto(FE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).toBeAttached({ timeout: 30_000 });
    const html = await page.content();
    expect(html).not.toContain('GEMINI_API_KEY');
    expect(html).not.toMatch(/VITE_[A-Z_]+=placeholder/i);
  });

  test('public /book route serves SPA (not static env leak) (#284)', async ({ page }) => {
    await page.goto(`${FE_URL.replace(/\/$/, '')}/book/demo-org`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('#root')).toBeAttached({ timeout: 30_000 });
    const html = await page.content();
    expect(html).not.toMatch(/VITE_[A-Z_]+=placeholder/i);
  });

  test('login page or app shell loads without console 500 storms', async ({ page }) => {
    const serverErrors: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500 && res.url().includes('/api/')) {
        serverErrors.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto(FE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
    await expect(page.locator('#root')).toBeAttached();

    expect(
      serverErrors,
      `API 500 responses on page load: ${serverErrors.join(', ')}`,
    ).toHaveLength(0);
  });
});
