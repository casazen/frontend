import { describe, expect, it } from 'vitest';
import type { PublicStayCard } from '@/types/public-stays.types';
import { cardLink, cardPrice, freeCancellationUntil } from '../house-card-model';

type PriceCard = Pick<PublicStayCard, 'price'>;

const priced = (price: PublicStayCard['price']): PriceCard => ({ price });

describe('cardPrice (DB-07b, DB-07c): the page shows the price of the server and adds up nothing', () => {
  it('CardPrice_WithDatesAndATotal_GivesTheTotalOfTheQuoteUntouched', () => {
    // 4 nights at an average of 145.00 would be 580.00 if the page added them up: the quote also has the cleaning and the tax.
    const price = cardPrice(priced({ currency: 'EUR', perNightCents: 14500, totalCents: 66420, includesTouristTax: 'exact' }), 4);

    expect(price).toEqual({ kind: 'total', totalCents: 66420, perNightCents: 14500, nights: 4, tax: 'exact' });
  });

  it('CardPrice_WithoutDates_GivesTheNightPriceOnly', () => {
    expect(cardPrice(priced({ currency: 'EUR', perNightCents: 12000 }), null)).toEqual({ kind: 'from', perNightCents: 12000 });
  });

  it('CardPrice_DatesButNoTotal_FallsBackToTheNightPriceNeverToAGuess', () => {
    // A home the quote would refuse (too many guests, shorter than the minimum) has no total: its card does not invent one.
    expect(cardPrice(priced({ currency: 'EUR', perNightCents: 12000, totalCents: null }), 3)).toEqual({ kind: 'from', perNightCents: 12000 });
  });

  it('CardPrice_TouristTaxNotKnown_IsSaidAsNotIncluded', () => {
    const price = cardPrice(priced({ currency: 'EUR', perNightCents: 9000, totalCents: 30000 }), 3);

    expect(price).toMatchObject({ kind: 'total', tax: 'notIncluded' });
  });
});

describe('freeCancellationUntil (DB-07c): a date is a promise only when the guest can use it', () => {
  it('FreeCancellationUntil_SelfServiceAndADate_GivesTheDate', () => {
    expect(freeCancellationUntil({ cancellation: { fullRefundUntil: '2027-06-20', selfServiceAvailable: true } })).toBe('2027-06-20');
  });

  it('FreeCancellationUntil_GuestCannotCancelByThemselves_GivesNothing', () => {
    expect(freeCancellationUntil({ cancellation: { fullRefundUntil: '2027-06-20', selfServiceAvailable: false } })).toBeNull();
  });

  it('FreeCancellationUntil_NoFullRefundWindow_GivesNothing', () => {
    expect(freeCancellationUntil({ cancellation: { fullRefundUntil: null, selfServiceAvailable: true } })).toBeNull();
    expect(freeCancellationUntil({ cancellation: null })).toBeNull();
  });
});

describe('cardLink', () => {
  it('CardLink_WithDates_CarriesTheStayToThePageOfTheHome', () => {
    const stay = { checkIn: '2027-07-01', checkOut: '2027-07-05', adults: 2, children: 1, pets: false };

    expect(cardLink('villa-mare', { id: 'p-1', slug: 'casa-del-faro' }, stay)).toBe(
      '/book/villa-mare/property/casa-del-faro?checkin=2027-07-01&checkout=2027-07-05&guests=3&children=1',
    );
  });

  it('CardLink_WithoutDates_IsThePlainPage', () => {
    const stay = { checkIn: '', checkOut: '', adults: 2, children: 0, pets: false };

    expect(cardLink('villa-mare', { id: 'p-1', slug: null }, stay)).toBe('/book/villa-mare/property/p-1');
  });
});
