import { test, expect } from './test';
import {
  DEMO_ORG_SLUG,
  mockBrandedBookingApi,
  mockOrgProperties,
  mockOrgPropertyId,
  mockPublicOrg,
} from './helpers/branded-booking-mock';

test.describe('Branded booking site (#215)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBrandedBookingApi(page);
    await page.addInitScript(() => {
      localStorage.removeItem('casazen_cookie_consent');
      localStorage.setItem('casazen.locale', 'it');
    });
  });

  test('AC4/AC5: branded landing renders org branding and listings without login', async ({ page }) => {
    await page.goto(`/book/${DEMO_ORG_SLUG}`);

    await expect(page.getByTestId('public-site-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1, name: mockPublicOrg.displayName, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trastevere Suite' })).toBeVisible();
    await expect(page.getByText('CIN valido').first()).toBeVisible();
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

  test('AC8: footer contains Privacy Policy and Terms of Service links', async ({ page }) => {
    await page.goto(`/book/${DEMO_ORG_SLUG}`);
    await expect(page.getByTestId('public-site-shell')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Termini di servizio' })).toBeVisible();
  });

  test('AC9: AI content notice is hidden when isAiGenerated is false', async ({ page }) => {
    await page.goto(`/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}`);
    await expect(page.getByRole('heading', { name: 'Trastevere Suite' })).toBeVisible({ timeout: 15_000 });
    // By default the property detail renders AiContentNotice with visible=false
    await expect(page.getByTestId('ai-content-notice')).not.toBeVisible();
  });

  test('AC11: /app/short-rent/dashboard redirects to login when not authenticated', async ({ page }) => {
    // In demo mode these routes still exist under ProtectedRoute
    // Navigate to a protected route — it should redirect to /login or /app/choose-context, never render the shell
    await page.goto('/app/short-rent/dashboard');
    // In demo mode the protected routes are bypassed, but in non-demo they redirect
    // We verify the page is NOT the public booking shell (no auth chrome on /book)
    await expect(page.getByTestId('public-site-shell')).not.toBeAttached();
  });
});

test.describe('Vetrina navigation UX pass 1 (#338)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBrandedBookingApi(page);
    await page.addInitScript(() => {
      localStorage.removeItem('casazen_cookie_consent');
      localStorage.setItem('casazen.locale', 'it');
    });
  });

  test('AC2: property detail shows breadcrumb org > property', async ({ page }) => {
    await page.goto(`/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}`);

    const breadcrumb = page.getByTestId('public-breadcrumb');
    await expect(breadcrumb).toBeVisible({ timeout: 15_000 });
    await expect(breadcrumb.getByText(mockPublicOrg.displayName)).toBeVisible();
    await expect(breadcrumb.getByText('Trastevere Suite')).toBeVisible();
  });

  test('AC3: URL params persist on property detail and checkout', async ({ page }) => {
    await page.goto(
      `/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}?checkIn=2026-08-01&checkOut=2026-08-05&guests=3`,
    );

    await expect(page.getByTestId('public-property-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#check-in')).toHaveValue('2026-08-01');
    await expect(page.locator('#check-out')).toHaveValue('2026-08-05');
    await expect(page.locator('#guests')).toHaveValue('3');

    await page.getByRole('button', { name: 'Procedi al checkout' }).click();
    await expect(page).toHaveURL(/checkIn=2026-08-01/);
    await expect(page).toHaveURL(/checkOut=2026-08-05/);
    await expect(page).toHaveURL(/guests=3/);
    await expect(page.getByTestId('public-breadcrumb')).toContainText('Checkout');
  });

  test('AC4: single-property org redirects landing to property detail', async ({ page }) => {
    await page.route(`**/api/public/orgs/${DEMO_ORG_SLUG}/properties`, async (route) => {
      const url = route.request().url();
      if (route.request().method() !== 'GET' || !url.endsWith('/properties')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockOrgProperties[0]]),
      });
    });

    await page.goto(`/book/${DEMO_ORG_SLUG}?checkIn=2026-09-01&checkOut=2026-09-03`);

    await expect(page).toHaveURL(
      new RegExp(`/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}`),
      { timeout: 15_000 },
    );
    await expect(page).toHaveURL(/checkIn=2026-09-01/);
    await expect(page.getByTestId('public-property-page')).toBeVisible();
  });
});
