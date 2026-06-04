import { expect, test } from '@playwright/test';
import { demoUrl } from './helpers/demo-profile';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';

test.describe('Context workspace switcher (#189)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('redirects legacy /leases to canonical long-rent route', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/leases', 'long-term'), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/app\/long-rent\/leases/);
  });

  test('short-rent profile uses canonical context path', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/profile', 'short-stay'));
    await expect(page).toHaveURL(/\/app\/short-rent\/profile/);
  });

  test('long-rent user cannot access short-rent routes', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/app/short-rent/bookings', 'long-term'), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/app\/long-rent\/leases/);
  });

  test('dual-role user can switch between contexts', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'Affitti brevi' })).toBeVisible();
    await page.getByRole('tab', { name: 'Affitti lungo termine' }).click();
    await expect(page).toHaveURL(/\/app\/long-rent\/leases/);
    await page.getByRole('tab', { name: 'Affitti brevi' }).click();
    await expect(page).toHaveURL(/\/app\/short-rent/);
  });

  test('admin-only user lands in admin context', async ({ page }) => {
    await page.goto(demoUrl('/app/choose-context', 'admin'));
    await expect(page).toHaveURL(/\/app\/admin/);
    await expect(page.getByRole('link', { name: 'Utenti' })).toBeVisible();
  });
});
