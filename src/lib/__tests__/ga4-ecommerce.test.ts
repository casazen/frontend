import { describe, expect, it } from 'vitest';
import { buildEmbedMessage, parseEmbedMessage } from '@/embed/protocol';
import { beginCheckoutEvent, ga4Item, purchaseEvent, searchEvent, viewItemEvent, viewItemListEvent } from '@/lib/ga4-ecommerce';

/**
 * The GA4 payloads of the booking funnel (E41/F01/US01/T02, NF-144, NF-145, NF-149). They hold two things that cost something when they are wrong:
 * money (the amount of a home in the currency of that home, in major units, to the cent, never converted) and privacy (an item says which home and
 * where, never who: a page that frames the widget, and every script on it, reads these payloads).
 */
const ALLOWED_ITEM_KEYS = ['item_id', 'item_name', 'item_category', 'item_list_id', 'item_list_name', 'index', 'price', 'quantity'];

function card(position: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `property-${position}`,
    name: `Casa ${position}`,
    comune: 'Lugano',
    price: { currency: 'CHF', perNightCents: 24000, totalCents: 96050 },
    ...overrides,
  };
}

describe('ga4Item', () => {
  it('ga4Item_AHome_CarriesTheIdTheNameThePlaceThePriceTheQuantityTheIndexAndTheList', () => {
    expect(ga4Item({ id: 'p1', name: 'Casa Mare', place: ' Lugano ', price: 1234.5, index: 3, listId: 'search_results', listName: 'Risultati' })).toEqual({
      item_id: 'p1',
      item_name: 'Casa Mare',
      item_category: 'Lugano',
      item_list_id: 'search_results',
      item_list_name: 'Risultati',
      index: 3,
      price: 1234.5,
      quantity: 1,
    });
  });

  it('ga4Item_WithNothingButTheIdAndTheName_LeavesTheRestOut', () => {
    expect(ga4Item({ id: 'p1', name: 'Casa Mare' })).toEqual({ item_id: 'p1', item_name: 'Casa Mare', quantity: 1 });
    expect(ga4Item({ id: 'p1', name: 'Casa Mare', place: '  ', price: Number.NaN })).toEqual({ item_id: 'p1', item_name: 'Casa Mare', quantity: 1 });
  });

  it.each([
    [1234.567, 1234.57],
    [0.1 + 0.2, 0.3],
    [1.005, 1.01],
    [99, 99],
    [0, 0],
  ])('ga4Item_Price_%d_IsKeptToTwoDecimals_%d', (price, expected) => {
    expect(ga4Item({ id: 'p1', name: 'Casa', price }).price).toBe(expected);
  });
});

