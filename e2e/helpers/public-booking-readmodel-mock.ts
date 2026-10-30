import type { Page } from '@playwright/test';
import type { PublicPropertyDto } from '../../src/types';
import type { PublicStayCard, PublicStaysResult } from '../../src/types/public-stays.types';

export const PUBLIC_SEARCH_PROPERTY_ID = '11111111-1111-1111-1111-111111111111';

/** The homes as the public search across all the sites lists them (`GET /api/public/stays`): free, each with its site and host. */
function platformStaysResult(results: PublicPropertyDto[]): PublicStaysResult {
  const items: PublicStayCard[] = results.map((property) => ({
    id: property.id,
    slug: property.slug ?? null,
    name: property.name,
    comune: property.city,
    latitude: 41.9,
    longitude: 12.5,
    photos: property.photoUrls,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    maxGuests: property.maxGuests,
    amenities: [],
    tags: [],
    availability: { available: true },
    price: { currency: 'EUR', perNightCents: Math.round(property.nightlyRate * 100) },
    orgSlug: 'demo-casazen',
    hostName: 'Demo Casazen Stays',
    country: 'IT',
  }));
  return {
    currency: 'EUR',
    adults: 2,
    children: 0,
    pets: false,
    totalCount: items.length,
    availableCount: items.length,
    page: 1,
    pageSize: 24,
    items,
    alternatives: [],
    unsupportedFilters: [],
    generatedAt: new Date().toISOString(),
    facets: { maxGuests: 4, petsAllowed: true, tags: [], currency: 'EUR' },
  };
}

export const mockPublicSearchResults: PublicPropertyDto[] = [
  {
    id: PUBLIC_SEARCH_PROPERTY_ID,
    name: 'Trastevere Loft',
    description: 'Bright apartment in the heart of Rome.',
    city: 'Rome',
    postalCode: '00153',
    latitude: 41.889,
    longitude: 12.469,
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    nightlyRate: 145,
    cleaningFee: 50,
    amenities: ['Wifi', 'Parking'],
    photoUrls: ['https://cdn.example.com/trastevere.jpg'],
    cinCode: 'IT058091C27G5FFZDZ',
    cinStatus: 'Valid',
    timezone: 'Europe/Rome',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Duomo View',
    description: 'Steps from the cathedral.',
    city: 'Milan',
    postalCode: '20121',
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    nightlyRate: 120,
    cleaningFee: 40,
    amenities: ['Wifi'],
    photoUrls: [],
    cinCode: null,
    cinStatus: 'Missing',
    timezone: 'Europe/Rome',
  },
];

/**
 * Mocks anonymous public booking read endpoints (#212).
 */
export async function mockPublicBookingReadApi(
  page: Page,
  results: PublicPropertyDto[] = mockPublicSearchResults,
): Promise<void> {
  await page.route('**/api/public/stays**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/destinations')
      ? []
      : path.endsWith('/calendar')
        ? { from: '2027-01-01', to: '2027-02-01', today: '2027-01-01', currency: 'EUR', adults: 2, children: 0, days: [], generatedAt: '2027-01-01T00:00:00Z' }
        : platformStaysResult(results);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  await page.route('**/api/properties/*/public', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const match = route.request().url().match(/\/api\/properties\/([^/]+)\/public/);
    const id = match?.[1];
    const property = results.find((p) => p.id === id);

    if (!property) {
      await route.fulfill({ status: 404, body: JSON.stringify({ title: 'Not Found' }) });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...property,
        houseRules: 'No parties.',
        cancellationPolicySummary: 'Free cancellation up to 7 days before check-in.',
        minNights: null,
        currency: 'EUR',
      }),
    });
  });
}
