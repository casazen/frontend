import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPlansCatalog } from './helpers/org-api-mock';
import { completeOnboardingFromRentalChoice } from './helpers/onboarding';

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

  test('AC2 onboarding shows the three account profiles', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'onboarding'));

    await expect(page.getByTestId(/^signup-profile-/)).toHaveCount(3);
    await expect(page.getByTestId('signup-profile-agency')).toBeVisible();
    await expect(page.getByTestId('signup-profile-owner')).toBeVisible();
    await expect(page.getByTestId('signup-profile-supplier')).toBeVisible();
  });

  test('AC3 short-term choice navigates to short-rent home', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'onboarding'));

    await completeOnboardingFromRentalChoice(page, 0);
    await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 15_000 });
  });

  test('AC3 long-term choice opens the first property', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'onboarding'));

    await completeOnboardingFromRentalChoice(page, 1);
    await expect(page).toHaveURL(/\/app\/long-rent\/properties\/new\?first=1/, { timeout: 15_000 });
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

test('benvenuto amministratore apre il primo compito autorizzato dalla Home', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/onboarding/status**', route => route.fulfill({ json: {
    roleChosen: true, orgProvisioned: true, consentsAccepted: true, propertyCreated: false,
    sitePublished: false, firstBookingTaken: false, activated: false, publicBookingUrl: null,
    steps: [{ key: 'account', state: 'done' }, { key: 'organization', state: 'done' }, { key: 'property', state: 'todo' }],
  } }));
  await page.goto(demoUrl('/app/short-rent', 'short-stay'));
  const welcome = page.getByTestId('first-run-welcome');
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText('Affitti brevi');
  await welcome.getByTestId('first-run-start').click();
  await expect(page).toHaveURL(/\/app\/short-rent\/properties\/create/);
  await expect(page.getByTestId('first-run-wizard')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId('app-ready')).toBeVisible();
  await expect(page.getByTestId('first-run-wizard')).toHaveCount(0);
});