describe('viewItemListEvent', () => {
  const LIST = { listId: 'search_results', listName: 'Risultati di ricerca' };

  it('viewItemListEvent_TwoHomes_AreTheListWithTheirPositionAndThePriceOfTheStayInMajorUnits', () => {
    const event = viewItemListEvent([card(0), card(1, { price: { currency: 'CHF', perNightCents: 100, totalCents: 12345 } })], LIST);

    expect(event).toEqual({
      item_list_id: 'search_results',
      item_list_name: 'Risultati di ricerca',
      currency: 'CHF',
      items: [
        { item_id: 'property-0', item_name: 'Casa 0', item_category: 'Lugano', item_list_id: 'search_results', item_list_name: 'Risultati di ricerca', index: 0, price: 960.5, quantity: 1 },
        { item_id: 'property-1', item_name: 'Casa 1', item_category: 'Lugano', item_list_id: 'search_results', item_list_name: 'Risultati di ricerca', index: 1, price: 123.45, quantity: 1 },
      ],
    });
  });

  it('viewItemListEvent_MoreThan20Homes_ReportsTheFirst20', () => {
    const cards = Array.from({ length: 200 }, (_, position) => card(position));

    const event = viewItemListEvent(cards, LIST);

    expect(event.items).toHaveLength(20);
    expect(event.items.map((item) => item.index)).toEqual(Array.from({ length: 20 }, (_, position) => position));
    expect(event.items[19].item_id).toBe('property-19');
  });

  /** A home as a site really has it: the id is a UUID and the name is a name, not «Casa 0». */
  const realHome = (position: number, overrides: Record<string, unknown> = {}) =>
    card(position, { id: `6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a${10 + position}`, name: `Appartamento Vista Lago ${position}`, ...overrides });

  it('viewItemListEvent_TwentyHomesOfASite_FitTheMessageOfTheProtocolOrAreCutFromTheEnd', () => {
    // 20 homes with a UUID, a name, a place, a price and the list on each of them are about 4.6 KB; the `params` of an event are at most 4 KB, and a message
    // the protocol refuses is never posted: the page would hear nothing of the list. 17 homes are 3939 bytes, 18 are 4166.
    const cards = Array.from({ length: 20 }, (_, position) => realHome(position));

    const event = viewItemListEvent(cards, LIST);

    const message = parseEmbedMessage(buildEmbedMessage('event', { name: 'view_item_list', params: { ...event } }));
    expect(message).toEqual(buildEmbedMessage('event', { name: 'view_item_list', params: { ...event } }));
    expect(new TextEncoder().encode(JSON.stringify(event)).length).toBeLessThanOrEqual(4096);
    // The first ones, in their order and with their position, as many as fit and not one fewer.
    expect(event.items).toHaveLength(17);
    expect(event.items.map((item) => item.item_id)).toEqual(cards.slice(0, 17).map((home) => home.id));
    expect(event.items.map((item) => item.index)).toEqual(Array.from({ length: 17 }, (_, position) => position));
    expect(event.currency).toBe('CHF');
    expect(event.items.every((item) => item.price === 960.5)).toBe(true);
  });

  it('viewItemListEvent_ForThePageItself_KeepsTheFirst20HomesWhateverTheirSize', () => {
    // The `dataLayer` of an agency's own page is no message of the protocol: the 4 KB of the widgets do not apply, and the 20 homes of a site (about 4.6 KB) all go.
    const cards = Array.from({ length: 25 }, (_, position) => realHome(position));

    const event = viewItemListEvent(cards, LIST, { asEmbedMessage: false });

    expect(event.items).toHaveLength(20);
    expect(event.items.map((item) => item.item_id)).toEqual(cards.slice(0, 20).map((home) => home.id));
    expect(event.items.map((item) => item.index)).toEqual(Array.from({ length: 20 }, (_, position) => position));
    expect(event.currency).toBe('CHF');
    expect(event.items.every((item) => item.price === 960.5)).toBe(true);
  });

  it('viewItemListEvent_ShortHomesStillAllFit_AndSoDoesAListOfTwenty', () => {
    const cards = Array.from({ length: 20 }, (_, position) => card(position));

    expect(viewItemListEvent(cards, LIST).items).toHaveLength(20);
  });

  it('viewItemListEvent_TheHomesCutFromTheEnd_AreNotCountedForTheCurrencyOfTheOnesThatStay', () => {
    // 19 homes in francs and the last one in euros: all 20 together are one currency too many (no prices) and do not fit; the 17 that fit share a currency,
    // so the event is those 17 with their prices in francs, not a list of 17 homes that lost their price because of a home that is no longer in it.
    const cards = [...Array.from({ length: 19 }, (_, position) => realHome(position)), realHome(19, { price: { currency: 'EUR', totalCents: 48000 } })];

    const event = viewItemListEvent(cards, LIST);

    expect(event.items).toHaveLength(17);
    expect(event.currency).toBe('CHF');
    expect(event.items.every((item) => item.price === 960.5)).toBe(true);
  });

  it('viewItemListEvent_AHomeOfEuros_GivesEuros_NeverAConversion', () => {
    const event = viewItemListEvent([card(0, { price: { currency: 'EUR', perNightCents: 12000, totalCents: 48000 } })], LIST);

    expect(event.currency).toBe('EUR');
    expect(event.items[0].price).toBe(480);
  });

  it('viewItemListEvent_HomesInTwoCurrencies_SendNoPriceAtAllRatherThanANumberWithTheWrongCurrency', () => {
    const event = viewItemListEvent([card(0), card(1, { price: { currency: 'EUR', perNightCents: 12000, totalCents: 48000 } })], LIST);

    expect(event.currency).toBeUndefined();
    expect(event.items.map((item) => item.price)).toEqual([undefined, undefined]);
    expect(event.items.map((item) => item.item_id)).toEqual(['property-0', 'property-1']);
  });

  it('viewItemListEvent_NoDatesChosen_HasNoPriceAndNoCurrency', () => {
    const event = viewItemListEvent([card(0, { price: { currency: 'EUR', perNightCents: 12000 } })], LIST);

    expect(event.currency).toBeUndefined();
    expect(event.items[0]).not.toHaveProperty('price');
  });

  it('viewItemListEvent_AnEmptyList_IsAnEmptyList', () => {
    expect(viewItemListEvent([], LIST)).toEqual({ item_list_id: 'search_results', item_list_name: 'Risultati di ricerca', items: [] });
  });

  it('viewItemListEvent_AHomeWithoutACurrency_NeverGetsOneMadeUp', () => {
    const event = viewItemListEvent([card(0, { price: { perNightCents: 100, totalCents: 5000 } })], LIST);

    expect(event.currency).toBeUndefined();
    expect(event.items[0]).not.toHaveProperty('price');
  });
});

