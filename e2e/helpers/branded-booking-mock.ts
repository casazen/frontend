import type { Page } from '@playwright/test';
import type { PublicCalendarDto, PublicOrgDto, PublicPropertyDto } from '../../src/types';
import type { PublicStayCard, PublicStaysResult } from '../../src/types/public-stays.types';
import { addDays, todayInRome } from '../../src/lib/stay-dates';

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
    cinCode: 'IT058091C27G5FFZDZ',
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
    cinCode: 'IT048017B42742QNBZ',
    cinStatus: 'Valid',
    timezone: 'Europe/Rome',
  },
];

/** The homes above as the search of the site (`GET …/stays`) lists them: the night price, free for any stay, no total. */
export function mockStayCards(properties: PublicPropertyDto[] = mockOrgProperties): PublicStayCard[] {
  return properties.map((property) => ({
    id: property.id,
    slug: property.slug ?? null,
    name: property.name,
    comune: property.city,
    latitude: 41.89,
    longitude: 12.48,
    photos: property.photoUrls,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    maxGuests: property.maxGuests,
    amenities: [],
    tags: [],
    availability: { available: true },
    price: { currency: 'EUR', perNightCents: property.nightlyRate * 100 },
  }));
}

export function mockStaysResult(cards: PublicStayCard[] = mockStayCards()): PublicStaysResult {
  return {
    currency: 'EUR',
    adults: 2,
    children: 0,
    pets: false,
    totalCount: cards.length,
    availableCount: cards.length,
    page: 1,
    pageSize: 50,
    items: cards,
    alternatives: [],
    unsupportedFilters: [],
    generatedAt: new Date().toISOString(),
  };
}

/** The nights of the whole site for the next four months, all free: the «Quando» field of the home has something to draw. */
function mockSiteCalendar() {
  const day = 24 * 60 * 60 * 1000;
  const today = new Date();
  const iso = (offset: number) => new Date(today.getTime() + offset * day).toISOString().slice(0, 10);
  return {
    from: iso(0),
    to: iso(120),
    today: iso(0),
    currency: 'EUR',
    adults: 2,
    children: 0,
    days: Array.from({ length: 120 }, (_, offset) => ({ date: iso(offset), anyAvailable: true, fromPriceCents: 12000, minNights: 1 })),
    generatedAt: today.toISOString(),
  };
}

/** The public calendar of a property (DB-03b): a year of free nights from today, every night at the rate of the home. */
export function mockPublicCalendar(propertyId: string = mockOrgPropertyId, nightlyRate: number = 165): PublicCalendarDto {
  const today = todayInRome();
  return {
    propertyId,
    startDate: today,
    endDate: addDays(today, 400),
    today,
    currency: 'EUR',
    generatedAt: new Date().toISOString(),
    days: Array.from({ length: 400 }, (_, offset) => ({
      date: addDays(today, offset),
      available: true,
      nightlyPriceCents: nightlyRate * 100,
      minNights: 1,
    })),
  };
}

export async function mockBrandedBookingApi(page: Page): Promise<void> {
  // Without it the demo server answers with index.html and the widget cannot read booked dates.
  await page.route('**/api/public/bookings/property/*/availability*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ propertyId: mockOrgPropertyId, startDate: '', endDate: '', bookedDates: [] }),
    });
  });

  await page.route('**/api/public/orgs/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (method !== 'GET') {
      await route.fallback();
      return;
    }

    // The calendar comes before the property: its address starts with the one of the property.
    if (url.includes('/calendar')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPublicCalendar()),
      });
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

    // The search of the site (DB-07a): the home and the results read the homes, the places and the nights of the site from here.
    const path = new URL(url).pathname;
    if (path.endsWith('/stays')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockStaysResult()) });
      return;
    }
    if (path.endsWith('/destinations')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'roma', label: 'Roma', comune: 'Roma', count: 2 }]),
      });
      return;
    }
    if (path === `/api/public/orgs/${DEMO_ORG_SLUG}/calendar`) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSiteCalendar()) });
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
