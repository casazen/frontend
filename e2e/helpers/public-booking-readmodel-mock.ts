import type { Page } from '@playwright/test';
import type { PublicPropertyDto } from '../../src/types';

export const PUBLIC_SEARCH_PROPERTY_ID = '11111111-1111-1111-1111-111111111111';

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
    cinCode: 'IT-12345-0123456789',
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
  await page.route('**/api/properties/search**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(results),
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
