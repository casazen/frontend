import { test, expect } from './test';
import {
  DEMO_ORG_SLUG,
  mockBrandedBookingApi,
  mockOrgPropertyId,
  mockPublicOrg,
} from './helpers/branded-booking-mock';

test.describe('Branded booking site (#215)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBrandedBookingApi(page);
    await page.addInitScript(() => {
      localStorage.removeItem('casazen_cookie_consent');
    });
  });

  test('AC4/AC5: branded landing renders org branding and listings without login', async ({ page }) => {
    await page.goto(`/book/${DEMO_ORG_SLUG}`);

    await expect(page.getByTestId('public-booking-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1, name: mockPublicOrg.displayName, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trastevere Suite' })).toBeVisible();
    await expect(page.getByText('CIN valido')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('AC4: unknown org slug shows branded 404', async ({ page }) => {
    await page.goto('/book/unknown-org-xyz');

    await expect(page.getByText('Organizzazione non trovata')).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('AC6/AC7: property detail and checkout route without auth header', async ({ page }) => {
    let authHeader: string | undefined;

    await page.route(`**/api/public/orgs/${DEMO_ORG_SLUG}/properties/${mockOrgPropertyId}`, async (route) => {
      authHeader = route.request().headers()['authorization'];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: mockOrgPropertyId,
          name: 'Trastevere Suite',
          description: 'Appartamento luminoso nel cuore di Roma.',
          city: 'Roma',
          postalCode: '00153',
          bedrooms: 2,
          bathrooms: 1,
          maxGuests: 4,
          nightlyRate: 165,
          cleaningFee: 55,
          amenities: ['Wifi'],
          photoUrls: [],
          cinCode: 'IT-12345-0123456789',
          cinStatus: 'Valid',
          timezone: 'Europe/Rome',
          houseRules: 'Check-in dalle 15:00.',
          cancellationPolicySummary: 'Flessibile',
          minNights: null,
          currency: 'EUR',
        }),
      });
    });

    await page.goto(`/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}`);

    await expect(page.getByRole('heading', { name: 'Trastevere Suite' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Regolamento')).toBeVisible();
    expect(authHeader).toBeUndefined();

    await page.locator('#check-in').fill('2026-07-01');
    await page.locator('#check-out').fill('2026-07-04');
    await page.getByRole('button', { name: 'Procedi al checkout' }).click();

    await expect(page.getByTestId('direct-checkout-page')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('AC8: cookie consent banner appears on first visit', async ({ page }) => {
    await page.goto(`/book/${DEMO_ORG_SLUG}`);

    const banner = page.getByTestId('cookie-consent-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Accetta' }).click();
    await expect(banner).not.toBeVisible();
  });
});
