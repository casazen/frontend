import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPlansCatalog } from './helpers/org-api-mock';

test.describe('Persistent onboarding completion (#277)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlansCatalog(page);
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('AC1 completed user stays on home when visiting /onboarding', async ({ page }) => {
    // Visit onboarding with a profile that has completed onboarding (short-stay profile has timestamp)
    await page.goto(demoUrl('/onboarding', 'short-stay'));

    // Verify: should be redirected to home (onboarding already completed)
    await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Come vuoi usare CasaZen/i })).not.toBeVisible();
  });

  test('AC3 user without completion sees onboarding on first visit', async ({ page }) => {
    // Visit onboarding with onboarding profile (no timestamp yet)
    await page.goto(demoUrl('/onboarding', 'onboarding'));

    // Verify: should see onboarding page (not completed yet)
    await expect(page.getByRole('heading', { name: /Come vuoi usare CasaZen/i })).toBeVisible();
  });

  test('AC4 edit mode only accessible after onboarding completed', async ({ page }) => {
    // Visit edit mode with a completed profile (short-stay)
    await page.goto(demoUrl('/onboarding?mode=edit', 'short-stay'));

    // Verify: should be on onboarding page in edit mode
    // The page should be visible and not redirect away
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10_000 });

    // Verify: the "Salva modifiche" button appears (not "Completa registrazione")
    await expect(page.getByRole('button', { name: /Salva modifiche/i })).toBeVisible();
  });
});
