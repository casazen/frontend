import { test, expect } from '@playwright/test';
import { installDemoUserMeMock } from './helpers/org-api-mock';
import { demoUrl } from './helpers/demo-profile';

const DEMO_BOOKING = {
  id: 'booking-i18n-1',
  propertyId: 'prop-i18n-1',
  userId: 'auth0|demo-e2e',
  checkInDate: '2026-07-01T00:00:00Z',
  checkOutDate: '2026-07-05T00:00:00Z',
  numberOfGuests: 2,
  totalPrice: 480,
  currency: 'EUR',
  status: 'Confirmed',
  guest: {
    firstName: 'Mario',
    lastName: 'Rossi',
    email: 'mario@example.com',
    phone: '+39 333 1234567',
    country: 'IT',
  },
  createdAt: '2026-06-01T10:00:00Z',
  updatedAt: '2026-06-01T10:00:00Z',
};

async function mockDashboardApis(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/bookings', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([DEMO_BOOKING]),
    });
  });

  await page.route('**/api/properties', async (route) => {
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

async function switchToEnglish(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('language-switcher').locator('button', { hasText: 'EN' }).click();
}

async function gotoDashboard(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByTestId('language-switcher')).toBeVisible({ timeout: 15_000 });
}

test.describe('i18n language switch (#251)', () => {
  test.beforeEach(async ({ page }) => {
    await installDemoUserMeMock(page);
    await mockDashboardApis(page);
  });

  test('defaults to Italian Cruscotto and Immobili nav label', async ({ page }) => {
    await resetLocaleToDefault(page);
    await gotoDashboard(page);

    await expect(page.getByRole('heading', { name: 'Cruscotto' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Immobili' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Proprietà' })).not.toBeVisible();
  });

  test('switches to English dashboard title', async ({ page }) => {
    await resetLocaleToDefault(page);
    await gotoDashboard(page);

    await switchToEnglish(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Properties' })).toBeVisible();
  });

  test('persists locale across reload', async ({ page }) => {
    await resetLocaleToDefault(page);
    await gotoDashboard(page);

    await switchToEnglish(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByTestId('language-switcher').locator('button', { hasText: 'EN' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('booking badge shows Confermata not confirmed slug', async ({ page }) => {
    await resetLocaleToDefault(page);
    await gotoDashboard(page);

    await expect(page.getByText('Confermata')).toBeVisible();
    await expect(page.getByText('confirmed', { exact: true })).not.toBeVisible();
  });
});