describe('viewItemEvent, beginCheckoutEvent and purchaseEvent', () => {
  const HOME = { propertyId: 'property-1', propertyName: 'Casa Mare', place: 'Lugano' };

  it('viewItemEvent_AHomeOfFrancs_GivesFrancs', () => {
    expect(viewItemEvent({ ...HOME, currency: 'CHF', total: 960.5 })).toEqual({
      currency: 'CHF',
      value: 960.5,
      items: [{ item_id: 'property-1', item_name: 'Casa Mare', item_category: 'Lugano', price: 960.5, quantity: 1 }],
    });
  });

  it('viewItemEvent_WithoutAQuote_HasNeitherValueNorCurrency', () => {
    expect(viewItemEvent({ ...HOME, currency: 'CHF', total: null })).toEqual({
      items: [{ item_id: 'property-1', item_name: 'Casa Mare', item_category: 'Lugano', quantity: 1 }],
    });
  });

  it('beginCheckoutEvent_TheServerTotalAndTheCurrencyOfTheHome_ToTwoDecimals', () => {
    const event = beginCheckoutEvent({ ...HOME, currency: 'chf', total: 1234.567 });

    expect(event.currency).toBe('CHF');
    expect(event.value).toBe(1234.57);
    expect(event.items).toHaveLength(1);
    expect(event.items[0].price).toBe(1234.57);
  });

  it.each([[undefined], [null], [''], ['EURO'], ['E1R'], ['€']])('beginCheckoutEvent_CurrencyOfTheData_%s_IsNeverReplacedByOneOfOurOwn', (currency) => {
    const event = beginCheckoutEvent({ ...HOME, currency, total: 100 });

    expect(event.currency).toBeUndefined();
    expect(event.value).toBeUndefined();
    expect(event.items[0]).not.toHaveProperty('price');
  });

  it('purchaseEvent_UsesTheIdOfTheBookingAsTheTransactionAndTheTotalOfTheOutcome', () => {
    const event = purchaseEvent({ bookingId: '0f6c1b7e-9d2a-4c3b-8a1f-5e4d3c2b1a00', currency: 'CHF', total: 1200, propertyId: 'property-1', propertyName: 'Casa Mare' });

    expect(event).toEqual({
      transaction_id: '0f6c1b7e-9d2a-4c3b-8a1f-5e4d3c2b1a00',
      currency: 'CHF',
      value: 1200,
      items: [{ item_id: 'property-1', item_name: 'Casa Mare', price: 1200, quantity: 1 }],
    });
  });

  it('purchaseEvent_WithoutACurrency_KeepsTheTransactionAndLeavesTheMoneyOut', () => {
    const event = purchaseEvent({ bookingId: 'b-1', total: 1200, propertyId: 'property-1', propertyName: 'Casa Mare' });

    expect(event.transaction_id).toBe('b-1');
    expect(event.currency).toBeUndefined();
    expect(event.value).toBeUndefined();
  });
});

describe('searchEvent', () => {
  it('searchEvent_APlaceDatesAndGuests_AreTheSearch', () => {
    expect(searchEvent({ term: '  Lugano   centro ', checkIn: '2026-12-01', checkOut: '2026-12-05', guests: 4 })).toEqual({
      search_term: 'Lugano centro',
      start_date: '2026-12-01',
      end_date: '2026-12-05',
      number_of_travelers: 4,
    });
  });

  it.each([
    ['an address of e-mail', 'mario.rossi@example.com'],
    ['a phone number', '+39 333 123 4567'],
    ['a phone number with dots', '333.123.4567'],
    ['a long number', '1234567890'],
    ['a term over 100 characters', 'a'.repeat(101)],
  ])('searchEvent_Term_%s_IsLeftOut', (_label, term) => {
    expect(searchEvent({ term })).toEqual({});
  });

  it('searchEvent_ValuesThatAreNotWhatTheyShouldBe_AreLeftOut', () => {
    expect(searchEvent({ term: null, checkIn: '1 dicembre', checkOut: '2026-12-5', guests: 0 })).toEqual({});
    expect(searchEvent({ guests: 100 })).toEqual({});
    expect(searchEvent({ guests: 2.5 })).toEqual({});
  });
});

