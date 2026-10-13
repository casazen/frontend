import { test, expect } from '@playwright/test';
import { installDemoUserMeMock } from './helpers/org-api-mock';
import { demoUrl } from './helpers/demo-profile';
import { chooseLanguage, openProfileMenu, profileMenuTrigger } from './helpers/profile-menu';

const DEMO_STAY = {
  bookingId: 'booking-i18n-1',
  propertyId: 'prop-i18n-1',
  propertyName: 'Villa Demo',
  guestName: 'Mario Rossi',
  checkInDate: '2026-07-01',
  checkOutDate: '2026-07-05',
  status: 'Confirmed',
  totalPrice: 480,
  createdAt: '2026-06-01T10:00:00Z',
};

// PC-16: the dashboard reads the KPIs computed by the server (`GET /api/dashboard/kpis`), not the bookings list.
const DEMO_KPIS = {
  period: { kind: 'Month', from: '2026-07-01', to: '2026-07-31', nights: 31 },
  today: '2026-07-01',
  propertyCount: 1,
  occupancy: { occupiedNights: 4, availableNights: 31, closedNights: 0, rate: 4 / 31 },
  revenue: { amount: 480, currency: 'EUR', stayCount: 1 },
  arrivalsToday: { count: 0, items: [] },
  departuresToday: { count: 0, items: [] },
  upcomingCheckIns: { count: 0, items: [] },
  recentBookings: [DEMO_STAY],
};

async function mockDashboardApis(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/dashboard/kpis**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEMO_KPIS),
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
    const menu = await openProfileMenu(page);
    await expect(menu.getByRole('menuitemradio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
    await expect(menu.getByRole('menuitemradio', { name: 'Italiano' })).toHaveAttribute('aria-checked', 'false');
  });

  test('booking badge shows Confermata not confirmed slug', async ({ page }) => {
    await resetLocaleToDefault(page);
    await gotoDashboard(page);

    await expect(page.getByText('Confermata')).toBeVisible();
    await expect(page.getByText('confirmed', { exact: true })).not.toBeVisible();
  });
});
