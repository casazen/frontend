import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { PublicStayCard, PublicStayReason } from '@/types/public-stays.types';
import { availabilityNote, cardLink, cardPrice, freeCancellationUntil } from '../house-card-model';

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

/**
 * A home that the search refuses for a rule of the nights the host set (E08/F05/US01, NF-36) says which rule on its card: until the
 * page knew the four reasons, an unknown one fell through to «busy», which is not true of a home that is free but closed.
 */
describe('availabilityNote', () => {
  const inItalian = i18n.getFixedT('it');
  const inEnglish = i18n.getFixedT('en');
  const note = (reason: string | null, t = inItalian, extra: { firstFreeCheckIn?: string | null } = {}) =>
    availabilityNote(
      { availability: { available: false, reason: reason as PublicStayReason | null, minNights: 3, ...extra }, maxGuests: 4 },
      t,
      'it',
    );

  it.each([
    ['arrival_closed', 'Arrivi chiusi in questa data'],
    ['departure_closed', 'Partenze chiuse in questa data'],
    ['max_nights', 'Soggiorno troppo lungo per queste date'],
    ['advance', 'Non prenotabile con questo anticipo'],
  ])('AvailabilityNote_%s_SaysTheRuleInPlainWordsAndNotBusy', (reason, sentence) => {
    expect(note(reason)).toBe(sentence);
    expect(note(reason)).not.toBe(inItalian('siteHome.card.busy'));
  });

  it.each([
    ['arrival_closed', 'Arrivals closed on this date'],
    ['departure_closed', 'Departures closed on this date'],
    ['max_nights', 'Stay too long for these dates'],
    ['advance', "Can't be booked this far ahead, or this close to the day"],
  ])('AvailabilityNote_%s_IsSaidInEnglishToo', (reason, sentence) => {
    expect(note(reason, inEnglish)).toBe(sentence);
  });

  it('AvailabilityNote_ReasonsThatWereThereBefore_AreSaidAsBefore', () => {
    expect(note('min_nights')).toBe('Soggiorno minimo 3 notti');
    expect(note('busy')).toBe('Non libera in queste date');
    expect(note('busy', inItalian, { firstFreeCheckIn: '2026-12-12' })).toBe('Libera dal 12 dicembre');
    expect(note('pets')).toBe('Non accetta animali');
  });

  it('AvailabilityNote_ReasonThePageDoesNotKnow_IsStillSaidAsBusy', () => {
    expect(note('a_reason_of_the_future')).toBe(inItalian('siteHome.card.busy'));
  });

  it('AvailabilityNote_HomeThatIsFree_HasNoNote', () => {
    expect(availabilityNote({ availability: { available: true }, maxGuests: 4 }, inItalian, 'it')).toBeNull();
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
