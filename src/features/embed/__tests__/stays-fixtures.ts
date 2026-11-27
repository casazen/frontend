import type { PublicDestination, PublicSiteCalendar, PublicStayCard, PublicStaysResult } from '@/types/public-stays.types';

export const ORG_SLUG = 'villa-rossi';

export function stayCard(index: number, overrides: Partial<PublicStayCard> = {}): PublicStayCard {
  const id = `home-${String(index).padStart(3, '0')}`;
  return {
    id,
    slug: `casa-${String(index).padStart(3, '0')}`,
    name: `Casa ${String(index).padStart(3, '0')}`,
    comune: 'Lugano',
    latitude: 46.0 + index / 1000,
    longitude: 8.95 + index / 1000,
    photos: [],
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    areaSqm: 60,
    amenities: [],
    tags: [],
    availability: { available: true },
    price: { currency: 'EUR', perNightCents: 14500, totalCents: null },
    ...overrides,
  };
}

export function staysResult(items: PublicStayCard[], overrides: Partial<PublicStaysResult> = {}): PublicStaysResult {
  const free = items.filter((card) => card.availability.available);
  return {
    currency: 'EUR',
    checkIn: null,
    checkOut: null,
    nights: null,
    adults: 2,
    children: 0,
    pets: false,
    totalCount: items.length,
    availableCount: free.length,
    page: 1,
    pageSize: items.length,
    items,
    alternatives: [],
    unsupportedFilters: [],
    generatedAt: '2026-11-20T08:00:00Z',
    ...overrides,
  };
}

export const DESTINATIONS: PublicDestination[] = [
  { id: 'lugano', label: 'Lugano', comune: 'Lugano', count: 5 },
  { id: 'locarno', label: 'Locarno', comune: 'Locarno', count: 2 },
];

export function siteCalendar(today = '2026-11-20'): PublicSiteCalendar {
  return { from: today, to: '2027-12-01', today, currency: 'EUR', adults: 2, children: 0, days: [], generatedAt: `${today}T08:00:00Z` };
}
