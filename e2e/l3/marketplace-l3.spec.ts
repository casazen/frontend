import { test, expect } from '@playwright/test';
import { requireE2eCredentials } from '../helpers/env';

/**
 * L3 — marketplace / service-request shell against real API.
 * Full supplier loop may require seeded suppliers; this asserts no 500 and page mount.
 */
test.describe('L3 marketplace shell', () => {
  test.skip(!process.env.E2E_LOCAL && !process.env.E2E_STAGING, 'Set E2E_LOCAL=1 or E2E_STAGING=1');
  test.setTimeout(120_000);

  test('AC: marketplace page loads; suppliers API not 500', async ({ page }) => {
    requireE2eCredentials();
    const api500: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) {
        api500.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto('/app/short-rent/marketplace');
    // Page may redirect if no property — still must not 500
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    expect(api500, 'Marketplace must not trigger API 500').toEqual([]);
  });
});
