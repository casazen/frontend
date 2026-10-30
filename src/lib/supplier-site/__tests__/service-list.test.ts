import { describe, expect, it } from 'vitest';
import type { PublicSupplierService } from '@/api/public-supplier.api';
import { priceKindOf, viewOfServices } from '../service-list';

const base: PublicSupplierService = {
  slug: 'a',
  name: 'A',
  category: 'cleaning',
  priceFromCents: 4500,
  priceUnit: 'PerJob',
  pricesIncludeVat: false,
  requiresQuote: false,
  durationMinutes: 90,
  included: [],
  excluded: [],
  photoUrls: [],
  urgent: { enabled: false, surchargeCents: 0 },
};
const make = (patch: Partial<PublicSupplierService>) => ({ ...base, ...patch });

const SERVICES = [
  make({ slug: 'cleaning-job', category: 'cleaning', priceFromCents: 9000, durationMinutes: 180, nextSlotUtc: '2026-11-04T08:00:00Z' }),
  make({ slug: 'laundry-set', category: 'laundry', priceUnit: 'PerSet', priceFromCents: 600, durationMinutes: 30, nextSlotUtc: '2026-11-03T08:00:00Z' }),
  make({ slug: 'cleaning-hour', category: 'cleaning', priceUnit: 'PerHour', priceFromCents: 2200, durationMinutes: null }),
  make({ slug: 'special', category: 'cleaning', priceFromCents: null, requiresQuote: true, durationMinutes: 60 }),
];
const slugs = (list: PublicSupplierService[]) => list.map((service) => service.slug);

describe('list of services: the choices in the address', () => {
  it('priceKindOf_FixedHourlyAndQuote', () => {
    expect(priceKindOf(SERVICES[0])).toBe('fixed');
    expect(priceKindOf(SERVICES[1])).toBe('fixed');
    expect(priceKindOf(SERVICES[2])).toBe('hourly');
    expect(priceKindOf(SERVICES[3])).toBe('quote');
  });

  it('viewOfServices_NoChoices_KeepsTheOrderOfTheSupplier', () => {
    const view = viewOfServices(SERVICES);

    expect(slugs(view.list)).toEqual(['cleaning-job', 'laundry-set', 'cleaning-hour', 'special']);
    expect(view.categories).toEqual(['cleaning', 'laundry']);
    expect(view.kinds).toEqual(['fixed', 'hourly', 'quote']);
    expect(view.sort).toBe('recommended');
  });

  it('viewOfServices_CategoryAndPriceKind_Filter', () => {
    expect(slugs(viewOfServices(SERVICES, { cat: 'laundry' }).list)).toEqual(['laundry-set']);
    expect(slugs(viewOfServices(SERVICES, { cat: 'cleaning', price: 'hourly' }).list)).toEqual(['cleaning-hour']);
  });

  it('viewOfServices_UnknownValues_AreIgnoredNeverAnError', () => {
    const view = viewOfServices(SERVICES, { cat: 'gardening', price: 'free', sort: 'cheapest' });

    expect(view.list).toHaveLength(4);
    expect(view.cat).toBeNull();
    expect(view.price).toBeNull();
    expect(view.sort).toBe('recommended');
  });

  it('viewOfServices_SortByPrice_PutsTheServicesOnQuoteLast', () => {
    expect(slugs(viewOfServices(SERVICES, { sort: 'price' }).list)).toEqual(['laundry-set', 'cleaning-hour', 'cleaning-job', 'special']);
  });

  it('viewOfServices_SortByDurationAndSlot_PutsTheOnesWithoutTheValueLast', () => {
    expect(slugs(viewOfServices(SERVICES, { sort: 'duration' }).list)).toEqual(['laundry-set', 'special', 'cleaning-job', 'cleaning-hour']);
    expect(slugs(viewOfServices(SERVICES, { sort: 'slot' }).list)).toEqual(['laundry-set', 'cleaning-job', 'cleaning-hour', 'special']);
  });
});
