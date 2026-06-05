import { test, expect } from '@playwright/test';
import { demoUrl } from './helpers/demo-profile';

test.describe('Role-based onboarding (#198)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('AC1 user with no roles is redirected to onboarding', async ({ page }) => {
    await page.goto(demoUrl('/', 'onboarding'));

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Come vuoi usare CasaZen/i })).toBeVisible();
  });

  test('AC2 onboarding shows three rental type cards', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'onboarding'));

    await expect(page.getByRole('button', { name: 'Scegli' })).toHaveCount(3);
    await expect(page.getByText('Affitti brevi')).toBeVisible();
    await expect(page.getByText('Locazioni di lungo periodo')).toBeVisible();
    await expect(page.getByText('Entrambi')).toBeVisible();
  });

  test('AC3 short-term choice navigates to short-rent home', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'onboarding'));

    await page.getByRole('button', { name: 'Scegli' }).first().click();
    await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 15_000 });
  });

  test('AC3 long-term choice navigates to leases home', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'onboarding'));

    await page.getByRole('button', { name: 'Scegli' }).nth(1).click();
    await expect(page).toHaveURL(/\/app\/long-rent\/leases/, { timeout: 15_000 });
  });

  test('AC5 user with roles visiting onboarding is redirected away', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'short-stay'));

    await expect(page).not.toHaveURL(/\/onboarding$/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/app\/short-rent/);
  });
});
