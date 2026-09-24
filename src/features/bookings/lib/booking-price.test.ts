import { describe, expect, it } from 'vitest';
import { bookingNights, bookingPriceBreakdown } from './booking-price';

const stay = { checkInDate: '2027-10-01T00:00:00Z', checkOutDate: '2027-10-05T00:00:00Z' };

describe('bookingPriceBreakdown', () => {
  it('bookingPriceBreakdown_BaseWithCleaningAndTax_PerNightIsLodgingOnly', () => {
    const breakdown = bookingPriceBreakdown({ ...stay, basePrice: 450, cleaningFee: 50, touristTax: 12, totalPrice: 462 });

    expect(breakdown).toEqual({ nights: 4, lodging: 400, perNight: 100, cleaningFee: 50, touristTax: 12, total: 462 });
  });

  it('bookingPriceBreakdown_OldBookingWithoutCleaningFee_IsBasePriceOverNights', () => {
    expect(bookingPriceBreakdown({ ...stay, basePrice: 450, totalPrice: 450 })?.perNight).toBe(112.5);
  });

  it('bookingPriceBreakdown_NoBasePrice_ReturnsNullInsteadOfDividingTheTotal', () => {
    expect(bookingPriceBreakdown({ ...stay, basePrice: 0, totalPrice: 300 })).toBeNull();
  });

  it('bookingNights_DatesAtMidnightUtc_CountsCalendarNights', () => {
    expect(bookingNights(stay)).toBe(4);
    expect(bookingNights({ checkInDate: '2027-10-05T00:00:00Z', checkOutDate: '2027-10-01T00:00:00Z' })).toBe(0);
  });
});
