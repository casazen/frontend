import { describe, expect, it } from 'vitest';
import type { PublicSupplierServiceDetail } from '@/api/public-supplier.api';
import { defaultSelection, maxUnits, surfaceChoices, toBookingParams, toQuoteBody } from '../service-options';

const SERVICE: PublicSupplierServiceDetail = {
  slug: 'pulizia-standard',
  name: 'Pulizia standard',
  category: 'cleaning',
  priceFromCents: 4500,
  priceUnit: 'PerJob',
  pricesIncludeVat: false,
  requiresQuote: false,
  durationMinutes: 150,
  included: [],
  excluded: [],
  photoUrls: [],
  urgent: { enabled: false, surchargeCents: 0 },
  supplements: [
    { code: 'finestre', label: 'Finestre', amountCents: 1500, per: 'flat' },
    { code: 'bagno', label: 'Bagno in più', amountCents: 800, per: 'bathroom', max: 3 },
    { code: 'set', label: 'Set biancheria', amountCents: 600, per: 'set' },
    { code: 'ora', label: 'Ora in più', amountCents: 2000, per: 'hour', max: 4 },
    { code: 'mq', label: 'Ogni 30 m²', amountCents: 1000, per: 'sqm30', max: 3, includedSqm: 60 },
  ],
};

describe('service options: what is picked on the card of a service', () => {
  it('defaultSelection_PerJobWithSurfaceSupplement_StartsFromWhatThePriceCovers', () => {
    expect(defaultSelection(SERVICE)).toEqual({ quantity: null, surface: 60, options: {}, comune: null });
  });

  it('defaultSelection_PerHour_StartsFromTheDurationInWholeHours', () => {
    expect(defaultSelection({ ...SERVICE, priceUnit: 'PerHour', supplements: [] }).quantity).toBe(3);
    expect(defaultSelection({ ...SERVICE, priceUnit: 'PerHour', durationMinutes: null, supplements: [] }).quantity).toBe(1);
  });

  it('defaultSelection_PerSetAndPerSquareMeter_StartFromTheirOwnUnits', () => {
    expect(defaultSelection({ ...SERVICE, priceUnit: 'PerSet', supplements: [] })).toMatchObject({ quantity: 1, surface: null });
    expect(defaultSelection({ ...SERVICE, priceUnit: 'PerSquareMeter', supplements: [] })).toMatchObject({ quantity: 60, surface: null });
  });

  it('toQuoteBody_EverySupplementKind_IsNamedWithItsUnitsAndTheSurfaceFollowsTheSurface', () => {
    const body = toQuoteBody(SERVICE, {
      quantity: null,
      surface: 90,
      options: { finestre: 1, bagno: 2, set: 0, ora: 3 },
      comune: '058091',
    });

    // The `sqm30` supplement is never picked: it follows `surfaceSqm`. A supplement with no units is not sent.
    expect(body).toEqual({
      service: 'pulizia-standard',
      surfaceSqm: 90,
      options: [
        { code: 'finestre', quantity: 1 },
        { code: 'bagno', quantity: 2 },
        { code: 'ora', quantity: 3 },
      ],
      comune: '058091',
    });
  });

  it('toQuoteBody_NothingPicked_IsJustTheService', () => {
    expect(toQuoteBody({ ...SERVICE, supplements: [] }, defaultSelection({ ...SERVICE, supplements: [] }))).toEqual({
      service: 'pulizia-standard',
    });
  });

  it('toBookingParams_SameChoices_GoToTheBookingWithTheNamesOfTheContract', () => {
    expect(toBookingParams(SERVICE, { quantity: 2, surface: 90, options: { bagno: 1 }, comune: null })).toEqual({
      service: 'pulizia-standard',
      quantity: 2,
      surface: 90,
      options: [{ code: 'bagno', quantity: 1 }],
    });
  });

  it('maxUnits_AndSurfaceChoices_FollowTheLimitsOfTheSupplement', () => {
    expect(maxUnits(SERVICE.supplements[0])).toBe(1);
    expect(maxUnits(SERVICE.supplements[1])).toBe(3);
    expect(maxUnits(SERVICE.supplements[2])).toBe(8);
    expect(surfaceChoices(SERVICE.supplements[4])).toEqual([60, 90, 120, 150]);
  });
});
