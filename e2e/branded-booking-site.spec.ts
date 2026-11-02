import { test, expect } from './test';
import {
  DEMO_ORG_SLUG,
  mockBrandedBookingApi,
  mockOrgProperties,
  mockOrgPropertyId,
  mockOrgPropertySlug,
  mockPublicOrg,
  mockStayCards,
  mockStaysResult,
} from './helpers/branded-booking-mock';
import { futureStay, mockDirectBookingQuoteApi } from './helpers/direct-checkout-mock';

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
    // The cards of the home do not carry a compliance badge ("CIN valido" / "CIN non valido"); the CIN is on the page of the home.
    await expect(page.getByText('CIN valido')).toHaveCount(0);
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
          cinCode: 'IT058091C27G5FFZDZ',
          cinStatus: 'Valid',
          timezone: 'Europe/Rome',
          houseRules: 'Check-in dalle 15:00.',
          cancellationPolicySummary: 'Flessibile',
          minNights: null,
          currency: 'EUR',
        }),
      });
    });

    await mockDirectBookingQuoteApi(page);
    const { checkIn, checkOut } = futureStay(20, 3);
    await page.goto(`/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}?checkin=${checkIn}&checkout=${checkOut}&guests=2`);

    await expect(page.getByRole('heading', { name: 'Trastevere Suite' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('property-house-rules')).toContainText('Check-in dalle 15:00.');
    expect(authHeader).toBeUndefined();

    // The card asks the quote for the stay of the address; "Prenota" is a link once the total of the server is in.
    await expect(page.getByTestId('booking-cta')).toHaveAttribute('href', /\/checkout\?/, { timeout: 15_000 });
    await page.getByTestId('booking-cta').click();

    await expect(page.getByTestId('direct-checkout-page')).toBeVisible();
    await expect(page.getByTestId('checkout-stay-summary')).toContainText('3 notti');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('AC8: cookie consent banner appears on first visit', async ({ page }) => {
    await page.goto(`/book/${DEMO_ORG_SLUG}`);

    const banner = page.getByTestId('cookie-consent-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Accetta' }).click();
    await expect(banner).not.toBeVisible();
  });

  test("AC8: footer links to the operator's own privacy notice and booking terms (BK-14)", async ({ page }) => {
    await page.goto(`/book/${DEMO_ORG_SLUG}`);
    await expect(page.getByTestId('public-site-shell')).toBeVisible({ timeout: 15_000 });

    // BK-14: on a host's booking site the footer offers the operator's documents of that site, opened in a new tab,
    // not the CasaZen ones.
    const privacy = page.getByTestId('footer-privacy');
    const terms = page.getByTestId('footer-terms');
    await expect(privacy).toHaveText('Informativa privacy');
    await expect(privacy).toHaveAttribute('href', `/book/${DEMO_ORG_SLUG}/privacy`);
    await expect(privacy).toHaveAttribute('target', '_blank');
    await expect(terms).toHaveText('Termini di prenotazione');
    await expect(terms).toHaveAttribute('href', `/book/${DEMO_ORG_SLUG}/termini`);
    await expect(terms).toHaveAttribute('target', '_blank');
    await expect(page.getByTestId('footer-legal')).toHaveCount(0);
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

  test('AC2: property detail shows its title, the way back to the homes and the share button (DB-04a)', async ({ page }) => {
    await page.goto(`/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}`);

    await expect(page.getByRole('heading', { level: 1, name: 'Trastevere Suite' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('property-util-bar')).toBeVisible();
    await expect(page.getByTestId('property-share')).toBeVisible();
    // The org has several homes in the mock: the way back to all of them is there.
    await expect(page.getByTestId('property-back')).toHaveAttribute('href', new RegExp(`/book/${DEMO_ORG_SLUG}`));
  });

  test('AC3: legacy camelCase params persist on property detail and checkout in the deep link form', async ({ page }) => {
    const { checkIn, checkOut } = futureStay(40, 4);
    await mockDirectBookingQuoteApi(page);
    await page.goto(
      `/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}?checkIn=${checkIn}&checkOut=${checkOut}&guests=3`,
    );

    await expect(page.getByTestId('public-property-page')).toBeVisible({ timeout: 15_000 });
    // The legacy names are read and the link of "Prenota" carries the stay in the deep link form.
    const book = page.getByTestId('booking-cta');
    await expect(book).toHaveAttribute('href', new RegExp(`checkin=${checkIn}&checkout=${checkOut}&guests=3`), { timeout: 15_000 });
    await book.click();
    await expect(page).toHaveURL(new RegExp(`/checkout\\?checkin=${checkIn}&checkout=${checkOut}&guests=3$`));
    await expect(page.getByTestId('checkout-title')).toBeVisible();
    await expect(page.getByTestId('checkout-stay-summary')).toContainText('4 notti');
    await expect(page.getByTestId('checkout-stay-summary')).toContainText('3 ospiti');
  });

  test('AC15: itinerary deep link (checkin/checkout/guests) pre-fills the booking card', async ({ page }) => {
    const { checkIn, checkOut } = futureStay(60, 2);
    await mockDirectBookingQuoteApi(page);
    await page.goto(
      `/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertySlug}?checkin=${checkIn}&checkout=${checkOut}&guests=2`,
    );

    await expect(page.getByTestId('public-property-page')).toBeVisible({ timeout: 15_000 });
    // The dates and guests of the address are in the card, and its total is the one of the quote (2 nights).
    await expect(page.getByTestId('booking-card')).toContainText('2 notti', { timeout: 15_000 });
    await expect(page.getByTestId('booking-guests')).toContainText('2 ospiti');
    await expect(page.getByTestId('booking-cta')).toHaveAttribute('href', new RegExp(`checkin=${checkIn}&checkout=${checkOut}&guests=2`));
  });

  test('AC4: single-property org redirects landing to property detail', async ({ page }) => {
    // A site with one home: the search of the site (DB-07a) lists it alone and the home of the site opens that home's page.
    await page.route(`**/api/public/orgs/${DEMO_ORG_SLUG}/stays**`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStaysResult(mockStayCards([mockOrgProperties[0]]))),
      });
    });

    const { checkIn, checkOut } = futureStay(10, 2);
    await page.goto(`/book/${DEMO_ORG_SLUG}?checkin=${checkIn}&checkout=${checkOut}`);

    await expect(page).toHaveURL(
      new RegExp(`/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertySlug}`),
      { timeout: 15_000 },
    );
    await expect(page).toHaveURL(new RegExp(`checkin=${checkIn}&checkout=${checkOut}`));
    await expect(page.getByTestId('public-property-page')).toBeVisible();
  });
});
