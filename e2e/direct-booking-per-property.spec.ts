/**
 * E2E tests for Per-Property Direct Booking (#341)
 *
 * AC12: Vetrina page shows a master-detail layout with property list on the left
 *       and a preview iframe on the right.
 * AC13: Property URL uses slug when available, falls back to ID.
 * AC14: Navigating to /book/:orgSlug/property/:slug resolves the property correctly.
 */
import { test, expect } from './test';
import {
  DEMO_ORG_SLUG,
  mockBrandedBookingApi,
  mockOrgProperties,
  mockOrgPropertyId,
  mockOrgPropertySlug,
  mockPublicOrg,
} from './helpers/branded-booking-mock';
import { mockCurrentUserWithOrg } from './helpers/org-api-mock';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import type { Property } from '../src/types';

const DEMO_ORG_SLUG_VETRINA = 'acme-stays';

function buildVetrinaProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: mockOrgPropertyId,
    name: 'Trastevere Suite',
    description: 'Appartamento luminoso nel cuore di Roma.',
    address: 'Via Trastevere 1',
    city: 'Roma',
    country: 'IT',
    postalCode: '00153',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    nightlyRate: 165,
    cleaningFee: 55,
    damageDeposit: 0,
    currency: 'EUR',
    amenities: ['WiFi'],
    photoUrls: [],
    houseRules: '',
    cinCode: 'IT-12345-0123456789',
    timezone: 'Europe/Rome',
    cancellationPolicyId: null,
    isActive: true,
    complianceStatus: 'Active',
    slug: mockOrgPropertySlug,
    ownerId: 'owner-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

test.describe('AC12: Vetrina master-detail layout (#341)', () => {
  test.beforeEach(async ({ page }) => {
    await mockCurrentUserWithOrg(page, { slug: DEMO_ORG_SLUG_VETRINA });
    await mockPropertiesApi(page, [buildVetrinaProperty()]);
    await page.addInitScript(() => {
      localStorage.setItem('casazen.locale', 'it');
    });
  });

  test('vetrina page renders property list panel', async ({ page }) => {
    await page.goto('/app/short-rent/settings/direct-booking');

    await expect(page.getByTestId('vetrina-property-list')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Trastevere Suite')).toBeVisible();
  });

  test('selecting a property shows the preview iframe for that property', async ({ page }) => {
    await page.goto('/app/short-rent/settings/direct-booking');

    await expect(page.getByTestId('vetrina-property-list')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('vetrina-property-row').first().click();

    const preview = page.getByTestId('vetrina-preview-panel');
    await expect(preview).toBeVisible();

    const iframe = preview.locator('iframe');
    await expect(iframe).toHaveAttribute('src', new RegExp(`/book/${DEMO_ORG_SLUG_VETRINA}/property/${mockOrgPropertySlug}`));
  });

  test('published badge appears on active+compliant property', async ({ page }) => {
    await page.goto('/app/short-rent/settings/direct-booking');

    await expect(page.getByTestId('vetrina-property-list')).toBeVisible({ timeout: 15_000 });

    const badge = page.getByTestId('property-publish-badge').first();
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/Pubblicata/i);
  });

  test('copy URL button copies property booking URL to clipboard', async ({ page }) => {
    await page.goto('/app/short-rent/settings/direct-booking');
    await expect(page.getByTestId('vetrina-property-list')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('vetrina-property-copy-url').first().click();

    await expect(page.getByText(/copiato/i)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('AC13: Property URL uses slug when available (#341)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBrandedBookingApi(page);
    await page.addInitScript(() => {
      localStorage.removeItem('casazen_cookie_consent');
      localStorage.setItem('casazen.locale', 'it');
    });
  });

  test('org landing navigates to slug-based URL when property has a slug', async ({ page }) => {
    await page.route(`**/api/public/orgs/${DEMO_ORG_SLUG}/properties`, async (route) => {
      if (route.request().method() !== 'GET') { await route.fallback(); return; }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockOrgProperties[0]]),
      });
    });

    await page.goto(`/book/${DEMO_ORG_SLUG}`);

    await expect(page).toHaveURL(
      new RegExp(`/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertySlug}`),
      { timeout: 15_000 },
    );
  });

  test('org landing navigates to ID-based URL for property without slug', async ({ page }) => {
    const noSlugProperty = { ...mockOrgProperties[1], slug: null };

    await page.route(`**/api/public/orgs/${DEMO_ORG_SLUG}/properties`, async (route) => {
      if (route.request().method() !== 'GET') { await route.fallback(); return; }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([noSlugProperty]),
      });
    });

    await page.goto(`/book/${DEMO_ORG_SLUG}`);

    await expect(page).toHaveURL(
      new RegExp(`/book/${DEMO_ORG_SLUG}/property/${noSlugProperty.id}`),
      { timeout: 15_000 },
    );
  });
});

test.describe('AC14: Slug-based property URL resolves correctly (#341)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBrandedBookingApi(page);
    await page.addInitScript(() => {
      localStorage.removeItem('casazen_cookie_consent');
      localStorage.setItem('casazen.locale', 'it');
    });
  });

  test('navigating to /book/:orgSlug/property/:slug renders the property page', async ({ page }) => {
    await page.goto(`/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertySlug}`);

    await expect(page.getByTestId('public-property-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: mockPublicOrg.displayName })).not.toBeAttached();
    await expect(page.getByRole('heading', { name: 'Trastevere Suite' })).toBeVisible();
  });

  test('checkout navigates with slug in the URL', async ({ page }) => {
    await page.goto(`/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertySlug}`);

    await expect(page.getByTestId('public-property-page')).toBeVisible({ timeout: 15_000 });
    await page.locator('#check-in').fill('2026-07-01');
    await page.locator('#check-out').fill('2026-07-04');
    await page.getByRole('button', { name: 'Procedi al checkout' }).click();

    await expect(page).toHaveURL(new RegExp(`/property/${mockOrgPropertySlug}/checkout`));
    await expect(page.getByTestId('direct-checkout-page')).toBeVisible();
  });
});
