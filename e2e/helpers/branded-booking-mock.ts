import type { Page } from '@playwright/test';
import type { PublicOrgDto, PublicPropertyDto } from '../../src/types';

export const DEMO_ORG_SLUG = 'demo-casazen';

export const mockPublicOrg: PublicOrgDto = {
  slug: DEMO_ORG_SLUG,
  displayName: 'Demo Casazen Stays',
  logoUrl: 'https://cdn.example.com/demo-logo.png',
  themeColor: '#2563eb',
  contactEmail: 'prenotazioni@demo.example',
};

export const mockOrgPropertyId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const mockOrgPropertyId2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const mockOrgPropertySlug = 'trastevere-suite';

export const mockOrgProperties: PublicPropertyDto[] = [
  {
    id: mockOrgPropertyId,
    slug: mockOrgPropertySlug,
    name: 'Trastevere Suite',
    description: 'Appartamento luminoso nel cuore di Roma.',
    city: 'Roma',
    postalCode: '00153',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    nightlyRate: 165,
    cleaningFee: 55,
    amenities: ['Wifi', 'Aria condizionata'],
    photoUrls: ['https://cdn.example.com/trastevere-suite.jpg'],
    cinCode: 'IT-12345-0123456789',
    cinStatus: 'Valid',
    timezone: 'Europe/Rome',
  },
  {
    id: mockOrgPropertyId2,
    slug: null,
    name: 'Centro Storico Loft',
    description: 'Loft nel centro storico.',
    city: 'Roma',
    postalCode: '00186',
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    nightlyRate: 120,
    cleaningFee: 40,
    amenities: ['Wifi'],
    photoUrls: [],
    cinCode: 'IT-12345-0987654321',
    cinStatus: 'Valid',
    timezone: 'Europe/Rome',
  },
];

export async function mockBrandedBookingApi(page: Page): Promise<void> {
  await page.route('**/api/public/orgs/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (method !== 'GET') {
      await route.fallback();
      return;
    }

    if (url.includes(`/properties/${mockOrgPropertyId}`) || url.includes(`/properties/${mockOrgPropertySlug}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockOrgProperties[0],
          houseRules: 'Check-in dalle 15:00.',
          cancellationPolicySummary: 'Cancellazione gratuita fino a 7 giorni prima.',
          minNights: null,
          currency: 'EUR',
        }),
      });
      return;
    }

    if (url.endsWith('/properties') || url.includes('/properties?')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockOrgProperties),
      });
      return;
    }

    if (url.includes(`/public/orgs/${DEMO_ORG_SLUG}`) || url.includes(`/public/orgs/unknown-org`)) {
      if (url.includes('unknown-org')) {
        await route.fulfill({ status: 404, body: '{}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPublicOrg),
      });
      return;
    }

    await route.fallback();
  });
}
