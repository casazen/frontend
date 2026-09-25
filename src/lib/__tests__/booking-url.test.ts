import { describe, expect, it } from 'vitest';
import {
  buildBookingQuery,
  buildPropertyCheckoutUrl,
  buildPropertyPageUrl,
  isPropertyPublishable,
  mergeBookingSearchParams,
  parseBookingSearchParams,
  type BookingSearchParams,
} from '@/lib/booking-url';

const property = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', slug: 'trastevere-suite' };
const stay: BookingSearchParams = { checkIn: '2026-10-01', checkOut: '2026-10-04', guests: 3, children: 0 };

/** Query of a relative URL as the checkout page reads it. */
function queryOf(url: string): URLSearchParams {
  return new URL(url, 'https://example.test').searchParams;
}

describe('isPropertyPublishable', () => {
  it('isPropertyPublishable_ActiveNotPausedAndCompliant_IsTrue', () => {
    expect(isPropertyPublishable({ isActive: true, isPaused: false, complianceStatus: 'Active' })).toBe(true);
  });

  // A2-05: pausing hides the property from the direct-booking site, mirroring the backend's PublicListing.IsPublished.
  it('isPropertyPublishable_Paused_IsFalseEvenWhenActiveAndCompliant', () => {
    expect(isPropertyPublishable({ isActive: true, isPaused: true, complianceStatus: 'Active' })).toBe(false);
  });

  it('isPropertyPublishable_Inactive_IsFalse', () => {
    expect(isPropertyPublishable({ isActive: false, isPaused: false, complianceStatus: 'Active' })).toBe(false);
  });

  it('isPropertyPublishable_ComplianceNotActive_IsFalse', () => {
    expect(isPropertyPublishable({ isActive: true, isPaused: false, complianceStatus: 'Pending' })).toBe(false);
  });
});

describe('buildPropertyCheckoutUrl', () => {
  it('buildPropertyCheckoutUrl_WidgetStay_HasOneQuestionMarkAndContractParams', () => {
    const url = buildPropertyCheckoutUrl('demo-casazen', property, stay);

    expect(url).toBe('/book/demo-casazen/property/trastevere-suite/checkout?checkin=2026-10-01&checkout=2026-10-04&guests=3');
    expect(url).not.toContain('??');
    expect(url.split('?')).toHaveLength(2);
    expect([...queryOf(url).keys()]).toEqual(['checkin', 'checkout', 'guests']);
  });

  it('buildPropertyCheckoutUrl_ReadBackByCheckout_KeepsDatesAndGuests', () => {
    const url = buildPropertyCheckoutUrl('demo-casazen', property, { ...stay, guests: 5, children: 2 });

    expect(parseBookingSearchParams(queryOf(url))).toEqual({
      checkIn: '2026-10-01',
      checkOut: '2026-10-04',
      guests: 5,
      children: 2,
    });
  });

  it('buildPropertyCheckoutUrl_DefaultGuests_WritesGuestsExplicitly', () => {
    const url = buildPropertyCheckoutUrl('demo-casazen', property, { ...stay, guests: 2 });

    expect(queryOf(url).get('guests')).toBe('2');
  });

  it('buildPropertyCheckoutUrl_PropertyWithoutSlug_UsesId', () => {
    const url = buildPropertyCheckoutUrl('demo-casazen', { id: property.id, slug: null }, stay);

    expect(url.startsWith(`/book/demo-casazen/property/${property.id}/checkout?`)).toBe(true);
  });
});

describe('buildPropertyPageUrl', () => {
  it('buildPropertyPageUrl_NoDates_CarriesOnlyGuests', () => {
    const url = buildPropertyPageUrl('demo-casazen', property, { checkIn: '', checkOut: '', guests: 2, children: 0 });

    expect(url).toBe('/book/demo-casazen/property/trastevere-suite?guests=2');
  });
});

describe('buildBookingQuery', () => {
  it('buildBookingQuery_InvalidCounts_WritesSaneValues', () => {
    const query = buildBookingQuery({ checkIn: '', checkOut: '', guests: Number.NaN, children: 7 });

    expect(query.toString()).toBe('guests=2&children=1');
  });
});

describe('parseBookingSearchParams', () => {
  it('parseBookingSearchParams_ContractForm_ReadsDatesAndGuests', () => {
    const params = parseBookingSearchParams(new URLSearchParams('checkin=2026-10-01&checkout=2026-10-04&guests=4'));

    expect(params).toEqual({ checkIn: '2026-10-01', checkOut: '2026-10-04', guests: 4, children: 0 });
  });

  it('parseBookingSearchParams_LegacyCamelCase_ReadsDates', () => {
    const params = parseBookingSearchParams(new URLSearchParams('checkIn=2026-10-01&checkOut=2026-10-04&guests=3'));

    expect(params).toEqual({ checkIn: '2026-10-01', checkOut: '2026-10-04', guests: 3, children: 0 });
  });

  it('parseBookingSearchParams_BothForms_PrefersContractForm', () => {
    const params = parseBookingSearchParams(
      new URLSearchParams('checkIn=2026-10-01&checkin=2026-11-01&checkOut=2026-10-04&checkout=2026-11-03'),
    );

    expect(params.checkIn).toBe('2026-11-01');
    expect(params.checkOut).toBe('2026-11-03');
  });

  it('parseBookingSearchParams_DoubleQuestionMarkUrl_DoesNotReadCheckIn', () => {
    // The old widget produced `/checkout??checkIn=…`: the first key became "?checkIn".
    const params = parseBookingSearchParams(new URLSearchParams('??checkIn=2026-10-01&checkOut=2026-10-04'));

    expect(params.checkIn).toBe('');
  });

  it('parseBookingSearchParams_InvalidValues_FallsBackToDefaults', () => {
    const params = parseBookingSearchParams(
      new URLSearchParams('checkin=2026-02-30&checkout=tomorrow&guests=abc&children=-1'),
    );

    expect(params).toEqual({ checkIn: '', checkOut: '', guests: 2, children: 0 });
  });

  it('parseBookingSearchParams_ChildrenNotLessThanGuests_KeepsOneAdult', () => {
    const params = parseBookingSearchParams(new URLSearchParams('guests=3&children=5'));

    expect(params.guests).toBe(3);
    expect(params.children).toBe(2);
  });

  it('parseBookingSearchParams_ZeroGuests_ReadsOneGuest', () => {
    expect(parseBookingSearchParams(new URLSearchParams('guests=0')).guests).toBe(1);
  });
});

describe('mergeBookingSearchParams', () => {
  it('mergeBookingSearchParams_LegacyLink_RewritesContractFormAndKeepsOtherParams', () => {
    const current = new URLSearchParams('utm_source=google&checkIn=2026-10-01&checkOut=2026-10-04&guests=3');

    const merged = mergeBookingSearchParams(current, { checkOut: '2026-10-06' });

    expect(merged.get('utm_source')).toBe('google');
    expect(merged.get('checkin')).toBe('2026-10-01');
    expect(merged.get('checkout')).toBe('2026-10-06');
    expect(merged.get('guests')).toBe('3');
    expect(merged.has('checkIn')).toBe(false);
    expect(merged.has('checkOut')).toBe(false);
  });

  it('mergeBookingSearchParams_EmptyDate_RemovesIt', () => {
    const merged = mergeBookingSearchParams(new URLSearchParams('checkin=2026-10-01&checkout=2026-10-04'), { checkIn: '' });

    expect(merged.has('checkin')).toBe(false);
    expect(merged.get('checkout')).toBe('2026-10-04');
  });
});