describe('the payloads carry no personal data (the proof of privacy)', () => {
  const PERSONAL = ['mario.rossi@example.com', '+39 333 123 4567', 'ABCDE-FGHIJ', 'Mario Rossi', 'gs1.signedtoken', 'FUJYKK'];

  it('ga4Ecommerce_payloads_carryNoPersonalData', () => {
    // What a caller might have at hand next to the home: the guest, the e-mail, the phone, the code the guest is shown, a token.
    const personal = { guestName: 'Mario Rossi', email: 'mario.rossi@example.com', phone: '+39 333 123 4567', bookingCode: 'ABCDE-FGHIJ', token: 'gs1.signedtoken', hostName: 'FUJYKK' };
    const home = { ...card(0), ...personal };
    const payloads = [
      viewItemListEvent([home], { listId: 'search_results', listName: 'Risultati' }),
      viewItemEvent({ propertyId: 'p1', propertyName: 'Casa Mare', place: 'Lugano', currency: 'CHF', total: 100, ...personal } as Parameters<typeof viewItemEvent>[0]),
      beginCheckoutEvent({ propertyId: 'p1', propertyName: 'Casa Mare', place: 'Lugano', currency: 'CHF', total: 100, ...personal } as Parameters<typeof beginCheckoutEvent>[0]),
      purchaseEvent({ bookingId: 'booking-1', currency: 'CHF', total: 100, propertyId: 'p1', propertyName: 'Casa Mare', ...personal } as Parameters<typeof purchaseEvent>[0]),
      searchEvent({ term: 'Lugano', checkIn: '2026-12-01', guests: 2, ...personal } as Parameters<typeof searchEvent>[0]),
    ];

    for (const payload of payloads) {
      const text = JSON.stringify(payload);
      for (const value of PERSONAL) expect(text).not.toContain(value);
    }
  });

  it('ga4Ecommerce_Items_HaveNoMemberOutsideTheOnesOfTheContract', () => {
    const home = { ...card(0), email: 'mario.rossi@example.com', photos: ['https://example.test/1.jpg'], latitude: 46.0, longitude: 8.9 };
    const items = [
      ...viewItemListEvent([home], { listId: 'l', listName: 'L' }).items,
      ...viewItemEvent({ propertyId: 'p1', propertyName: 'Casa', place: 'Lugano', currency: 'CHF', total: 1 }).items,
      ...beginCheckoutEvent({ propertyId: 'p1', propertyName: 'Casa', place: 'Lugano', currency: 'CHF', total: 1 }).items,
      ...purchaseEvent({ bookingId: 'b', currency: 'CHF', total: 1, propertyId: 'p1', propertyName: 'Casa' }).items,
    ];

    expect(items).toHaveLength(4);
    for (const item of items) {
      for (const key of Object.keys(item)) expect(ALLOWED_ITEM_KEYS).toContain(key);
    }
  });

  it('ga4Ecommerce_Purchase_TheOnlyIdentifierIsTheIdOfTheBookingNeverTheCodeTheGuestIsShown', () => {
    const event = purchaseEvent({ bookingId: 'booking-id-1', currency: 'EUR', total: 480, propertyId: 'p1', propertyName: 'Casa Mare', bookingCode: 'ABCDE-FGHIJ' } as Parameters<typeof purchaseEvent>[0]);

    expect(event.transaction_id).toBe('booking-id-1');
    expect(JSON.stringify(event)).not.toContain('ABCDE-FGHIJ');
  });

  it('ga4Ecommerce_Payloads_AreJsonThatSurvivesAPostMessage', () => {
    // They travel in the `params` of an `event` message: plain JSON, no `undefined`.
    const payload = viewItemListEvent([card(0)], { listId: 'search_results', listName: 'Risultati' });

    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
    expect(structuredClone(payload)).toEqual(payload);
  });
});
