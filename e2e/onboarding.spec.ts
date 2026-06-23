import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPlansCatalog } from './helpers/org-api-mock';

async function completeOnboardingFromRentalChoice(
  page: import('@playwright/test').Page,
  rentalButtonIndex: number,
) {
  await page.getByRole('button', { name: 'Scegli' }).nth(rentalButtonIndex).click();
  await expect(page.getByTestId('plan-selection-grid')).toBeVisible();
  await page.getByTestId('onboarding-plan-confirm').click();
}

test.describe('Role-based onboarding (#198)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlansCatalog(page);
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

    await completeOnboardingFromRentalChoice(page, 0);
    await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 15_000 });
  });

  test('AC3 long-term choice navigates to leases home', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'onboarding'));

    await completeOnboardingFromRentalChoice(page, 1);
    await expect(page).toHaveURL(/\/app\/long-rent\/leases/, { timeout: 15_000 });
  });

  test('AC5 user with roles visiting onboarding is redirected away', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'short-stay'));

    await expect(page).not.toHaveURL(/\/onboarding$/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/app\/short-rent/);
  });
});

test.describe('Persistent onboarding completion (#277)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlansCatalog(page);
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('AC1 completed user stays on home when visiting /onboarding', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'short-stay'));

    await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Come vuoi usare CasaZen/i })).not.toBeVisible();
  });

  test('AC3 user without completion sees onboarding on first visit', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'onboarding'));

    await expect(page.getByRole('heading', { name: /Come vuoi usare CasaZen/i })).toBeVisible();
  });

  test('AC4 edit mode only accessible after onboarding completed', async ({ page }) => {
    await page.goto(demoUrl('/onboarding?mode=edit', 'short-stay'));

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10_000 });

    await expect(page.getByRole('button', { name: /Salva modifiche/i })).toBeVisible();
  });
});
