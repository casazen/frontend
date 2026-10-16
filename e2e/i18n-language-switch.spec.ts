import { test, expect } from '@playwright/test';
import { installDemoUserMeMock } from './helpers/org-api-mock';
import { demoUrl } from './helpers/demo-profile';
import { chooseLanguage, openProfileMenu, profileMenuTrigger } from './helpers/profile-menu';

async function mockDashboardApis(page: import('@playwright/test').Page): Promise<void> {
  await page.route(/\/api\/properties(\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/payments', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/ota/integrations', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

async function resetLocaleToDefault(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('casazen.locale'));
  await page.reload({ waitUntil: 'networkidle' });
}

// UI-05: the language is chosen in the menu of the profile (the avatar of the header), not with a switch of the header.
async function switchToEnglish(page: import('@playwright/test').Page): Promise<void> {
  await chooseLanguage(page, 'English');
}

async function gotoDashboard(page: import('@playwright/test').Page): Promise<void> {
  await expect(profileMenuTrigger(page)).toBeVisible({ timeout: 15_000 });
}

test.describe('i18n language switch (#251)', () => {
  test.beforeEach(async ({ page }) => {
    await installDemoUserMeMock(page);
    await mockDashboardApis(page);
  });

  test('defaults to the Italian greeting and Immobili nav label', async ({ page }) => {
    await resetLocaleToDefault(page);
    await gotoDashboard(page);

    await expect(page.getByRole('heading', { name: /^Buongiorno/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Immobili' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Proprietà' })).not.toBeVisible();
  });

  test('switches to the English greeting', async ({ page }) => {
    await resetLocaleToDefault(page);
    await gotoDashboard(page);

    await switchToEnglish(page);
    await expect(page.getByRole('heading', { name: /^Good morning/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Properties' })).toBeVisible();
  });

  test('persists locale across reload', async ({ page }) => {
    await resetLocaleToDefault(page);
    await gotoDashboard(page);

    await switchToEnglish(page);
    await expect(page.getByRole('heading', { name: /^Good morning/ })).toBeVisible();

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /^Good morning/ })).toBeVisible();
    const menu = await openProfileMenu(page);
    await expect(menu.getByRole('menuitemradio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
    await expect(menu.getByRole('menuitemradio', { name: 'Italiano' })).toHaveAttribute('aria-checked', 'false');
  });
});
